"use client";

import {
	ChangeEvent,
	DragEvent,
	FormEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { supabase } from "@/lib/supabase/client";

const roles = [
	"SDE Intern",
	"Full-time SDE",
	"MBA",
	"Data Analyst",
	"Product Manager",
	"Other",
];

const JOB_DESCRIPTION_MIN_LENGTH = 20;
const JOB_DESCRIPTION_MAX_LENGTH = 8000;
const POST_DESCRIPTION_MIN_LENGTH = 10;
const POST_DESCRIPTION_MAX_LENGTH = 4000;

function cleanFileName(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, "-")
		.replace(/-+/g, "-");
}

function fileSize(size: number) {
	return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function SubmitResumeForm() {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [title, setTitle] = useState("");
	const [targetRole, setTargetRole] = useState(roles[0]);
	const [jobDescription, setJobDescription] = useState("");
	const [postDescription, setPostDescription] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isAnonymous, setIsAnonymous] = useState(true);
	const [dragging, setDragging] = useState(false);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => setUser(data.user));

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	function pickFile(nextFile: File | undefined) {
		setMessage("");
		if (!nextFile) return;

		if (nextFile.type !== "application/pdf") {
			setMessage("PDF only. Your resume deserves standards.");
			toast.error("Upload a PDF resume.");
			return;
		}

		if (nextFile.size > 5 * 1024 * 1024) {
			setMessage("Keep the PDF under 5MB.");
			toast.error("Keep the PDF under 5MB.");
			return;
		}

		setFile(nextFile);
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		pickFile(event.target.files?.[0]);
	}

	function handleDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		setDragging(false);
		pickFile(event.dataTransfer.files?.[0]);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!user) {
			const errorMessage =
				"Your session expired. Sign in again from the landing page.";
			setMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (!file || file.type !== "application/pdf") {
			const errorMessage = "Upload a PDF resume for the MVP.";
			setMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		const trimmedTitle = title.trim();
		const trimmedJobDescription = jobDescription.trim();
		const trimmedPostDescription = postDescription.trim();

		if (trimmedJobDescription.length < JOB_DESCRIPTION_MIN_LENGTH) {
			const errorMessage = "Paste the JD so roasters can judge fit.";
			setMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (trimmedPostDescription.length < POST_DESCRIPTION_MIN_LENGTH) {
			const errorMessage = "Add what kind of help you want from the community.";
			setMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		setSubmitting(true);

		const filePath = `${user.id}/${Date.now()}-${cleanFileName(file.name)}`;
		const upload = await supabase.storage
			.from("resumes")
			.upload(filePath, file, {
				contentType: "application/pdf",
				upsert: false,
			});

		if (upload.error) {
			setSubmitting(false);
			setMessage(upload.error.message);
			toast.error("Upload failed.", {
				description: upload.error.message,
			});
			return;
		}

		await supabase
			.from("profiles")
			.update({ target_role: targetRole })
			.eq("id", user.id);

		const insert = await supabase
			.from("resumes")
			.insert({
				user_id: user.id,
				title: trimmedTitle,
				file_path: filePath,
				job_description: trimmedJobDescription,
				post_description: trimmedPostDescription,
				is_anonymous: isAnonymous,
			})
			.select("id")
			.single();

		setSubmitting(false);

		if (insert.error) {
			void supabase.storage.from("resumes").remove([filePath]);
			const needsContextMigration =
				/job_description|post_description|schema cache|column/i.test(
					insert.error.message,
				);
			const errorMessage = needsContextMigration
				? "Run supabase/resume-context.sql in Supabase, then try again."
				: insert.error.message;
			setMessage(errorMessage);
			toast.error("Upload failed.", {
				description: errorMessage,
			});
			return;
		}

		setSuccess(true);
		toast.success("Resume posted.");
		window.setTimeout(() => {
			const resumeRoute = `/resume/${insert.data.id}`;
			announceRouteTransition(resumeRoute);
			router.push(resumeRoute);
		}, 500);
	}

	return (
		<form className="submit-form submit-form-wide" onSubmit={handleSubmit}>
			<div className="submit-form-grid">
				<section className="submit-form-column" aria-label="Resume basics">
					<label className="field-block">
						<span>Resume title</span>
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							required
							maxLength={120}
							placeholder="Student applying for SDE internship"
						/>
						<small>Make the goal clear in one line.</small>
					</label>

					<fieldset className="field-block role-picker">
						<legend>Target role</legend>
						<div>
							{roles.map((role) => (
								<button
									className={targetRole === role ? "selected" : ""}
									type="button"
									onClick={() => setTargetRole(role)}
									key={role}
								>
									{role}
								</button>
							))}
						</div>
					</fieldset>

					<div className="field-block">
						<span>Resume PDF</span>
						<input
							className="hidden-file-input"
							accept="application/pdf"
							required
							ref={inputRef}
							type="file"
							onChange={handleFileChange}
						/>
						<button
							className={`dropzone${dragging ? " drag-over" : ""}${file ? " has-file" : ""}`}
							type="button"
							onClick={() => inputRef.current?.click()}
							onDragOver={(event) => {
								event.preventDefault();
								setDragging(true);
							}}
							onDragLeave={() => setDragging(false)}
							onDrop={handleDrop}
						>
							{file ? (
								<>
									<span className="file-check">OK</span>
									<strong>{file.name}</strong>
									<small>{fileSize(file.size)}</small>
									<em
										onClick={(event) => {
											event.stopPropagation();
											setFile(null);
											if (inputRef.current) inputRef.current.value = "";
										}}
									>
										Remove file
									</em>
								</>
							) : (
								<>
									<span className="upload-icon" aria-hidden="true">
										<UploadCloud size={24} strokeWidth={1.8} />
									</span>
									<strong>Drop your PDF here</strong>
									<small>or click to browse</small>
									<em>Max 5MB - PDF only</em>
								</>
							)}
						</button>
					</div>
				</section>

				<section
					className="submit-form-column submit-context-column"
					aria-label="Post context"
				>
					<label className="field-block">
						<span>Job description</span>
						<textarea
							className="submit-context-textarea submit-jd-textarea"
							value={jobDescription}
							onChange={(event) => setJobDescription(event.target.value)}
							required
							minLength={JOB_DESCRIPTION_MIN_LENGTH}
							maxLength={JOB_DESCRIPTION_MAX_LENGTH}
							placeholder="Paste the JD, responsibilities, requirements, and keywords from the role you are applying for."
						/>
						<small>
							This helps roasters compare your resume against the actual role.
						</small>
					</label>

					<label className="field-block">
						<span>What should the community help with?</span>
						<textarea
							className="submit-context-textarea submit-help-textarea"
							value={postDescription}
							onChange={(event) => setPostDescription(event.target.value)}
							required
							minLength={POST_DESCRIPTION_MIN_LENGTH}
							maxLength={POST_DESCRIPTION_MAX_LENGTH}
							placeholder="Example: I want feedback on ATS keywords, project bullet strength, and whether this fits backend internship roles."
						/>
						<small>
							Add your ask, concerns, or the part of the resume you want roasted first.
						</small>
					</label>
				</section>
			</div>

			<div className="submit-form-actions">
				<label className="anonymous-toggle">
					<span className="toggle-copy">
						<strong>Post anonymously</strong>
						<small>Your name will not appear on the post</small>
					</span>
					<input
						checked={isAnonymous}
						type="checkbox"
						onChange={(event) => setIsAnonymous(event.target.checked)}
					/>
					<span className="toggle-ui" aria-hidden="true" />
				</label>

				<button
					className="btn-primary submit-button"
					disabled={
						submitting ||
						success ||
						!title.trim() ||
						!file ||
						jobDescription.trim().length < JOB_DESCRIPTION_MIN_LENGTH ||
						postDescription.trim().length < POST_DESCRIPTION_MIN_LENGTH
					}
				>
					{success ? (
						"Posted. Redirecting..."
					) : submitting ? (
						<>
							<span className="button-spinner" />
							Uploading...
						</>
					) : (
						"Submit for roasting"
					)}
				</button>
			</div>

			{message ? <p className="form-message">{message}</p> : null}
		</form>
	);
}

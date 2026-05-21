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
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

const roles = [
	"SDE Intern",
	"Full-time SDE",
	"MBA",
	"Data Analyst",
	"Product Manager",
	"Other",
];

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
				title: title.trim(),
				file_path: filePath,
				is_anonymous: isAnonymous,
			})
			.select("id")
			.single();

		setSubmitting(false);

		if (insert.error) {
			setMessage(insert.error.message);
			toast.error("Upload failed.", {
				description: insert.error.message,
			});
			return;
		}

		setSuccess(true);
		toast.success("Resume posted.");
		window.setTimeout(() => router.push(`/resume/${insert.data.id}`), 500);
	}

	return (
		<form className="submit-form" onSubmit={handleSubmit}>
			<label className="field-block">
				<span>Resume title</span>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					required
					maxLength={120}
					placeholder="Fresh grad applying for SDE roles"
				/>
				<small>Give context so roasters know what you are targeting</small>
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
							<span className="file-check">✓</span>
							<strong>{file.name}</strong>
							<small>{fileSize(file.size)}</small>
							<em
								onClick={(event) => {
									event.stopPropagation();
									setFile(null);
									if (inputRef.current) inputRef.current.value = "";
								}}
							>
								Remove x
							</em>
						</>
					) : (
						<>
							<span className="upload-icon" aria-hidden="true" />
							<strong>Drop your PDF here</strong>
							<small>or click to browse</small>
							<em>Max 5MB · PDF only</em>
						</>
					)}
				</button>
			</div>

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
				disabled={submitting || success || !title.trim() || !file}
			>
				{success ? (
					"✓ Posted! Redirecting..."
				) : submitting ? (
					<>
						<span className="button-spinner" />
						Uploading...
					</>
				) : (
					"Submit for roasting"
				)}
			</button>

			{message ? <p className="form-message">{message}</p> : null}
		</form>
	);
}

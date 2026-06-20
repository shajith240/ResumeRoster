"use client";

import {
	FormEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
	TextItem,
	TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import FileUpload, {
	DropZone,
	FileError,
	FileList,
	type FileInfo,
} from "@/components/ui/file-upload";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import {
	assessResumePrivacyText,
	MAX_PRIVACY_SCAN_PAGES,
	type PrivacyFinding,
} from "@/lib/pdf-privacy";
import {
	RESUME_PRIVACY_MODE_COPY,
	RESUME_PRIVACY_MODES,
	getPrivacyModeHelpText,
	type ResumePrivacyMode,
} from "@/lib/resume-privacy";
import {
	JOB_DESCRIPTION_MAX_LENGTH,
	JOB_DESCRIPTION_MIN_LENGTH,
	POST_DESCRIPTION_MAX_LENGTH,
	POST_DESCRIPTION_MIN_LENGTH,
	TARGET_ROLES,
	getSubmitIssue,
} from "@/lib/submit-validation";
import { supabase } from "@/lib/supabase/client";
import {
	PREMIUM_PRICE_RUPEES,
	type RazorpayCheckoutInstance,
	type RazorpayCheckoutOptions,
	type RazorpayCheckoutResponse,
} from "@/lib/premium-payments";
import styles from "./SubmitResumeForm.module.css";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";

type RazorpayWindow = Window & {
	Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
};

function loadRazorpayScript(): Promise<void> {
	return new Promise((resolve, reject) => {
		if ((window as RazorpayWindow).Razorpay) {
			resolve();
			return;
		}
		const script = document.createElement("script");
		script.src = "https://checkout.razorpay.com/v1/checkout.js";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
		document.head.appendChild(script);
	});
}

type SubmitProfile = {
	full_name: string | null;
	username: string | null;
	college?: string | null;
	target_role?: string | null;
	current_position?: string | null;
};

type PrivacyScanState =
	| { status: "idle"; findings: PrivacyFinding[]; message: string }
	| { status: "checking"; findings: PrivacyFinding[]; message: string }
	| {
			status: "clear";
			findings: PrivacyFinding[];
			message: string;
			pageCount: number;
			scannedPageCount: number;
	  }
	| {
			status: "warning";
			findings: PrivacyFinding[];
			message: string;
			pageCount: number;
			scannedPageCount: number;
	  }
	| { status: "error"; findings: PrivacyFinding[]; message: string };

function profileDisplayName(profile: SubmitProfile | null, user: User | null) {
	return (
		profile?.full_name?.trim() ||
		profile?.username?.trim().replace(/^@+/, "") ||
		(user ? getAnonymousProfileUsername(user.id) : "") ||
		"your profile"
	);
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return "str" in item;
}

async function hasPdfSignature(file: File) {
	const header = await file.slice(0, 5).text();
	return header === "%PDF-";
}

async function getPdfJs() {
	const pdfjs = await import("pdfjs-dist");
	pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
	return pdfjs;
}

async function scanPdfPrivacy(file: File): Promise<PrivacyScanState> {
	const pdfjs = await getPdfJs();
	const bytes = new Uint8Array(await file.arrayBuffer());
	const task = pdfjs.getDocument({
		data: bytes,
		disableAutoFetch: true,
		disableStream: true,
	});

	try {
		const pdf = await task.promise;
		const pageCount = pdf.numPages;
		const scannedPageCount = Math.min(pageCount, MAX_PRIVACY_SCAN_PAGES);
		const pageTexts: string[] = [];

		for (let pageNumber = 1; pageNumber <= scannedPageCount; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const textContent = await page.getTextContent();
			pageTexts.push(
				textContent.items
					.filter(isTextItem)
					.map((item) => item.str)
					.join(" "),
			);
			page.cleanup();
		}

		await pdf.destroy();

		const assessment = assessResumePrivacyText(pageTexts.join(" "));
		if (assessment.findings.length) {
			return {
				status: "warning",
				findings: assessment.findings,
				pageCount,
				scannedPageCount,
				message:
					"Contact details found. The server will remove them according to your privacy mode before posting.",
			};
		}

		return {
			status: "clear",
			findings: [],
			pageCount,
			scannedPageCount,
			message:
				pageCount > scannedPageCount
					? `No obvious contact details found in the first ${scannedPageCount} pages. The server still checks the final upload.`
					: "No obvious emails, phone numbers, or profile links found. The server still checks the final upload.",
		};
	} catch (error) {
		task.destroy();
		throw error;
	}
}

async function getSubmitProfile(activeUser: User | null) {
	if (!activeUser) return null;

	const primaryResult = await supabase
		.from("profiles")
		.select("full_name,username,college,target_role,current_position")
		.eq("id", activeUser.id)
		.maybeSingle();

	if (
		primaryResult.error &&
		/current_position|schema cache|column/i.test(primaryResult.error.message)
	) {
		const fallbackResult = await supabase
			.from("profiles")
			.select("full_name,username,college,target_role")
			.eq("id", activeUser.id)
			.maybeSingle();

		if (fallbackResult.error) return null;
		return fallbackResult.data as SubmitProfile | null;
	}

	if (primaryResult.error) return null;

	return primaryResult.data as SubmitProfile | null;
}

export default function SubmitResumeForm() {
	const router = useRouter();
	const privacyScanRunRef = useRef(0);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<SubmitProfile | null>(null);
	const [title, setTitle] = useState("");
	const [targetRole, setTargetRole] = useState<string>(TARGET_ROLES[0]);
	const [jobDescription, setJobDescription] = useState("");
	const [postDescription, setPostDescription] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [uploadFiles, setUploadFiles] = useState<FileInfo[]>([]);
	const [privacyMode, setPrivacyMode] =
		useState<ResumePrivacyMode>("contact_hidden");
	const [privacyScan, setPrivacyScan] = useState<PrivacyScanState>({
		status: "idle",
		findings: [],
		message: "",
	});
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState(false);
	const [reviewPlan, setReviewPlan] = useState<"community" | "priority">("community");
	const [submitLabel, setSubmitLabel] = useState<string | null>(null);

	useEffect(() => {
		async function syncUser(activeUser: User | null) {
			setUser(activeUser);
			setProfile(await getSubmitProfile(activeUser));
		}

		supabase.auth.getUser().then(({ data }) => {
			void syncUser(data.user);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			void syncUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	async function pickFile(nextFile: File | undefined) {
		setMessage("");
		privacyScanRunRef.current += 1;
		const scanRun = privacyScanRunRef.current;
		setPrivacyScan({ status: "idle", findings: [], message: "" });

		if (!nextFile) {
			setUploadFiles([]);
			return;
		}

		if (nextFile.type && nextFile.type !== "application/pdf") {
			setFile(null);
			setUploadFiles([]);
			setMessage("PDF only. Your resume deserves standards.");
			toast.error("Upload a PDF resume.");
			return;
		}

		if (nextFile.size > 5 * 1024 * 1024) {
			setFile(null);
			setUploadFiles([]);
			setMessage("Keep the PDF under 5MB.");
			toast.error("Keep the PDF under 5MB.");
			return;
		}

		setFile(nextFile);
		setPrivacyScan({
			status: "checking",
			findings: [],
			message: "Checking the PDF before it can be posted.",
		});

		try {
			if (!(await hasPdfSignature(nextFile))) {
				if (scanRun !== privacyScanRunRef.current) return;
				setFile(null);
				setUploadFiles([]);
				setPrivacyScan({
					status: "error",
					findings: [],
					message: "This file does not look like a valid PDF.",
				});
				toast.error("Upload a valid PDF file.");
				return;
			}

			const result = await scanPdfPrivacy(nextFile);
			if (scanRun !== privacyScanRunRef.current) return;

			setPrivacyScan(result);
		} catch {
			if (scanRun !== privacyScanRunRef.current) return;
			setPrivacyScan({
				status: "error",
				findings: [],
				message:
					"We could not scan this PDF. Export a standard redacted PDF and upload it again.",
			});
			toast.error("PDF privacy check failed.");
		}
	}

	function handleFileSelect(files: File[]) {
		void pickFile(files[0]);
	}

	function handleFileSelectChange(files: FileInfo[]) {
		setUploadFiles(files.slice(0, 1));
	}

	function clearSelectedFile() {
		privacyScanRunRef.current += 1;
		setFile(null);
		setUploadFiles([]);
		setMessage("");
		setPrivacyScan({
			status: "idle",
			findings: [],
			message: "",
		});
	}

	const publicProfileName = profileDisplayName(profile, user);
	const publicProfileDetail =
		profile?.current_position?.trim() ||
		profile?.target_role?.trim() ||
		profile?.college?.trim() ||
		"your saved profile details";
	const trimmedTitle = title.trim();
	const trimmedJobDescription = jobDescription.trim();
	const trimmedPostDescription = postDescription.trim();
	const jobDescriptionRemaining = Math.max(
		JOB_DESCRIPTION_MIN_LENGTH - trimmedJobDescription.length,
		0,
	);
	const postDescriptionRemaining = Math.max(
		POST_DESCRIPTION_MIN_LENGTH - trimmedPostDescription.length,
		0,
	);
	const submitIssue = getSubmitIssue({
		title,
		hasFile: Boolean(file),
		jobDescription,
		postDescription,
	});

	function showFormError(errorMessage: string) {
		setMessage(errorMessage);
		toast.error(errorMessage);
	}

	async function handleVerifyPayment(
		accessToken: string,
		paymentResponse: RazorpayCheckoutResponse,
	) {
		setSubmitLabel("Uploading resume...");

		const fd = new FormData();
		fd.append("razorpay_payment_id", paymentResponse.razorpay_payment_id);
		fd.append("razorpay_order_id", paymentResponse.razorpay_order_id);
		fd.append("razorpay_signature", paymentResponse.razorpay_signature);
		fd.append("file", file!);
		fd.append("title", trimmedTitle);
		fd.append("targetRole", targetRole);
		fd.append("jobDescription", trimmedJobDescription);
		fd.append("postDescription", trimmedPostDescription);
		fd.append("privacyMode", privacyMode);

		const response = await fetch("/api/payments/verify", {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
			body: fd,
		});

		const result = (await response.json().catch(() => null)) as {
			id?: string;
			message?: string;
		} | null;

		setSubmitting(false);
		setSubmitLabel(null);

		if (!response.ok || !result?.id) {
			showFormError(
				result?.message ??
					"Payment verified but submission failed. Contact support with your payment ID.",
			);
			return;
		}

		setSuccess(true);
		toast.success("Priority review submitted.", {
			description:
				"Payment processing. Your resume will appear in the feed once confirmed.",
		});
		window.setTimeout(() => {
			const resumeRoute = `/resume/${result.id}`;
			announceRouteTransition(resumeRoute);
			router.push(resumeRoute);
		}, 500);
	}

	async function handlePriorityPayment(accessToken: string) {
		setSubmitLabel("Preparing payment...");

		const orderResponse = await fetch("/api/payments/create-order", {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		const orderData = (await orderResponse.json().catch(() => null)) as {
			orderId?: string;
			amount?: number;
			currency?: string;
			keyId?: string;
			message?: string;
		} | null;

		if (!orderResponse.ok || !orderData?.orderId) {
			setSubmitting(false);
			setSubmitLabel(null);
			showFormError(orderData?.message ?? "Could not create payment order. Please try again.");
			return;
		}

		try {
			await loadRazorpayScript();
		} catch {
			setSubmitting(false);
			setSubmitLabel(null);
			showFormError("Could not load payment service. Check your connection and try again.");
			return;
		}

		const RazorpayCheckout = (window as RazorpayWindow).Razorpay;
		if (!RazorpayCheckout) {
			setSubmitting(false);
			setSubmitLabel(null);
			showFormError("Payment service failed to load. Refresh the page and try again.");
			return;
		}

		const brandColor =
			getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() ||
			"#6366f1";

		setSubmitLabel("Complete payment in checkout...");

		await new Promise<void>((resolve) => {
			const rzp = new RazorpayCheckout({
				key: orderData.keyId!,
				amount: orderData.amount!,
				currency: orderData.currency!,
				order_id: orderData.orderId!,
				name: "Linted",
				description: "Priority Resume Review",
				prefill: { email: user?.email ?? undefined },
				theme: { color: brandColor },
				modal: {
					ondismiss: () => {
						setSubmitting(false);
						setSubmitLabel(null);
						setMessage("Payment cancelled. Your resume was not submitted.");
						resolve();
					},
				},
				handler: (paymentResponse: RazorpayCheckoutResponse) => {
					void handleVerifyPayment(accessToken, paymentResponse).then(resolve);
				},
			});
			rzp.open();
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!user) {
			const errorMessage =
				"Your session expired. Sign in again to continue.";
			showFormError(errorMessage);
			return;
		}

		if (!trimmedTitle) {
			showFormError("Add a resume title before submitting.");
			return;
		}

		if (!file || (file.type && file.type !== "application/pdf")) {
			const errorMessage = "Upload a PDF resume for the MVP.";
			showFormError(errorMessage);
			return;
		}

		if (trimmedJobDescription.length < JOB_DESCRIPTION_MIN_LENGTH) {
			const errorMessage = `Add ${JOB_DESCRIPTION_MIN_LENGTH}+ characters of job description so reviewers can judge fit.`;
			showFormError(errorMessage);
			return;
		}

		if (trimmedPostDescription.length < POST_DESCRIPTION_MIN_LENGTH) {
			const errorMessage = `Add ${POST_DESCRIPTION_MIN_LENGTH}+ characters explaining what help you want.`;
			showFormError(errorMessage);
			return;
		}

		setSubmitting(true);

		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;
		if (!accessToken) {
			setSubmitting(false);
			showFormError("Your session expired. Sign in again to continue.");
			return;
		}

		if (reviewPlan === "priority") {
			await handlePriorityPayment(accessToken);
			return;
		}

		const formData = new FormData();
		formData.append("file", file);
		formData.append("title", trimmedTitle);
		formData.append("targetRole", targetRole);
		formData.append("jobDescription", trimmedJobDescription);
		formData.append("postDescription", trimmedPostDescription);
		formData.append("privacyMode", privacyMode);

		const response = await fetch("/api/resumes/submit", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: formData,
		});

		const result = (await response.json().catch(() => null)) as {
			activationReviewsCompleted?: number;
			activationReviewsRequired?: number;
			id?: string;
			message?: string;
			reviewQueueStatus?: "active" | "waiting";
		} | null;

		setSubmitting(false);

		if (!response.ok || !result?.id) {
			const errorMessage =
				result?.message ??
				"Upload failed while processing the privacy-safe PDF.";
			setMessage(errorMessage);
			toast.error("Upload failed.", {
				description: errorMessage,
			});
			return;
		}

		setSuccess(true);
		if (result.reviewQueueStatus === "waiting") {
			const remaining = Math.max(
				(result.activationReviewsRequired ?? 2) -
					(result.activationReviewsCompleted ?? 0),
				0,
			);
			toast.success("Resume posted to the queue.", {
				description:
					remaining > 0
						? `Complete ${remaining} guided ${remaining === 1 ? "review" : "reviews"} to activate it faster.`
						: "Your resume is ready for community review.",
			});
		} else {
			toast.success("Resume posted.");
		}
		window.setTimeout(() => {
			const resumeRoute = `/resume/${result.id}`;
			announceRouteTransition(resumeRoute);
			router.push(resumeRoute);
		}, 500);
	}

	return (
		<form className="submit-form submit-form-wide" noValidate onSubmit={handleSubmit}>
			<div className="submit-form-grid">
				<section className="submit-form-column" aria-label="Resume basics">
					<label className="field-block submit-title-field">
						<span>Resume title</span>
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							required
							maxLength={120}
							placeholder="Backend internship resume"
						/>
						<small>Make the goal clear in one line.</small>
					</label>

					<fieldset className="field-block role-picker submit-role-field">
						<legend>Target role</legend>
						<div>
							{TARGET_ROLES.map((role) => (
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

					<div className="field-block submit-upload-field">
						<span>Resume PDF</span>
						<FileUpload
							accept=".pdf,application/pdf"
							className="submit-file-upload"
							files={uploadFiles}
							maxCount={1}
							maxSize={5}
							onFileSelect={handleFileSelect}
							onFileSelectChange={handleFileSelectChange}
							onRemove={clearSelectedFile}
						>
							<DropZone
								browseText="or click to browse"
								className="submit-pdf-dropzone"
								prompt="Drop your PDF here"
							/>
							<FileError />
							<FileList
								canRemove
								className="submit-file-list"
								onClear={clearSelectedFile}
								onRemove={clearSelectedFile}
								showHeader={false}
							/>
						</FileUpload>
						{file ? (
							<div className={`privacy-check privacy-check-${privacyScan.status}`}>
								<div>
									<strong>PDF privacy check</strong>
									<span>{privacyScan.message}</span>
								</div>
								{privacyScan.findings.length ? (
									<ul>
										{privacyScan.findings.map((finding) => (
											<li key={finding.type}>
												{finding.label}
												{finding.count > 1 ? ` x${finding.count}` : ""}
											</li>
										))}
									</ul>
								) : null}
							</div>
						) : null}
					</div>
				</section>

				<section
					className="submit-form-column submit-context-column"
					aria-label="Post context"
				>
					<label className="field-block submit-jd-field">
						<span>Job description</span>
						<textarea
							aria-describedby="job-description-help"
							aria-invalid={
								trimmedJobDescription.length > 0 &&
								jobDescriptionRemaining > 0
							}
							className="submit-context-textarea submit-jd-textarea"
							value={jobDescription}
							onChange={(event) => setJobDescription(event.target.value)}
							required
							minLength={JOB_DESCRIPTION_MIN_LENGTH}
							maxLength={JOB_DESCRIPTION_MAX_LENGTH}
							placeholder="Paste the JD, responsibilities, requirements, and keywords from the role you are applying for."
						/>
						<small
							className={
								trimmedJobDescription.length > 0 &&
								jobDescriptionRemaining > 0
									? "field-validation is-warning"
									: undefined
							}
							id="job-description-help"
						>
							{jobDescriptionRemaining > 0
								? `${jobDescriptionRemaining} more ${jobDescriptionRemaining === 1 ? "character" : "characters"} needed. Paste enough JD context to judge fit.`
								: "This helps reviewers compare your resume against the actual role."}
						</small>
					</label>

					<label className="field-block submit-help-field">
						<span>What should the community help with?</span>
						<textarea
							aria-describedby="post-description-help"
							aria-invalid={
								trimmedPostDescription.length > 0 &&
								postDescriptionRemaining > 0
							}
							className="submit-context-textarea submit-help-textarea"
							value={postDescription}
							onChange={(event) => setPostDescription(event.target.value)}
							required
							minLength={POST_DESCRIPTION_MIN_LENGTH}
							maxLength={POST_DESCRIPTION_MAX_LENGTH}
							placeholder="Example: I want feedback on ATS keywords, project bullet strength, and whether this fits backend internship roles."
						/>
						<small
							className={
								trimmedPostDescription.length > 0 &&
								postDescriptionRemaining > 0
									? "field-validation is-warning"
									: undefined
							}
							id="post-description-help"
						>
							{postDescriptionRemaining > 0
								? `${postDescriptionRemaining} more ${postDescriptionRemaining === 1 ? "character" : "characters"} needed. Tell reviewers what to focus on.`
								: "Add your ask, concerns, or the part of the resume you want reviewed first."}
						</small>
					</label>
				</section>
			</div>

			<div className={styles.formActions}>
				<fieldset className={styles.planPicker}>
					<legend>Review plan</legend>
					<div className={styles.planOptions}>
						<label
							className={[
								styles.optionCard,
								reviewPlan === "community" ? styles.optionCardSelected : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<input
								checked={reviewPlan === "community"}
								name="reviewPlan"
								onChange={() => setReviewPlan("community")}
								type="radio"
							/>
							<span className={styles.optionBody}>
								<span className={styles.optionHeader}>
									<strong>Community review</strong>
									<span className={styles.planBadgeFree}>Free</span>
								</span>
								<small>Reviewed by community members. Typically within a few days.</small>
							</span>
						</label>
						<label
							className={[
								styles.optionCard,
								reviewPlan === "priority" ? styles.optionCardSelected : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<input
								checked={reviewPlan === "priority"}
								name="reviewPlan"
								onChange={() => setReviewPlan("priority")}
								type="radio"
							/>
							<span className={styles.optionBody}>
								<span className={styles.optionHeader}>
									<strong>Priority review</strong>
									<span className={styles.planBadgePremium}>₹{PREMIUM_PRICE_RUPEES}</span>
								</span>
								<small>Assigned to a verified reviewer. Guaranteed response within 24 hours.</small>
							</span>
						</label>
					</div>
				</fieldset>

				<fieldset className={styles.privacyPicker}>
					<legend>Privacy mode</legend>
					<div className={styles.privacyOptions}>
						{RESUME_PRIVACY_MODES.map((mode) => (
							<label
								className={[
									styles.optionCard,
									privacyMode === mode ? styles.optionCardSelected : "",
								]
									.filter(Boolean)
									.join(" ")}
								key={mode}
							>
								<input
									checked={privacyMode === mode}
									name="privacyMode"
									onChange={() => setPrivacyMode(mode)}
									type="radio"
								/>
								<span className={styles.optionBody}>
									<span className={styles.optionHeader}>
										<strong>{RESUME_PRIVACY_MODE_COPY[mode].label}</strong>
									</span>
									<small>
										{mode === "public"
											? `${publicProfileName} and ${publicProfileDetail} can appear with the post.`
											: RESUME_PRIVACY_MODE_COPY[mode].description}
									</small>
								</span>
							</label>
						))}
					</div>
					<p className={styles.privacyHint}>{getPrivacyModeHelpText(privacyMode)}</p>
				</fieldset>

				<div className={styles.submitActionPanel}>
					<button
						className={`btn-primary ${styles.submitButton}`}
						disabled={submitting || success || Boolean(submitIssue)}
						title={submitIssue || undefined}
					>
						{success ? (
							"Posted. Redirecting..."
						) : submitting ? (
							<>
								<span className="button-spinner" />
								{submitLabel ?? "Processing PDF..."}
							</>
						) : reviewPlan === "priority" ? (
							`Pay ₹${PREMIUM_PRICE_RUPEES} & Submit`
						) : (
							"Submit for review"
						)}
					</button>
					{submitIssue && !submitting && !success ? (
						<p className={styles.submitActionHint} aria-live="polite">
							{submitIssue}
						</p>
					) : null}
				</div>
			</div>

			{message ? <p className="form-message">{message}</p> : null}
		</form>
	);
}

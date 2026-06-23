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

	type ResumePrivacyMode,
} from "@/lib/resume-privacy";
import {
	JOB_DESCRIPTION_MAX_LENGTH,
	JOB_DESCRIPTION_MIN_LENGTH,
	POST_DESCRIPTION_MAX_LENGTH,
	POST_DESCRIPTION_MIN_LENGTH,
	TARGET_ROLES,
} from "@/lib/submit-validation";
import { supabase } from "@/lib/supabase/client";
import {
	PREMIUM_PRICE_RUPEES,
	type RazorpayCheckoutInstance,
	type RazorpayCheckoutOptions,
	type RazorpayCheckoutResponse,
	PREMIUM_REVIEW_ENABLED,
} from "@/lib/premium-payments";
import styles from "./SubmitResumeForm.module.css";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";
const TOTAL_STEPS = 5;

type RazorpayWindow = Window & {
	Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
};

function loadRazorpayScript(): Promise<void> {
	return new Promise((resolve, reject) => {
		if ((window as RazorpayWindow).Razorpay) { resolve(); return; }
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
	| { status: "clear"; findings: PrivacyFinding[]; message: string; pageCount: number; scannedPageCount: number }
	| { status: "warning"; findings: PrivacyFinding[]; message: string; pageCount: number; scannedPageCount: number }
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
	const task = pdfjs.getDocument({ data: bytes, disableAutoFetch: true, disableStream: true });
	try {
		const pdf = await task.promise;
		const pageCount = pdf.numPages;
		const scannedPageCount = Math.min(pageCount, MAX_PRIVACY_SCAN_PAGES);
		const pageTexts: string[] = [];
		for (let p = 1; p <= scannedPageCount; p++) {
			const page = await pdf.getPage(p);
			const textContent = await page.getTextContent();
			pageTexts.push(textContent.items.filter(isTextItem).map((i) => i.str).join(" "));
			page.cleanup();
		}
		await pdf.destroy();
		const assessment = assessResumePrivacyText(pageTexts.join(" "));
		if (assessment.findings.length) {
			return { status: "warning", findings: assessment.findings, pageCount, scannedPageCount, message: "Contact details found. The server will remove them per your privacy mode before posting." };
		}
		return {
			status: "clear", findings: [], pageCount, scannedPageCount,
			message: pageCount > scannedPageCount
				? `No obvious contact details in the first ${scannedPageCount} pages. The server still checks the final upload.`
				: "No obvious emails, phone numbers, or profile links found.",
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
	if (primaryResult.error && /current_position|schema cache|column/i.test(primaryResult.error.message)) {
		const fallbackResult = await supabase.from("profiles").select("full_name,username,college,target_role").eq("id", activeUser.id).maybeSingle();
		if (fallbackResult.error) return null;
		return fallbackResult.data as SubmitProfile | null;
	}
	if (primaryResult.error) return null;
	return primaryResult.data as SubmitProfile | null;
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, active: boolean, speed = 22) {
	const [count, setCount] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
		setCount(0);
		if (!active) return;
		const delayId = setTimeout(() => {
			let i = 0;
			intervalRef.current = setInterval(() => {
				i++;
				setCount(i);
				if (i >= text.length && intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
			}, speed);
		}, 200);
		return () => {
			clearTimeout(delayId);
			if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active]);

	return { typed: text.slice(0, count), done: count >= text.length };
}

// ─── Scene components ─────────────────────────────────────────────────────────

function SceneRole({ active }: { active: boolean }) {
	const HEADING = "Your role shapes every word of feedback.";
	const { typed, done } = useTypewriter(HEADING, active);
	return (
		<div className={styles.scene} data-scene="role">
			<div className={styles.sceneOrb} />
			<div className={styles.speechBubble}>
				<p className={styles.sceneEyebrow}>Step 1 of {TOTAL_STEPS}</p>
				<h2 className={styles.sceneHeading}>
					{typed}{!done && <span className={styles.typedCursor} aria-hidden="true">|</span>}
				</h2>
				<p className={[styles.sceneBody, done ? styles.sceneBodyVisible : ""].filter(Boolean).join(" ")}>
					A reviewer who knows your target gives specific, actionable notes — not generic advice.
				</p>
			</div>
			<img src="/assets/step1.png" className={styles.characterImg} alt="" aria-hidden="true" />
		</div>
	);
}

function SceneContext({ active }: { active: boolean }) {
	const HEADING = "Give them the full picture.";
	const { typed, done } = useTypewriter(HEADING, active);
	return (
		<div className={styles.scene} data-scene="context">
			<div className={styles.sceneOrb} />
			<div className={styles.speechBubble}>
				<p className={styles.sceneEyebrow}>Step 2 of {TOTAL_STEPS}</p>
				<h2 className={styles.sceneHeading}>
					{typed}{!done && <span className={styles.typedCursor} aria-hidden="true">|</span>}
				</h2>
				<p className={[styles.sceneBody, done ? styles.sceneBodyVisible : ""].filter(Boolean).join(" ")}>
					Paste the JD and write what worries you. Specific context gets specific feedback.
				</p>
			</div>
			<img src="/assets/step2.png" className={styles.characterImg} alt="" aria-hidden="true" />
		</div>
	);
}

function ScenePrivacy({ active }: { active: boolean }) {
	const HEADING = "Your identity is yours to protect.";
	const { typed, done } = useTypewriter(HEADING, active);
	return (
		<div className={styles.scene} data-scene="privacy">
			<div className={styles.sceneOrb} />
			<div className={styles.speechBubble}>
				<p className={styles.sceneEyebrow}>Step 3 of {TOTAL_STEPS}</p>
				<h2 className={styles.sceneHeading}>
					{typed}{!done && <span className={styles.typedCursor} aria-hidden="true">|</span>}
				</h2>
				<p className={[styles.sceneBody, done ? styles.sceneBodyVisible : ""].filter(Boolean).join(" ")}>
					Choose how much the world sees. Contact details are stripped before anything goes live.
				</p>
			</div>
			<img src="/assets/step3.png" className={styles.characterImg} alt="" aria-hidden="true" />
		</div>
	);
}

function ScenePlan({ active }: { active: boolean }) {
	const HEADING = "How fast do you need it?";
	const { typed, done } = useTypewriter(HEADING, active);
	return (
		<div className={styles.scene} data-scene="plan">
			<div className={styles.sceneOrb} />
			<div className={styles.speechBubble}>
				<p className={styles.sceneEyebrow}>Step 4 of {TOTAL_STEPS}</p>
				<h2 className={styles.sceneHeading}>
					{typed}{!done && <span className={styles.typedCursor} aria-hidden="true">|</span>}
				</h2>
				<p className={[styles.sceneBody, done ? styles.sceneBodyVisible : ""].filter(Boolean).join(" ")}>
					Community reviewers work at their own pace. Priority puts a verified reviewer on it within 24 hours.
				</p>
			</div>
			<img src="/assets/step4.png" className={styles.characterImg} alt="" aria-hidden="true" />
		</div>
	);
}

function SceneUpload({ active }: { active: boolean }) {
	const HEADING = "This is the moment.";
	const { typed, done } = useTypewriter(HEADING, active);
	return (
		<div className={styles.scene} data-scene="upload">
			<div className={styles.sceneOrb} />
			<div className={styles.speechBubble}>
				<p className={styles.sceneEyebrow}>Step 5 of {TOTAL_STEPS}</p>
				<h2 className={styles.sceneHeading}>
					{typed}{!done && <span className={styles.typedCursor} aria-hidden="true">|</span>}
				</h2>
				<p className={[styles.sceneBody, done ? styles.sceneBodyVisible : ""].filter(Boolean).join(" ")}>
					Everything you set up wraps around this file the second it lands. Nothing leaks without your permission.
				</p>
			</div>
			<img src="/assets/step5.png" className={styles.characterImg} alt="" aria-hidden="true" />
		</div>
	);
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
	return (
		<div className={styles.stepProgress} role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${current} of ${TOTAL_STEPS}`}>
			<div className={styles.stepProgressFill} style={{ width: `${((current - 1) / (TOTAL_STEPS - 1)) * 100}%` }} />
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

type ExistingResume = { id: string; title: string; review_queue_status: string };

export default function SubmitResumeForm() {
	const router = useRouter();
	const privacyScanRunRef = useRef(0);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<SubmitProfile | null>(null);
	const [existingResume, setExistingResume] = useState<ExistingResume | null | undefined>(undefined);

	// form state
	const [title, setTitle] = useState("");
	const [targetRole, setTargetRole] = useState<string>(TARGET_ROLES[0]);
	const [jobDescription, setJobDescription] = useState("");
	const [postDescription, setPostDescription] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [uploadFiles, setUploadFiles] = useState<FileInfo[]>([]);
	const [privacyMode, setPrivacyMode] = useState<ResumePrivacyMode>("contact_hidden");
	const [privacyScan, setPrivacyScan] = useState<PrivacyScanState>({ status: "idle", findings: [], message: "" });
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState(false);
	const [reviewPlan, setReviewPlan] = useState<"community" | "priority">("community");
	const [submitLabel, setSubmitLabel] = useState<string | null>(null);

	// wizard state
	const [currentStep, setCurrentStep] = useState(1);
	const [direction, setDirection] = useState<"forward" | "backward">("forward");
	const [animKey, setAnimKey] = useState(0);

	// inline field errors (only shown after a failed Next attempt)
	const [jdError, setJdError] = useState(false);
	const [askError, setAskError] = useState(false);
	const [titleError, setTitleError] = useState(false);
	const [submitError, setSubmitError] = useState("");

	useEffect(() => {
		async function syncUser(activeUser: User | null) {
			setUser(activeUser);
			setProfile(await getSubmitProfile(activeUser));
			if (activeUser) {
				const { data } = await supabase
					.from("resumes")
					.select("id,title,review_queue_status")
					.eq("user_id", activeUser.id)
					.eq("status", "open")
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle();
				setExistingResume((data as ExistingResume | null) ?? null);
			} else {
				setExistingResume(null);
			}
		}
		supabase.auth.getUser().then(({ data }) => { void syncUser(data.user); });
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
			void syncUser(session?.user ?? null);
		});
		return () => subscription.unsubscribe();
	}, []);

	async function pickFile(nextFile: File | undefined) {
		setSubmitError("");
		privacyScanRunRef.current += 1;
		const scanRun = privacyScanRunRef.current;
		setPrivacyScan({ status: "idle", findings: [], message: "" });

		if (!nextFile) { setUploadFiles([]); return; }

		if (nextFile.type && nextFile.type !== "application/pdf") {
			setFile(null); setUploadFiles([]);
			toast.error("Upload a PDF resume.");
			return;
		}
		if (nextFile.size > 5 * 1024 * 1024) {
			setFile(null); setUploadFiles([]);
			toast.error("Keep the PDF under 5MB.");
			return;
		}

		setFile(nextFile);
		setPrivacyScan({ status: "checking", findings: [], message: "Scanning the PDF…" });

		try {
			if (!(await hasPdfSignature(nextFile))) {
				if (scanRun !== privacyScanRunRef.current) return;
				setFile(null); setUploadFiles([]);
				setPrivacyScan({ status: "error", findings: [], message: "This file does not look like a valid PDF." });
				toast.error("Upload a valid PDF file.");
				return;
			}
			const result = await scanPdfPrivacy(nextFile);
			if (scanRun !== privacyScanRunRef.current) return;
			setPrivacyScan(result);
		} catch {
			if (scanRun !== privacyScanRunRef.current) return;
			setPrivacyScan({ status: "error", findings: [], message: "We could not scan this PDF. Export a standard PDF and try again." });
			toast.error("PDF privacy check failed.");
		}
	}

	function handleFileSelect(files: File[]) { void pickFile(files[0]); }
	function handleFileSelectChange(files: FileInfo[]) { setUploadFiles(files.slice(0, 1)); }
	function clearSelectedFile() {
		privacyScanRunRef.current += 1;
		setFile(null); setUploadFiles([]);
		setPrivacyScan({ status: "idle", findings: [], message: "" });
	}

	function goToStep(next: number, dir: "forward" | "backward") {
		setDirection(dir);
		setAnimKey((k) => k + 1);
		setCurrentStep(next);
	}

	function handleNext() {
		if (currentStep === 2) {
			const jdLen = jobDescription.trim().length;
			const askLen = postDescription.trim().length;
			const jdBad = jdLen < JOB_DESCRIPTION_MIN_LENGTH;
			const askBad = askLen < POST_DESCRIPTION_MIN_LENGTH;
			setJdError(jdBad);
			setAskError(askBad);
			if (jdBad || askBad) return;
		}
		if (currentStep === 3 && !title.trim()) {
			setTitleError(true);
			return;
		}
		goToStep(currentStep + 1, "forward");
	}

	function handleBack() {
		if (currentStep > 1) goToStep(currentStep - 1, "backward");
	}

	const publicProfileName = profileDisplayName(profile, user);

	const trimmedTitle = title.trim();
	const trimmedJD = jobDescription.trim();
	const trimmedAsk = postDescription.trim();

	function showError(msg: string) { setSubmitError(msg); toast.error(msg); }

	async function handleVerifyPayment(accessToken: string, paymentResponse: RazorpayCheckoutResponse) {
		setSubmitLabel("Uploading resume…");
		const fd = new FormData();
		fd.append("razorpay_payment_id", paymentResponse.razorpay_payment_id);
		fd.append("razorpay_order_id", paymentResponse.razorpay_order_id);
		fd.append("razorpay_signature", paymentResponse.razorpay_signature);
		fd.append("file", file!);
		fd.append("title", trimmedTitle);
		fd.append("targetRole", targetRole);
		fd.append("jobDescription", trimmedJD);
		fd.append("postDescription", trimmedAsk);
		fd.append("privacyMode", privacyMode);

		const response = await fetch("/api/payments/verify", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: fd });
		const result = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
		setSubmitting(false); setSubmitLabel(null);

		if (!response.ok || !result?.id) {
			showError(result?.message ?? "Payment verified but submission failed. Contact support with your payment ID.");
			return;
		}
		setSuccess(true);
		toast.success("Priority review submitted.", { description: "Your resume will appear once payment is confirmed." });
		window.setTimeout(() => { const r = `/resume/${result.id}`; announceRouteTransition(r); router.push(r); }, 500);
	}

	async function handlePriorityPayment(accessToken: string) {
		setSubmitLabel("Preparing payment…");
		const orderResponse = await fetch("/api/payments/create-order", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
		const orderData = (await orderResponse.json().catch(() => null)) as { orderId?: string; amount?: number; currency?: string; keyId?: string; message?: string } | null;
		if (!orderResponse.ok || !orderData?.orderId) {
			setSubmitting(false); setSubmitLabel(null);
			showError(orderData?.message ?? "Could not create payment order. Try again.");
			return;
		}
		try { await loadRazorpayScript(); } catch {
			setSubmitting(false); setSubmitLabel(null);
			showError("Could not load payment service. Check your connection and try again.");
			return;
		}
		const RazorpayCheckout = (window as RazorpayWindow).Razorpay;
		if (!RazorpayCheckout) {
			setSubmitting(false); setSubmitLabel(null);
			showError("Payment service failed to load. Refresh and try again.");
			return;
		}
		const brandColor = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#e85d26";
		setSubmitLabel("Complete payment in checkout…");
		await new Promise<void>((resolve) => {
			const rzp = new RazorpayCheckout({
				key: orderData.keyId!, amount: orderData.amount!, currency: orderData.currency!, order_id: orderData.orderId!,
				name: "Linted", description: "Priority Resume Review",
				prefill: { email: user?.email ?? undefined },
				theme: { color: brandColor },
				modal: { ondismiss: () => { setSubmitting(false); setSubmitLabel(null); setSubmitError("Payment cancelled. Your resume was not submitted."); resolve(); } },
				handler: (paymentResponse: RazorpayCheckoutResponse) => { void handleVerifyPayment(accessToken, paymentResponse).then(resolve); },
			});
			rzp.open();
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitError("");
		if (!user) { showError("Your session expired. Sign in again."); return; }
		if (!trimmedTitle) { showError("Add a resume title."); return; }
		if (!file || (file.type && file.type !== "application/pdf")) { showError("Upload a PDF resume."); return; }
		if (trimmedJD.length < JOB_DESCRIPTION_MIN_LENGTH) { showError(`Add ${JOB_DESCRIPTION_MIN_LENGTH}+ characters to the job description.`); return; }
		if (trimmedAsk.length < POST_DESCRIPTION_MIN_LENGTH) { showError(`Add ${POST_DESCRIPTION_MIN_LENGTH}+ characters to what you need help with.`); return; }

		setSubmitting(true);
		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;
		if (!accessToken) { setSubmitting(false); showError("Your session expired. Sign in again."); return; }

		if (reviewPlan === "priority") { await handlePriorityPayment(accessToken); return; }

		const formData = new FormData();
		formData.append("file", file);
		formData.append("title", trimmedTitle);
		formData.append("targetRole", targetRole);
		formData.append("jobDescription", trimmedJD);
		formData.append("postDescription", trimmedAsk);
		formData.append("privacyMode", privacyMode);

		const response = await fetch("/api/resumes/submit", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
		const result = (await response.json().catch(() => null)) as { activationReviewsCompleted?: number; activationReviewsRequired?: number; id?: string; message?: string; reviewQueueStatus?: "active" | "waiting" } | null;
		setSubmitting(false);

		if (!response.ok || !result?.id) {
			const msg = result?.message ?? "Upload failed while processing the privacy-safe PDF.";
			setSubmitError(msg);
			toast.error("Upload failed.", { description: msg });
			return;
		}

		setSuccess(true);
		if (result.reviewQueueStatus === "waiting") {
			const remaining = Math.max((result.activationReviewsRequired ?? 2) - (result.activationReviewsCompleted ?? 0), 0);
			toast.success("Resume posted to the queue.", { description: remaining > 0 ? `Complete ${remaining} guided ${remaining === 1 ? "review" : "reviews"} to activate it faster.` : "Your resume is ready for community review." });
		} else {
			toast.success("Resume posted.");
		}
		window.setTimeout(() => { const r = `/resume/${result.id}`; announceRouteTransition(r); router.push(r); }, 500);
	}

	// Still loading existing resume check — render nothing yet
	if (existingResume === undefined) return null;

	// User already has a live resume — block the form
	if (existingResume !== null) {
		const isWaiting = existingResume.review_queue_status === "waiting";
		return (
			<div className={styles.existingResumeBlock}>
				<p className={styles.existingResumeTitle}>
					You already have a resume submitted.
				</p>
				<p className={styles.existingResumeBody}>
					{isWaiting
						? "It's in the review queue. Give 2 guided reviews to activate it in the feed."
						: "It's live in the feed. Delete it first if you want to submit a new one."}
				</p>
				<a href={`/resume/${existingResume.id}`} className={styles.existingResumeLink}>
					View your resume →
				</a>
			</div>
		);
	}

	return (
		<form className="submit-form submit-form-wide" noValidate onSubmit={handleSubmit}>
			<div className={styles.wizardBody}>
				<StepProgress current={currentStep} />

				{/* ── Left panel ── */}
				<div
					key={animKey}
					className={[styles.wizardLeft, direction === "forward" ? styles.enterForward : styles.enterBackward].join(" ")}
				>
					{/* Step 1 — Role */}
					{currentStep === 1 && (
						<div className={styles.stepFields}>
							<div className={styles.stepIntro}>
								<h3 className={styles.stepTitle}>Who are you chasing?</h3>
								<p className={styles.stepSub}>Pick the role closest to where you want to land.</p>
							</div>
							<fieldset className="field-block role-picker submit-role-field">
								<legend className="sr-only">Target role</legend>
								<div>
									{TARGET_ROLES.map((role) => (
										<button className={targetRole === role ? "selected" : ""} type="button" onClick={() => setTargetRole(role)} key={role}>
											{role}
										</button>
									))}
								</div>
							</fieldset>
						</div>
					)}

					{/* Step 2 — Context */}
					{currentStep === 2 && (
						<div className={styles.stepFields}>
							<div className={styles.stepIntro}>
								<h3 className={styles.stepTitle}>Set the battlefield.</h3>
								<p className={styles.stepSub}>Paste the JD. Write your ask. The right panel updates as you type.</p>
							</div>
							<div className={`field-block ${jdError ? styles.fieldHasError : ""}`}>
								<label htmlFor="submit-jd">Job description</label>
								<div className={styles.textareaWrap}>
									<textarea
										id="submit-jd"
										className="submit-context-textarea submit-jd-textarea"
										value={jobDescription}
										onChange={(e) => { setJobDescription(e.target.value); if (jdError) setJdError(false); }}
										maxLength={JOB_DESCRIPTION_MAX_LENGTH}
										placeholder="Paste the JD, responsibilities, requirements, and keywords."
										aria-invalid={jdError}
										autoFocus
									/>
									<span className={[styles.charCount, trimmedJD.length >= JOB_DESCRIPTION_MIN_LENGTH ? styles.charCountDone : trimmedJD.length > 0 ? styles.charCountWarn : ""].filter(Boolean).join(" ")}>
										{trimmedJD.length}/{JOB_DESCRIPTION_MIN_LENGTH}
									</span>
								</div>
								{jdError && <span className={styles.fieldError}>Need {JOB_DESCRIPTION_MIN_LENGTH - trimmedJD.length} more characters.</span>}
							</div>
							<div className={`field-block ${askError ? styles.fieldHasError : ""}`}>
								<label htmlFor="submit-ask">What do you need help with?</label>
								<div className={styles.textareaWrap}>
									<textarea
										id="submit-ask"
										className="submit-context-textarea submit-help-textarea"
										value={postDescription}
										onChange={(e) => { setPostDescription(e.target.value); if (askError) setAskError(false); }}
										maxLength={POST_DESCRIPTION_MAX_LENGTH}
										placeholder="ATS keywords, bullet strength, fit for this role…"
										aria-invalid={askError}
									/>
									<span className={[styles.charCount, trimmedAsk.length >= POST_DESCRIPTION_MIN_LENGTH ? styles.charCountDone : trimmedAsk.length > 0 ? styles.charCountWarn : ""].filter(Boolean).join(" ")}>
										{trimmedAsk.length}/{POST_DESCRIPTION_MIN_LENGTH}
									</span>
								</div>
								{askError && <span className={styles.fieldError}>Need {POST_DESCRIPTION_MIN_LENGTH - trimmedAsk.length} more characters.</span>}
							</div>
						</div>
					)}

					{/* Step 3 — Title + Privacy */}
					{currentStep === 3 && (
						<div className={styles.stepFields}>
							<div className={styles.stepIntro}>
								<h3 className={styles.stepTitle}>How do you want to show up?</h3>
								<p className={styles.stepSub}>Name your submission and set how much the world sees.</p>
							</div>
							<div className={`field-block ${titleError ? styles.fieldHasError : ""}`}>
								<label htmlFor="submit-title">Resume title</label>
								<input
									id="submit-title"
									value={title}
									onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }}
									maxLength={120}
									placeholder="Backend internship resume"
									aria-invalid={titleError}
									autoFocus
								/>
								{titleError && <span className={styles.fieldError}>Give your resume a title.</span>}
							</div>
							<fieldset className={styles.privacyPicker}>
								<legend>Privacy</legend>
								<div className={styles.privacyOptions}>
									{RESUME_PRIVACY_MODES.map((mode) => (
										<label className={[styles.optionCard, privacyMode === mode ? styles.optionCardSelected : ""].filter(Boolean).join(" ")} key={mode}>
											<input checked={privacyMode === mode} name="privacyMode" onChange={() => setPrivacyMode(mode)} type="radio" />
											<span className={styles.optionBody}>
												<strong>{RESUME_PRIVACY_MODE_COPY[mode].label}</strong>
											</span>
										</label>
									))}
								</div>
							</fieldset>
						</div>
					)}

					{/* Step 4 — Plan */}
					{currentStep === 4 && (
						<div className={styles.stepFields}>
							<div className={styles.stepIntro}>
								<h3 className={styles.stepTitle}>Choose your review track.</h3>
								<p className={styles.stepSub}>Free gets you the community. Priority gets you a verified reviewer in 24 hours.</p>
							</div>
							<fieldset className={styles.planPicker}>
								<legend className="sr-only">Review plan</legend>
								<div className={styles.planOptions}>
									<label className={[styles.optionCard, reviewPlan === "community" ? styles.optionCardSelected : ""].filter(Boolean).join(" ")}>
										<input checked={reviewPlan === "community"} name="reviewPlan" onChange={() => setReviewPlan("community")} type="radio" />
										<span className={styles.optionBody}>
											<strong>Community review</strong>
											<span className={styles.planBadgeFree}>Free</span>
										</span>
									</label>
									<label className={[styles.optionCard, styles.optionCardDisabled].filter(Boolean).join(" ")}>
										<input disabled name="reviewPlan" type="radio" value="priority" />
										<span className={styles.optionBody}>
											<strong>Priority review</strong>
											<span className={styles.planBadgeComingSoon}>Coming soon</span>
										</span>
									</label>
								</div>
							</fieldset>
						</div>
					)}

					{/* Step 5 — Upload */}
					{currentStep === 5 && (
						<div className={styles.stepFields}>
							<div className={styles.stepIntro}>
								<h3 className={styles.stepTitle}>Drop your resume.</h3>
								<p className={styles.stepSub}>PDF only, under 5 MB. Scanned for contact details the moment it lands.</p>
							</div>
							<div className="field-block submit-upload-field">
								<span>Resume PDF</span>
								<FileUpload accept=".pdf,application/pdf" className="submit-file-upload" files={uploadFiles} maxCount={1} maxSize={5} onFileSelect={handleFileSelect} onFileSelectChange={handleFileSelectChange} onRemove={clearSelectedFile}>
									{!file && <DropZone browseText="or click to browse" className="submit-pdf-dropzone" prompt="Drop your PDF here" />}
									<FileError />
									<FileList canRemove className="submit-file-list" onClear={clearSelectedFile} onRemove={clearSelectedFile} showHeader={false} />
								</FileUpload>
								{file ? (
									<div className={`privacy-check privacy-check-${privacyScan.status}`}>
										<div>
											<strong>Privacy check</strong>
											<span>{privacyScan.message}</span>
										</div>
										{privacyScan.findings.length ? (
											<ul>{privacyScan.findings.map((f) => <li key={f.type}>{f.label}{f.count > 1 ? ` x${f.count}` : ""}</li>)}</ul>
										) : null}
									</div>
								) : null}
							</div>
							{submitError && <p className={styles.submitError}>{submitError}</p>}
						</div>
					)}

					{/* Navigation */}
					<div className={styles.wizardNav}>
						<div className={styles.wizardNavRow}>
							{currentStep > 1 ? (
								<button type="button" className={styles.backButton} onClick={handleBack} disabled={submitting}>
									Back
								</button>
							) : <span />}
							{currentStep < TOTAL_STEPS ? (
								<button type="button" className={styles.nextButton} onClick={handleNext}>
									Continue
								</button>
							) : (
								<button type="submit" className={styles.nextButton} disabled={submitting || success}>
									{success ? "Posted. Redirecting…" : submitting ? <><span className="button-spinner" />{submitLabel ?? "Processing…"}</> : reviewPlan === "priority" ? `Pay ₹${PREMIUM_PRICE_RUPEES} & Submit` : "Submit for review"}
								</button>
							)}
						</div>
					</div>
				</div>

				{/* ── Right panel (scene) ── */}
				<div className={styles.wizardRight}>
					<div className={[styles.sceneWrap, currentStep === 1 ? styles.sceneVisible : styles.sceneHidden].join(" ")}><SceneRole active={currentStep === 1} /></div>
					<div className={[styles.sceneWrap, currentStep === 2 ? styles.sceneVisible : styles.sceneHidden].join(" ")}><SceneContext active={currentStep === 2} /></div>
					<div className={[styles.sceneWrap, currentStep === 3 ? styles.sceneVisible : styles.sceneHidden].join(" ")}><ScenePrivacy active={currentStep === 3} /></div>
					<div className={[styles.sceneWrap, currentStep === 4 ? styles.sceneVisible : styles.sceneHidden].join(" ")}><ScenePlan active={currentStep === 4} /></div>
					<div className={[styles.sceneWrap, currentStep === 5 ? styles.sceneVisible : styles.sceneHidden].join(" ")}><SceneUpload active={currentStep === 5} /></div>
				</div>
			</div>
		</form>
	);
}

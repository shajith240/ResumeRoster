"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import BrandMark from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
	ArrowRight,
	Search,
	ShieldCheck,
	Sparkles,
	type SolarIconComponent,
} from "@/components/ui/solar-icons";
import {
	ONBOARDING_GOALS,
	ONBOARDING_PERSONAS,
	getCommunityRoleForOnboardingGoal,
	getOnboardingDestination,
	getOnboardingIssue,
	isOnboardingGoalId,
	isOnboardingPersonaId,
	type OnboardingGoalId,
	type OnboardingPersonaId,
} from "@/lib/onboarding-validation";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	getUsernameAvailability,
	isUsernameConstraintError,
} from "@/components/profile-detail/utils";
import {
	PROFILE_FIELD_LIMITS,
	limitText,
	normalizeUsername,
} from "@/lib/profile-validation";
import { ensureActiveUserSession } from "@/lib/session-lock";
import { supabase } from "@/lib/supabase/client";
import styles from "./OnboardingFlow.module.css";

// ─── Scene definitions ────────────────────────────────────────────────────────

type Scene = {
	character: string;
	bubble: string;
	bg: string;
	orbA: string;
	orbB: string;
};

const STEP1_SCENES: Record<string, Scene> = {
	default: {
		character: "/assets/step1-arjun-welcoming.png",
		bubble: "Pick what you're here for — I'll set Linted up around you.",
		bg: "linear-gradient(158deg, #1e1b4b 0%, #2d2975 55%, #3730a3 100%)",
		orbA: "#6366f1",
		orbB: "#818cf8",
	},
	get_feedback: {
		character: "/assets/step2-hopeful-priya.png",
		bubble: "Let's find what's actually costing you callbacks.",
		bg: "linear-gradient(158deg, #042f2e 0%, #0a3b37 55%, #134e4a 100%)",
		orbA: "#0d9488",
		orbB: "#2dd4bf",
	},
	review_resumes: {
		character: "/assets/image2-arjun-confident.png",
		bubble: "Good. You'll spot things in 30 seconds that candidates miss for months.",
		bg: "linear-gradient(158deg, #2d1060 0%, #4a1c92 55%, #5b21b6 100%)",
		orbA: "#a855f7",
		orbB: "#c084fc",
	},
	both: {
		character: "/assets/step4.png",
		bubble: "The best reviewers were once the best candidates.",
		bg: "linear-gradient(158deg, #0a1628 0%, #1a3356 55%, #1e4080 100%)",
		orbA: "#3b82f6",
		orbB: "#60a5fa",
	},
};

const STEP2_BUBBLE: Record<string, string> = {
	get_feedback: "Last thing — who are you right now?",
	review_resumes: "What's your background? This shapes which resumes you see first.",
	both: "Last thing — who are you right now?",
	default: "Last thing — who are you right now?",
};

// Step 2 gets a separate character — Priya shifts to empathetic for the persona question
const STEP2_CHARACTER: Record<string, string> = {
	get_feedback: "/assets/image%204%20-priya-Empathetic.png",
	review_resumes: "/assets/image2-arjun-confident.png",
	both: "/assets/rohan-image2.png",
	default: "/assets/step1-arjun-welcoming.png",
};

// ─── First-person copy ────────────────────────────────────────────────────────

const GOAL_COPY: Record<OnboardingGoalId, { label: string; description: string }> = {
	get_feedback: {
		label: "I want feedback",
		description: "Show me what's holding my resume back.",
	},
	review_resumes: {
		label: "I want to review",
		description: "I can spot what candidates miss.",
	},
	both: {
		label: "I'm here for both",
		description: "My resume needs work and I've got opinions too.",
	},
};

const PERSONA_COPY: Record<OnboardingPersonaId, { label: string; description: string }> = {
	student: {
		label: "Student",
		description: "Internships, placements — I'm in that stage.",
	},
	job_seeker: {
		label: "Job seeker",
		description: "I'm applying right now. I need this to work.",
	},
	recruiter_hr: {
		label: "Recruiter / HR",
		description: "I screen resumes. I know what gets ignored.",
	},
	engineer: {
		label: "Engineer",
		description: "I know what strong technical proof looks like.",
	},
	product_manager: {
		label: "Product manager",
		description: "I think in outcomes. I know what impact means.",
	},
	career_coach: {
		label: "Career coach",
		description: "I help people tell their career story better.",
	},
	other: {
		label: "None of these yet",
		description: "I'm figuring it out — that's fine.",
	},
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const goalIcons: Record<OnboardingGoalId, SolarIconComponent> = {
	both: Sparkles,
	get_feedback: Search,
	review_resumes: ShieldCheck,
};

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 22) {
	const [count, setCount] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (intervalRef.current) clearInterval(intervalRef.current);
		setCount(0);

		const delay = setTimeout(() => {
			let i = 0;
			intervalRef.current = setInterval(() => {
				i++;
				setCount(i);
				if (i >= text.length && intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			}, speed);
		}, 160);

		return () => {
			clearTimeout(delay);
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [text, speed]);

	return { typed: text.slice(0, count), done: count >= text.length };
}

// ─── Error guard ──────────────────────────────────────────────────────────────

function isOnboardingMigrationError(error: { message?: string } | null) {
	return /complete_onboarding|profile_onboarding|onboarding_|schema cache|function|relation|does not exist|column reference|ambiguous/i.test(
		error?.message ?? "",
	);
}

// ─── Choice card ──────────────────────────────────────────────────────────────

function ChoiceCard({
	description,
	icon: Icon,
	isSelected,
	label,
	onSelect,
}: {
	description: string;
	icon: SolarIconComponent;
	isSelected: boolean;
	label: string;
	onSelect: () => void;
}) {
	return (
		<button
			aria-pressed={isSelected}
			className={styles.card}
			onClick={onSelect}
			type="button"
		>
			<span className={styles.cardIcon}>
				<Icon aria-hidden="true" size={18} />
			</span>
			<span className={styles.cardLabel}>{label}</span>
			<span className={styles.cardDesc}>{description}</span>
			{isSelected && <span aria-hidden="true" className={styles.cardCheck} />}
		</button>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingFlow() {
	const router = useRouter();
	const [step, setStep] = useState<1 | 2>(1);
	const [direction, setDirection] = useState<"forward" | "backward">("forward");
	const [goalId, setGoalId] = useState<OnboardingGoalId | "">("");
	const [personaId, setPersonaId] = useState<OnboardingPersonaId | "">("");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [charVisible, setCharVisible] = useState(true);

	// Step 2 profile fields
	const [username, setUsername] = useState("");
	const [originalUsername, setOriginalUsername] = useState("");
	const [aboutMe, setAboutMe] = useState("");
	const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
	const [usernameHint, setUsernameHint] = useState("");

	const sceneKey = goalId || "default";
	const step1Scene = STEP1_SCENES[sceneKey] ?? STEP1_SCENES.default;

	const bubbleText =
		step === 1
			? step1Scene.bubble
			: (STEP2_BUBBLE[sceneKey] ?? STEP2_BUBBLE.default);

	const characterSrc =
		step === 1
			? step1Scene.character
			: (STEP2_CHARACTER[sceneKey] ?? STEP2_CHARACTER.default);

	const { typed, done } = useTypewriter(bubbleText);

	// Debounced username availability check
	useEffect(() => {
		const normalized = normalizeUsername(username);
		if (!normalized || normalized.length < 3 || normalized === normalizeUsername(originalUsername)) {
			setUsernameStatus("idle");
			setUsernameHint("");
			return;
		}
		setUsernameStatus("checking");
		setUsernameHint("Checking…");
		let cancelled = false;
		const timeout = window.setTimeout(async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user || cancelled) return;
			try {
				const availability = await getUsernameAvailability(normalized, user.id);
				if (cancelled) return;
				if (availability.taken) {
					setUsernameStatus("taken");
					setUsernameHint("That username is taken.");
				} else {
					setUsernameStatus("available");
					setUsernameHint("Available ✓");
				}
			} catch {
				if (!cancelled) { setUsernameStatus("idle"); setUsernameHint(""); }
			}
		}, 600);
		return () => { cancelled = true; clearTimeout(timeout); };
	}, [username, originalUsername]);

	function swapCharacter(fn: () => void) {
		setCharVisible(false);
		setTimeout(() => {
			fn();
			setCharVisible(true);
		}, 220);
	}

	function handleGoalSelect(id: OnboardingGoalId) {
		setMessage("");
		swapCharacter(() => setGoalId(id));
	}

	async function goForward() {
		setMessage("");
		setDirection("forward");
		// Fetch current username/about to pre-fill step 2 fields
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from("profiles")
				.select("username, about")
				.eq("id", user.id)
				.single();
			if (profile) {
				setUsername(profile.username ?? "");
				setOriginalUsername(profile.username ?? "");
				setAboutMe(profile.about ?? "");
			}
		}
		swapCharacter(() => setStep(2));
	}

	function goBack() {
		setMessage("");
		setDirection("backward");
		setPersonaId("");
		swapCharacter(() => setStep(1));
	}

	async function exitToHome() {
		// Sign out so the landing page doesn't bounce an authenticated user back here.
		// Hard-navigate after so the browser skips any pending soft-route redirects.
		await supabase.auth.signOut();
		window.location.href = "/";
	}

	async function completeOnboarding() {
		const selectedGoal = isOnboardingGoalId(goalId) ? goalId : null;
		const selectedPersona = isOnboardingPersonaId(personaId) ? personaId : null;

		const issue = getOnboardingIssue({ goalId, personaId });
		if (issue) { setMessage(issue); return; }
		if (!selectedGoal || !selectedPersona) return;

		if (usernameStatus === "taken") { setMessage("That username is taken. Try another."); return; }
		if (usernameStatus === "checking") { setMessage("Username check in progress — wait a moment."); return; }

		setSubmitting(true);
		setMessage("");

		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			setSubmitting(false);
			setMessage("Sign in again before finishing onboarding.");
			return;
		}

		const sessionActive = await ensureActiveUserSession(user.id);
		if (!sessionActive) { setSubmitting(false); return; }

		// Save username + about to profile before completing onboarding
		const nextUsername = normalizeUsername(username).slice(0, PROFILE_FIELD_LIMITS.username).trim();
		const { error: profileError } = await supabase
			.from("profiles")
			.update({
				username: nextUsername || null,
				about: limitText(aboutMe, PROFILE_FIELD_LIMITS.about).trim() || null,
			})
			.eq("id", user.id);

		if (profileError) {
			setSubmitting(false);
			if (isUsernameConstraintError(profileError)) {
				setUsernameStatus("taken");
				setUsernameHint("That username is taken.");
				setMessage("That username is taken. Try another.");
			} else {
				setMessage("Could not save your profile. Try again.");
			}
			return;
		}

		const { error } = await supabase.rpc("complete_onboarding", {
			expertise_items: [],
			selected_goal_id: selectedGoal,
			selected_persona_id: selectedPersona,
			target_role_text: "",
		});

		setSubmitting(false);

		if (error) {
			if (isOnboardingMigrationError(error)) {
				setMessage("Profile setup is temporarily unavailable. Please refresh and try again.");
				return;
			}
			setMessage(error.message || "Could not finish onboarding. Try again.");
			return;
		}

		const communityRole = getCommunityRoleForOnboardingGoal(selectedGoal);
		toast.success("You're all set.", {
			description:
				communityRole === "candidate"
					? "Ready to post your first resume? It takes 3 minutes."
					: "Three resumes are waiting for your take. Start reviewing.",
		});
		router.replace(getOnboardingDestination(selectedGoal));
	}

	const cardGridClass = [
		styles.cardGrid,
		direction === "forward" ? styles.enterForward : styles.enterBackward,
	].join(" ");

	return (
		<main className="onboarding-route page-enter">
			{/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
			<section className={styles.shell} role="main" aria-label="Onboarding">
				{/* ── Full-width progress bar ── */}
				<div
					aria-label={`Step ${step} of 2`}
					aria-valuemax={2}
					aria-valuemin={1}
					aria-valuenow={step}
					className={styles.stepProgress}
					role="progressbar"
				>
					<div className={styles.stepProgressFill} style={{ width: personaId ? "100%" : goalId ? "50%" : "0%" }} />
				</div>

				{/* ── Left panel ── */}
				<div className={styles.left}>
					<header className={styles.header}>
						<Link className="auth-wordmark" href="/" aria-label="Linted home">
							<BrandMark />
						</Link>
					</header>

					<span className={styles.stepLabel}>Step {step} of 2</span>

					<div
						key={step}
						aria-label={step === 1 ? "Choose your goal" : "Choose your background"}
						className={cardGridClass}
						role="group"
					>
						{step === 1 &&
							ONBOARDING_GOALS.map((goal) => (
								<ChoiceCard
									key={goal.id}
									description={GOAL_COPY[goal.id].description}
									icon={goalIcons[goal.id]}
									isSelected={goalId === goal.id}
									label={GOAL_COPY[goal.id].label}
									onSelect={() => handleGoalSelect(goal.id)}
								/>
							))}

						{step === 2 && (
							<>
								{/* Role dropdown — all personas including "None of these yet" */}
								<Select
									value={personaId}
									onValueChange={(val) => {
										setPersonaId(val as OnboardingPersonaId);
										setMessage("");
									}}
								>
									<SelectTrigger className={styles.personaSelectTrigger}>
										<SelectValue placeholder="Pick your background…" />
									</SelectTrigger>
									<SelectContent className={styles.personaSelectContent}>
										{ONBOARDING_PERSONAS.map((persona) => (
											<SelectItem
												key={persona.id}
												value={persona.id}
												className={styles.personaSelectItem}
											>
												{PERSONA_COPY[persona.id].label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{/* Username */}
								<div className={styles.step2Field}>
									<div className={styles.step2FieldHeader}>
										<label className={styles.step2Label} htmlFor="ob-username">Username</label>
										<span className={styles.step2Count}>{normalizeUsername(username).length}/{PROFILE_FIELD_LIMITS.username}</span>
									</div>
									<div className={styles.step2InputWrap}>
										<span className={styles.step2AtSign}>@</span>
										<input
											autoComplete="username"
											className={styles.step2Input}
											id="ob-username"
											onChange={(e) => setUsername(normalizeUsername(limitText(e.target.value, PROFILE_FIELD_LIMITS.username)))}
											placeholder="your_handle"
											type="text"
											value={username}
										/>
									</div>
									{usernameHint && (
										<p className={[
											styles.step2FieldHint,
											usernameStatus === "taken" ? styles.step2FieldHintError : "",
											usernameStatus === "available" ? styles.step2FieldHintSuccess : "",
										].filter(Boolean).join(" ")}>
											{usernameHint}
										</p>
									)}
								</div>

								{/* About me */}
								<div className={styles.step2Field}>
									<div className={styles.step2FieldHeader}>
										<label className={styles.step2Label} htmlFor="ob-about">
											About me
											<span className={styles.step2LabelOptional}>(optional)</span>
										</label>
										<span className={styles.step2Count}>{aboutMe.length}/{PROFILE_FIELD_LIMITS.about}</span>
									</div>
									<textarea
										className={styles.step2Textarea}
										id="ob-about"
										maxLength={PROFILE_FIELD_LIMITS.about}
										onChange={(e) => setAboutMe(limitText(e.target.value, PROFILE_FIELD_LIMITS.about))}
										placeholder="A quick line about who you are and what you bring."
										rows={3}
										value={aboutMe}
									/>
								</div>
							</>
						)}
					</div>

					{message && (
						<p className={styles.message} role="alert">{message}</p>
					)}

					<footer className={styles.actions}>
						<Button
							onClick={step === 1 ? () => void exitToHome() : goBack}
							size="xl"
							type="button"
							variant="secondary"
						>
							Back
						</Button>

						{step === 1 && (
							<Button
								disabled={!isOnboardingGoalId(goalId)}
								onClick={goForward}
								size="xl"
								style={{ marginLeft: "auto" }}
								type="button"
								variant="brand"
							>
								<span>Continue</span>
								<ArrowRight aria-hidden="true" size={16} />
							</Button>
						)}

						{step === 2 && (
							<Button
								disabled={
									submitting ||
									!isOnboardingPersonaId(personaId) ||
									usernameStatus === "checking" ||
									usernameStatus === "taken"
								}
								onClick={() => void completeOnboarding()}
								size="xl"
								style={{ marginLeft: "auto" }}
								type="button"
								variant="brand"
							>
								<span>{submitting ? "Setting up..." : "Enter Linted"}</span>
								<ArrowRight aria-hidden="true" size={16} />
							</Button>
						)}
					</footer>
				</div>

				{/* ── Right panel — character scene ── */}
				<div
					aria-hidden="true"
					className={styles.right}
					style={{
						background: step1Scene.bg,
						"--orbA": step1Scene.orbA,
						"--orbB": step1Scene.orbB,
					} as React.CSSProperties}
				>
					<div className={styles.orb} />

					<div className={styles.bubble}>
						<p className={styles.bubbleText}>
							{typed}
							<span className={`${styles.cursor} ${done ? styles.cursorHidden : ""}`}>|</span>
						</p>
					</div>

					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						alt=""
						className={`${styles.character} ${!charVisible ? styles.characterHidden : ""}`}
						src={characterSrc}
					/>
				</div>
			</section>
		</main>
	);
}

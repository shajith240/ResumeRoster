"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ArrowRight,
	BriefcaseBusiness,
	Check,
	GraduationCap,
	Handshake,
	Search,
	ShieldCheck,
	Sparkles,
	UsersRound,
	X,
	type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import InfoHint from "@/components/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ONBOARDING_GOALS,
	ONBOARDING_PERSONAS,
	getCommunityRoleForOnboardingGoal,
	getOnboardingDestination,
	getOnboardingIssue,
	getReviewerTypeForOnboarding,
	isOnboardingGoalId,
	isOnboardingPersonaId,
	normalizeOnboardingTargetRole,
	parseOnboardingExpertise,
	type OnboardingGoalId,
	type OnboardingPersonaId,
} from "@/lib/onboarding-validation";
import { SKILL_OPTIONS } from "@/lib/profile-validation";
import { ensureActiveUserSession } from "@/lib/session-lock";
import { supabase } from "@/lib/supabase/client";

const REVIEWER_EXPERTISE_OPTIONS = Array.from(
	new Set([
		"ATS",
		"Recruiter Screen",
		"Behavioral Interviews",
		"System Design",
		"Frontend",
		"Backend",
		"Data",
		"Design",
		"Product",
		"Career Switchers",
		"Internships",
		"Portfolio Review",
		...SKILL_OPTIONS,
	]),
);

const goalIcons: Record<OnboardingGoalId, LucideIcon> = {
	both: Sparkles,
	get_feedback: Search,
	review_resumes: ShieldCheck,
};

const personaIcons: Record<OnboardingPersonaId, LucideIcon> = {
	career_coach: Handshake,
	career_switcher: ArrowRight,
	designer: Sparkles,
	engineer: BriefcaseBusiness,
	founder: BriefcaseBusiness,
	hiring_manager: UsersRound,
	job_seeker: Search,
	new_grad: GraduationCap,
	other: UsersRound,
	product_manager: BriefcaseBusiness,
	recruiter_hr: ShieldCheck,
	student: GraduationCap,
};

function isOnboardingMigrationError(error: { message?: string } | null) {
	return /complete_onboarding|profile_onboarding|onboarding_|schema cache|function|relation|does not exist|column reference|ambiguous/i.test(
		error?.message ?? "",
	);
}

export default function OnboardingFlow() {
	const router = useRouter();
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [goalId, setGoalId] = useState<OnboardingGoalId | "">("");
	const [personaId, setPersonaId] = useState<OnboardingPersonaId | "">("");
	const [targetRole, setTargetRole] = useState("");
	const [expertiseInput, setExpertiseInput] = useState("");
	const [expertiseQuery, setExpertiseQuery] = useState("");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const selectedGoal = isOnboardingGoalId(goalId) ? goalId : null;
	const selectedPersona = isOnboardingPersonaId(personaId) ? personaId : null;
	const communityRole = selectedGoal
		? getCommunityRoleForOnboardingGoal(selectedGoal)
		: "candidate";
	const showCandidateSetup = communityRole === "candidate" || communityRole === "both";
	const showReviewerSetup = communityRole === "reviewer" || communityRole === "both";
	const selectedExpertise = useMemo(
		() => parseOnboardingExpertise(expertiseInput),
		[expertiseInput],
	);
	const selectedExpertiseKeys = useMemo(
		() => new Set(selectedExpertise.map((skill) => skill.toLowerCase())),
		[selectedExpertise],
	);
	const normalizedExpertiseQuery = expertiseQuery.trim().replace(/\s+/g, " ");
	const expertiseSuggestions = useMemo(() => {
		const query = normalizedExpertiseQuery.toLowerCase();

		return REVIEWER_EXPERTISE_OPTIONS.filter((skill) => {
			const key = skill.toLowerCase();
			return !selectedExpertiseKeys.has(key) && (!query || key.includes(query));
		}).slice(0, 7);
	}, [normalizedExpertiseQuery, selectedExpertiseKeys]);
	const canAddCustomExpertise =
		normalizedExpertiseQuery.length >= 2 &&
		normalizedExpertiseQuery.length <= 32 &&
		selectedExpertise.length < 12 &&
		!selectedExpertiseKeys.has(normalizedExpertiseQuery.toLowerCase()) &&
		!REVIEWER_EXPERTISE_OPTIONS.some(
			(skill) => skill.toLowerCase() === normalizedExpertiseQuery.toLowerCase(),
		);

	function addExpertise(skill: string) {
		const nextSkill = skill.trim().replace(/\s+/g, " ");
		if (
			nextSkill.length < 2 ||
			nextSkill.length > 32 ||
			selectedExpertiseKeys.has(nextSkill.toLowerCase()) ||
			selectedExpertise.length >= 12
		) {
			return;
		}

		setExpertiseInput([...selectedExpertise, nextSkill].join(", "));
		setExpertiseQuery("");
	}

	function removeExpertise(skill: string) {
		setExpertiseInput(
			selectedExpertise
				.filter((item) => item.toLowerCase() !== skill.toLowerCase())
				.join(", "),
		);
	}

	function handleExpertiseKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
			addExpertise(expertiseSuggestions[0] ?? normalizedExpertiseQuery);
			return;
		}

		if (event.key === "Backspace" && !expertiseQuery && selectedExpertise.length) {
			setExpertiseInput(selectedExpertise.slice(0, -1).join(", "));
		}
	}

	function goNext() {
		setMessage("");

		if (step === 1) {
			if (!selectedGoal) {
				setMessage("Choose what you want to do on Linted.");
				return;
			}

			setStep(2);
			return;
		}

		if (step === 2) {
			if (!selectedPersona) {
				setMessage("Choose the option that best describes you.");
				return;
			}

			setStep(3);
		}
	}

	async function completeOnboarding() {
		const issue = getOnboardingIssue({ goalId, personaId });
		if (issue) {
			setMessage(issue);
			return;
		}

		if (!selectedGoal || !selectedPersona) return;

		setSubmitting(true);
		setMessage("");

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			setSubmitting(false);
			setMessage("Sign in again before finishing onboarding.");
			return;
		}

		const sessionActive = await ensureActiveUserSession(user.id);
		if (!sessionActive) {
			setSubmitting(false);
			return;
		}

		const { error } = await supabase.rpc("complete_onboarding", {
			expertise_items: showReviewerSetup ? selectedExpertise : [],
			selected_goal_id: selectedGoal,
			selected_persona_id: selectedPersona,
			target_role_text: showCandidateSetup
				? normalizeOnboardingTargetRole(targetRole)
				: "",
		});

		setSubmitting(false);

		if (error) {
			if (isOnboardingMigrationError(error)) {
				setMessage("Run the pending Supabase migration, then refresh.");
				return;
			}

			setMessage(error.message || "Could not finish onboarding. Try again.");
			return;
		}

		const reviewerType = getReviewerTypeForOnboarding(selectedGoal, selectedPersona);
		const communityRole = getCommunityRoleForOnboardingGoal(selectedGoal);

		toast.success("Linted is personalized.", {
			description:
				communityRole === "candidate"
					? "You can still review any open resume whenever you want."
					: reviewerType
						? "You can review any open resume and update your profile later."
						: "You can review any open resume and update your profile later.",
		});
		router.replace(getOnboardingDestination(selectedGoal));
	}

	return (
		<main className="onboarding-route page-enter">
			<section className="onboarding-shell" aria-labelledby="onboarding-title">
				<header className="onboarding-header">
					<Link className="auth-wordmark" href="/" aria-label="Linted home">
						Linted
					</Link>
					<div className="onboarding-progress" aria-label="Onboarding progress">
						{[1, 2, 3].map((item) => (
							<span
								aria-current={step === item ? "step" : undefined}
								className={step >= item ? "is-active" : ""}
								key={item}
							/>
						))}
					</div>
				</header>

				<div className="onboarding-copy">
					<span>Step {step} of 3</span>
					<h1 id="onboarding-title">
						{step === 1
							? "Set your Linted path"
							: step === 2
								? "Tell us your lens"
								: "Make your first screen useful"}
						<InfoHint align="right">
							{step === 1
								? "This only personalizes your starting point. Anyone can still review any open resume."
								: step === 2
									? "Choose the closest fit so Linted can show the right cues, not lock you into a box."
									: "Add one or two useful defaults now. The full profile editor stays available later."}
						</InfoHint>
					</h1>
				</div>

				{step === 1 ? (
					<div className="onboarding-card-grid onboarding-goal-grid">
						{ONBOARDING_GOALS.map((goal) => {
							const Icon = goalIcons[goal.id];
							const isSelected = goalId === goal.id;

							return (
								<button
									aria-pressed={isSelected}
									className="onboarding-choice-card"
									key={goal.id}
									onClick={() => {
										setGoalId(goal.id);
										setMessage("");
									}}
									type="button"
								>
									<span className="onboarding-choice-icon">
										<Icon aria-hidden="true" />
									</span>
									<strong className="info-row">
										{goal.label}
										<InfoHint align="right" focusable={false}>
											{goal.description}
										</InfoHint>
									</strong>
									{isSelected ? <Check aria-hidden="true" /> : null}
								</button>
							);
						})}
					</div>
				) : null}

				{step === 2 ? (
					<div className="onboarding-card-grid onboarding-persona-grid">
						{ONBOARDING_PERSONAS.map((persona) => {
							const Icon = personaIcons[persona.id];
							const isSelected = personaId === persona.id;

							return (
								<button
									aria-pressed={isSelected}
									className="onboarding-choice-card"
									key={persona.id}
									onClick={() => {
										setPersonaId(persona.id);
										setMessage("");
									}}
									type="button"
								>
									<span className="onboarding-choice-icon">
										<Icon aria-hidden="true" />
									</span>
									<strong className="info-row">
										{persona.label}
										<InfoHint align="right" focusable={false}>
											{persona.description}
										</InfoHint>
									</strong>
									{isSelected ? <Check aria-hidden="true" /> : null}
								</button>
							);
						})}
					</div>
				) : null}

				{step === 3 ? (
					<div className="onboarding-setup-panel">
						{showCandidateSetup ? (
							<div className="onboarding-field">
								<Label htmlFor="onboarding-target-role">Target role</Label>
								<div className="onboarding-input-wrap">
									<BriefcaseBusiness aria-hidden="true" />
									<Input
										id="onboarding-target-role"
										maxLength={64}
										onChange={(event) => setTargetRole(event.target.value)}
										placeholder="Frontend engineer, data analyst, product intern..."
										value={targetRole}
									/>
								</div>
							</div>
						) : null}

						{showReviewerSetup ? (
							<div className="onboarding-field">
								<div className="onboarding-field-row">
									<Label htmlFor="onboarding-expertise">Review expertise</Label>
									<span>{selectedExpertise.length}/12</span>
								</div>
								<div className="onboarding-skill-editor">
									<div className="onboarding-selected-skills">
										{selectedExpertise.length ? (
											selectedExpertise.map((skill) => (
												<button
													aria-label={`Remove ${skill}`}
													key={skill}
													onClick={() => removeExpertise(skill)}
													type="button"
												>
													{skill}
													<X aria-hidden="true" />
												</button>
											))
										) : (
											<span>Pick topics you can review well.</span>
										)}
									</div>
									<div className="onboarding-input-wrap">
										<Search aria-hidden="true" />
										<Input
											id="onboarding-expertise"
											maxLength={32}
											onChange={(event) => setExpertiseQuery(event.target.value)}
											onKeyDown={handleExpertiseKeyDown}
											placeholder="ATS, React, recruiter screens..."
											value={expertiseQuery}
										/>
									</div>
									<div className="onboarding-suggestions">
										{canAddCustomExpertise ? (
											<button
												onClick={() => addExpertise(normalizedExpertiseQuery)}
												type="button"
											>
												Add "{normalizedExpertiseQuery}"
											</button>
										) : null}
										{expertiseSuggestions.map((skill) => (
											<button
												disabled={selectedExpertise.length >= 12}
												key={skill}
												onClick={() => addExpertise(skill)}
												type="button"
											>
												{skill}
											</button>
										))}
									</div>
								</div>
							</div>
						) : null}

						<div className="onboarding-note">
							<UsersRound aria-hidden="true" />
							<strong className="info-row">
								Open reviewing stays on
								<InfoHint align="right">
									This setup changes recommendations and profile cues only.
									Review access stays open to every signed-in user.
								</InfoHint>
							</strong>
						</div>
					</div>
				) : null}

				{message ? (
					<p className="onboarding-message" role="alert">
						{message}
					</p>
				) : null}

				<footer className="onboarding-actions">
					<Button
						disabled={step === 1 || submitting}
						onClick={() => {
							setMessage("");
							setStep((current) => (current === 3 ? 2 : 1));
						}}
						type="button"
						variant="outline"
					>
						Back
					</Button>
					<Button
						className="onboarding-primary"
						disabled={submitting}
						onClick={step === 3 ? () => void completeOnboarding() : goNext}
						type="button"
					>
						<span>
							{step === 3
								? submitting
									? "Personalizing..."
									: "Enter Linted"
								: "Continue"}
						</span>
						<ArrowRight aria-hidden="true" />
					</Button>
				</footer>
			</section>
		</main>
	);
}

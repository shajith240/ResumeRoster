"use client";

import {
	type KeyboardEvent,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ArrowRightIcon,
	BriefcaseIcon,
	GraduationCapIcon,
	SearchIcon,
	ShieldIcon,
	SparklesIcon,
	UsersIcon,
	type SidebarAnimatedIconComponent,
	type SidebarAnimatedIconHandle,
} from "@/components/ui/sidebar-icons";
import {
	ONBOARDING_GOALS,
	ONBOARDING_PERSONAS,
	getCommunityRoleForOnboardingGoal,
	getOnboardingDestination,
	getOnboardingIssue,
	getReviewerTypeForOnboarding,
	isOnboardingGoalId,
	isOnboardingPersonaId,
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
const REVIEWER_EXPERTISE_LIMIT = 6;

const goalIcons: Record<OnboardingGoalId, SidebarAnimatedIconComponent> = {
	both: SparklesIcon,
	get_feedback: SearchIcon,
	review_resumes: ShieldIcon,
};

const personaIcons: Record<OnboardingPersonaId, SidebarAnimatedIconComponent> = {
	career_coach: UsersIcon,
	engineer: BriefcaseIcon,
	job_seeker: SearchIcon,
	other: ArrowRightIcon,
	product_manager: SparklesIcon,
	recruiter_hr: ShieldIcon,
	student: GraduationCapIcon,
};

function isOnboardingMigrationError(error: { message?: string } | null) {
	return /complete_onboarding|profile_onboarding|onboarding_|schema cache|function|relation|does not exist|column reference|ambiguous/i.test(
		error?.message ?? "",
	);
}

function OnboardingChoiceCard({
	children,
	description,
	icon: Icon,
	isSelected,
	label,
	onSelect,
}: {
	children?: ReactNode;
	description: string;
	icon: SidebarAnimatedIconComponent;
	isSelected: boolean;
	label: string;
	onSelect: () => void;
}) {
	const iconRef = useRef<SidebarAnimatedIconHandle>(null);

	function startIconAnimation() {
		iconRef.current?.startAnimation();
	}

	function stopIconAnimation() {
		iconRef.current?.stopAnimation();
	}

	return (
		<Button
			aria-pressed={isSelected}
			className="onboarding-choice-card"
			onBlur={stopIconAnimation}
			onClick={onSelect}
			onFocus={startIconAnimation}
			onMouseEnter={startIconAnimation}
			onMouseLeave={stopIconAnimation}
			type="button"
			variant="ghost"
		>
			<span className="onboarding-choice-icon">
				<Icon ref={iconRef} aria-hidden="true" size={20} />
			</span>
			<strong>{label}</strong>
			<span>{description}</span>
			{children}
			{isSelected ? <span className="onboarding-choice-check" /> : null}
		</Button>
	);
}

export default function OnboardingFlow() {
	const router = useRouter();
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [goalId, setGoalId] = useState<OnboardingGoalId | "">("");
	const [personaId, setPersonaId] = useState<OnboardingPersonaId | "">("");
	const [expertiseInput, setExpertiseInput] = useState("");
	const [expertiseQuery, setExpertiseQuery] = useState("");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const selectedGoal = isOnboardingGoalId(goalId) ? goalId : null;
	const selectedPersona = isOnboardingPersonaId(personaId) ? personaId : null;
	const communityRole = selectedGoal
		? getCommunityRoleForOnboardingGoal(selectedGoal)
		: "candidate";
	const showReviewerSetup = communityRole === "reviewer" || communityRole === "both";
	const totalSteps = showReviewerSetup ? 3 : 2;
	const isFinalStep = step === totalSteps;
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
		selectedExpertise.length < REVIEWER_EXPERTISE_LIMIT &&
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
			selectedExpertise.length >= REVIEWER_EXPERTISE_LIMIT
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

			if (showReviewerSetup) {
				setStep(3);
				return;
			}

			void completeOnboarding();
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
			target_role_text: "",
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
						{Array.from({ length: totalSteps }, (_, index) => index + 1).map((item) => (
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
								: "Add review areas"}
					</h1>
					<p>
						{step === 1
							? "This only personalizes your starting point. Anyone can still review any open resume."
							: step === 2
								? "Choose the closest fit so Linted can show the right cues, not lock you into a box."
								: "Optional topics that appear on your reviewer profile and help route better matches later."}
					</p>
				</div>

				{step === 1 ? (
					<div className="onboarding-card-grid onboarding-goal-grid">
						{ONBOARDING_GOALS.map((goal) => {
							const Icon = goalIcons[goal.id];
							const isSelected = goalId === goal.id;

							return (
								<OnboardingChoiceCard
									description={goal.description}
									icon={Icon}
									isSelected={isSelected}
									key={goal.id}
									label={goal.label}
									onSelect={() => {
										setGoalId(goal.id);
										setMessage("");
									}}
								/>
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
								<OnboardingChoiceCard
									description={persona.description}
									icon={Icon}
									isSelected={isSelected}
									key={persona.id}
									label={persona.label}
									onSelect={() => {
										setPersonaId(persona.id);
										setMessage("");
									}}
								/>
							);
						})}
					</div>
				) : null}

				{step === 3 && showReviewerSetup ? (
					<div className="onboarding-setup-panel">
						<div className="onboarding-field">
							<div className="onboarding-field-row">
								<div>
									<Label htmlFor="onboarding-expertise">Review areas</Label>
									<p className="onboarding-field-hint">
										Shown on your reviewer profile.
									</p>
								</div>
								<span>
									{selectedExpertise.length}/{REVIEWER_EXPERTISE_LIMIT}
								</span>
							</div>
							<div className="onboarding-skill-editor">
								<div className="onboarding-selected-skills">
									{selectedExpertise.length ? (
										selectedExpertise.map((skill) => (
											<Button
												aria-label={`Remove ${skill}`}
												className="onboarding-selected-skill"
												key={skill}
												onClick={() => removeExpertise(skill)}
												type="button"
												variant="outline"
											>
												{skill}
												<X aria-hidden="true" />
											</Button>
										))
									) : (
										<span>Choose up to 6 topics you can review well.</span>
									)}
								</div>
								<div className="onboarding-input-wrap">
									<SearchIcon
										aria-hidden="true"
										className="onboarding-field-icon"
										size={17}
									/>
									<Input
										id="onboarding-expertise"
										maxLength={32}
										onChange={(event) => setExpertiseQuery(event.target.value)}
										onKeyDown={handleExpertiseKeyDown}
										placeholder="ATS, backend, recruiter screens..."
										value={expertiseQuery}
									/>
								</div>
								<div className="onboarding-suggestions">
									{canAddCustomExpertise ? (
										<Button
											className="onboarding-suggestion-button"
											onClick={() => addExpertise(normalizedExpertiseQuery)}
											type="button"
											variant="outline"
										>
											Add "{normalizedExpertiseQuery}"
										</Button>
									) : null}
									{expertiseSuggestions.map((skill) => (
										<Button
											className="onboarding-suggestion-button"
											disabled={
												selectedExpertise.length >= REVIEWER_EXPERTISE_LIMIT
											}
											key={skill}
											onClick={() => addExpertise(skill)}
											type="button"
											variant="outline"
										>
											{skill}
										</Button>
									))}
								</div>
							</div>
						</div>

						<div className="onboarding-note">
							<ShieldIcon
								aria-hidden="true"
								className="onboarding-note-icon"
								size={18}
							/>
							<p>
								You can leave this blank and still review any open resume.
							</p>
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
						size="xl"
						type="button"
						variant="secondary"
					>
						Back
					</Button>
					<Button
						disabled={submitting}
						onClick={isFinalStep ? () => void completeOnboarding() : goNext}
						size="xl"
						type="button"
						variant="brand"
					>
						<span>
							{isFinalStep
								? submitting
									? "Personalizing..."
									: "Enter Linted"
								: "Continue"}
						</span>
						<ArrowRightIcon aria-hidden="true" size={16} />
					</Button>
				</footer>
			</section>
		</main>
	);
}

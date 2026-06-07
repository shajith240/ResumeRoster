"use client";

import {
	type ReactNode,
	useRef,
	useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import BrandMark from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
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
} from "@/components/navigation/sidebar-icons";
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
import { ensureActiveUserSession } from "@/lib/session-lock";
import { supabase } from "@/lib/supabase/client";

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
	const [step, setStep] = useState<1 | 2>(1);
	const [goalId, setGoalId] = useState<OnboardingGoalId | "">("");
	const [personaId, setPersonaId] = useState<OnboardingPersonaId | "">("");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const selectedGoal = isOnboardingGoalId(goalId) ? goalId : null;
	const selectedPersona = isOnboardingPersonaId(personaId) ? personaId : null;
	const totalSteps = 2;
	const isFinalStep = step === totalSteps;

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

		toast.success("Linted is personalized.", {
			description:
				communityRole === "candidate"
					? "You can still review any open resume whenever you want."
					: "You can review any open resume whenever you want.",
		});
		router.replace(getOnboardingDestination(selectedGoal));
	}

	return (
		<main className="onboarding-route page-enter">
			<section className="onboarding-shell" aria-labelledby="onboarding-title">
				<header className="onboarding-header">
					<Link className="auth-wordmark" href="/" aria-label="Linted home">
						<BrandMark />
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
					<span>
						Step {step} of {totalSteps}
					</span>
					<h1 id="onboarding-title">
						{step === 1
							? "Set your Linted path"
							: "Tell us your lens"}
					</h1>
					<p>
						{step === 1
							? "This only personalizes your starting point. Anyone can still review any open resume."
							: "Choose the closest fit so Linted can show the right cues, not lock you into a box."}
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
							setStep(1);
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

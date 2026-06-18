"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase/client";
import type { ProfileOnboarding } from "@/lib/supabase/types";

const DISMISS_STORAGE_KEY = "linted-personalize-prompt-dismissed";

type PersonalizeLintedPromptProps = {
	disabled?: boolean;
};

function isOnboardingFeatureError(error: { message?: string } | null) {
	return /profile_onboarding|schema cache|relation|does not exist/i.test(
		error?.message ?? "",
	);
}

export default function PersonalizeLintedPrompt({
	disabled = false,
}: PersonalizeLintedPromptProps) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (disabled) return;
		if (window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1") return;

		let active = true;

		async function loadOnboardingState() {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!active || !user) return;

			const { data, error } = await supabase
				.from("profile_onboarding")
				.select("status")
				.eq("user_id", user.id)
				.maybeSingle();

			if (!active || error) {
				if (error && !isOnboardingFeatureError(error)) return;
				return;
			}

			if (
				(data as Pick<ProfileOnboarding, "status"> | null)?.status ===
				"not_required"
			) {
				setVisible(true);
			}
		}

		void loadOnboardingState();

		return () => {
			active = false;
		};
	}, [disabled]);

	if (!visible) return null;

	return (
		<section
			className="feed-welcome-card feed-personalize-card"
			aria-label="Personalize Linted"
		>
			<div>
				<span>Optional setup</span>
				<h2>Personalize your Linted feed</h2>
				<p>
					Tell us whether you are here to get feedback, review resumes, or both.
					It only changes guidance and profile defaults.
				</p>
			</div>
			<div className="feed-welcome-actions">
				<Link className="btn-primary" href="/onboarding">
					Personalize
				</Link>
				<button
					aria-label="Dismiss personalization prompt"
					className="feed-personalize-dismiss"
					onClick={() => {
						window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
						setVisible(false);
					}}
					type="button"
				>
					<X aria-hidden="true" />
				</button>
			</div>
		</section>
	);
}

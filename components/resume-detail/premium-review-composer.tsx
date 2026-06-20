"use client";

import { useState, type FormEvent } from "react";

type PremiumReviewComposerProps = {
	onSubmit: (fields: PremiumReviewFields) => void;
	submitting: boolean;
};

export type PremiumReviewFields = {
	overallRating: number;
	overallImpression: string;
	clarityFeedback: string;
	impactFeedback: string;
	skillsGap: string;
	topChanges: string;
};

const RATING_LABELS: Record<number, string> = {
	1: "Needs significant work",
	2: "Below average",
	3: "Average",
	4: "Good",
	5: "Excellent",
};

function StarRating({
	value,
	onChange,
	disabled,
}: {
	value: number;
	onChange: (v: number) => void;
	disabled: boolean;
}) {
	const [hovered, setHovered] = useState(0);
	const active = hovered || value;

	return (
		<div className="premium-review-stars" aria-label="Overall rating">
			{[1, 2, 3, 4, 5].map((n) => (
				<button
					aria-label={`${n} — ${RATING_LABELS[n] ?? ""}`}
					aria-pressed={value === n}
					className={`premium-review-star${n <= active ? " is-active" : ""}`}
					disabled={disabled}
					key={n}
					onClick={() => onChange(n)}
					onMouseEnter={() => setHovered(n)}
					onMouseLeave={() => setHovered(0)}
					type="button"
				>
					★
				</button>
			))}
			{active > 0 && (
				<span className="premium-review-star-label">{RATING_LABELS[active] ?? ""}</span>
			)}
		</div>
	);
}

const FIELDS: Array<{
	key: keyof Omit<PremiumReviewFields, "overallRating">;
	label: string;
	placeholder: string;
	minLength: number;
}> = [
	{
		key: "overallImpression",
		label: "Overall impression",
		placeholder: "Summarise your first impression — strengths, biggest gaps, and general fit for the target role.",
		minLength: 20,
	},
	{
		key: "clarityFeedback",
		label: "Clarity & formatting",
		placeholder: "Is the layout scannable? Are sections well-structured? Any formatting issues?",
		minLength: 10,
	},
	{
		key: "impactFeedback",
		label: "Impact statements — what's weak",
		placeholder: "Which bullet points bury the impact? Show what stronger versions would look like.",
		minLength: 10,
	},
	{
		key: "skillsGap",
		label: "Skills & keywords gap",
		placeholder: "What skills or keywords relevant to the JD are missing or underemphasised?",
		minLength: 10,
	},
	{
		key: "topChanges",
		label: "Top 3 actionable changes",
		placeholder: "List the three most impactful edits the candidate should make before their next application.",
		minLength: 10,
	},
];

export function PremiumReviewComposer({ onSubmit, submitting }: PremiumReviewComposerProps) {
	const [rating, setRating] = useState(0);
	const [fields, setFields] = useState<Omit<PremiumReviewFields, "overallRating">>({
		overallImpression: "",
		clarityFeedback: "",
		impactFeedback: "",
		skillsGap: "",
		topChanges: "",
	});

	const canSubmit =
		!submitting &&
		rating > 0 &&
		FIELDS.every((f) => fields[f.key].trim().length >= f.minLength);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSubmit) return;
		onSubmit({
			overallRating: rating,
			overallImpression: fields.overallImpression,
			clarityFeedback: fields.clarityFeedback,
			impactFeedback: fields.impactFeedback,
			skillsGap: fields.skillsGap,
			topChanges: fields.topChanges,
		});
	}

	return (
		<form className="premium-review-form" onSubmit={handleSubmit}>
			<div className="premium-review-header">
				<span className="badge premium-badge">Priority review</span>
				<p className="premium-review-desc">
					You are the assigned reviewer. Complete all five sections, then submit.
					Your review will be visible to the candidate and the community.
				</p>
			</div>

			<div className="premium-review-field">
				<label className="premium-review-label">Overall impression</label>
				<StarRating disabled={submitting} onChange={setRating} value={rating} />
				<textarea
					className="premium-review-textarea"
					disabled={submitting}
					maxLength={2000}
					minLength={20}
					onChange={(e) => setFields((f) => ({ ...f, overallImpression: e.target.value }))}
					placeholder={FIELDS[0].placeholder}
					required
					rows={4}
					value={fields.overallImpression}
				/>
			</div>

			{FIELDS.slice(1).map((f) => (
				<div className="premium-review-field" key={f.key}>
					<label className="premium-review-label">{f.label}</label>
					<textarea
						className="premium-review-textarea"
						disabled={submitting}
						maxLength={2000}
						minLength={f.minLength}
						onChange={(e) =>
							setFields((prev) => ({ ...prev, [f.key]: e.target.value }))
						}
						placeholder={f.placeholder}
						required
						rows={4}
						value={fields[f.key]}
					/>
				</div>
			))}

			<button
				className="btn-primary btn-brand premium-review-submit"
				disabled={!canSubmit}
				type="submit"
			>
				{submitting ? <><span className="button-spinner" /> Submitting...</> : "Submit premium review"}
			</button>
		</form>
	);
}

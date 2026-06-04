import type { FormEvent } from "react";
import { BadgeCheck, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	COMMUNITY_ROLES,
	REVIEWER_FIELD_LIMITS,
	REVIEWER_TYPES,
	getReviewerTypeLabel,
	isReviewerType,
} from "@/lib/reviewer-validation";
import type { CommunityRole, PublicProfile, ReviewerType } from "@/lib/supabase/types";
import styles from "../ProfileDetail.module.css";
import { FieldHeader } from "./shared";
import { getShortCommunityRoleLabel, limitLiveText } from "./utils";

export function ReviewerProfileDialog({
	buttonLabel,
	communityRole,
	onCommunityRoleChange,
	onOpenChange,
	onReviewerBioChange,
	onReviewerHeadlineChange,
	onReviewerTypeChange,
	onSave,
	open,
	reviewerBio,
	reviewerHeadline,
	reviewerType,
	saving,
}: {
	buttonLabel: string;
	communityRole: CommunityRole;
	onCommunityRoleChange: (value: CommunityRole) => void;
	onOpenChange: (value: boolean) => void;
	onReviewerBioChange: (value: string) => void;
	onReviewerHeadlineChange: (value: string) => void;
	onReviewerTypeChange: (value: ReviewerType | "") => void;
	onSave: (event: FormEvent<HTMLFormElement>) => void;
	open: boolean;
	reviewerBio: string;
	reviewerHeadline: string;
	reviewerType: ReviewerType | "";
	saving: boolean;
}) {
	const reviewerModeEnabled = communityRole !== "candidate";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					className={`${styles.trustApplyButton} ${styles.reviewerEditButton}`}
					type="button"
					variant="outline"
				>
					<Pencil aria-hidden="true" />
					{buttonLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className={styles.reviewerDialog}>
				<DialogHeader>
					<DialogTitle>Reviewer profile</DialogTitle>
					<DialogDescription>
						Choose how you want to appear when people read your reviews. This
						does not restrict who can review resumes.
					</DialogDescription>
				</DialogHeader>

				<form className={styles.reviewerDialogForm} onSubmit={onSave}>
					<section className={styles.reviewerEditBlock}>
						<div>
							<Label>I&apos;m here to</Label>
							<div className={styles.segmentedControl}>
								{COMMUNITY_ROLES.map((role) => (
									<button
										aria-pressed={communityRole === role}
										key={role}
										onClick={() => {
											onCommunityRoleChange(role);
											if (role !== "candidate" && !reviewerType) {
												onReviewerTypeChange("other");
											}
										}}
										type="button"
									>
										{getShortCommunityRoleLabel(role)}
									</button>
								))}
							</div>
						</div>

						{reviewerModeEnabled ? (
							<>
								<div>
									<FieldHeader htmlFor="reviewer-dialog-type">
										Reviewer role
									</FieldHeader>
									<Select
										onValueChange={(value) =>
											onReviewerTypeChange(isReviewerType(value) ? value : "")
										}
										value={reviewerType || "other"}
									>
										<SelectTrigger
											className={styles.highlightSelectTrigger}
											id="reviewer-dialog-type"
										>
											<SelectValue placeholder="Choose reviewer role" />
										</SelectTrigger>
										<SelectContent className={styles.highlightSelectContent}>
											<SelectGroup>
												{REVIEWER_TYPES.map((type) => (
													<SelectItem
														className={styles.highlightSelectItem}
														key={type}
														value={type}
													>
														{getReviewerTypeLabel(type)}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</div>

								<div>
									<FieldHeader
										htmlFor="reviewer-dialog-headline"
										max={REVIEWER_FIELD_LIMITS.headline}
										value={reviewerHeadline}
									>
										Reviewer headline
									</FieldHeader>
									<Input
										id="reviewer-dialog-headline"
										maxLength={REVIEWER_FIELD_LIMITS.headline}
										onChange={(event) =>
											onReviewerHeadlineChange(
												limitLiveText(
													event.target.value,
													REVIEWER_FIELD_LIMITS.headline,
												),
											)
										}
										placeholder="Recruiter screen feedback for early-career engineers"
										value={reviewerHeadline}
									/>
								</div>

								<div>
									<FieldHeader
										htmlFor="reviewer-dialog-bio"
										max={REVIEWER_FIELD_LIMITS.bio}
										value={reviewerBio}
									>
										Reviewer bio
									</FieldHeader>
									<textarea
										className={`${styles.editTextarea} ${styles.aboutTextarea}`}
										id="reviewer-dialog-bio"
										maxLength={REVIEWER_FIELD_LIMITS.bio}
										onChange={(event) =>
											onReviewerBioChange(
												limitLiveText(
													event.target.value,
													REVIEWER_FIELD_LIMITS.bio,
												),
											)
										}
										placeholder="Mention what resumes you can review well and how you give feedback."
										value={reviewerBio}
									/>
								</div>
							</>
						) : null}
					</section>

					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button disabled={saving} type="submit">
							<Upload data-icon="inline-start" aria-hidden="true" />
							{saving ? "Saving..." : "Save reviewer profile"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function TrustApplicationDialog({
	applicationNote,
	applying,
	onApply,
	onNoteChange,
	onProofUrlChange,
	proofUrl,
	reviewerVerificationStatus,
}: {
	applicationNote: string;
	applying: boolean;
	onApply: () => void;
	onNoteChange: (value: string) => void;
	onProofUrlChange: (value: string) => void;
	proofUrl: string;
	reviewerVerificationStatus: PublicProfile["reviewer_verification_status"];
}) {
	const buttonLabel =
		reviewerVerificationStatus === "pending"
			? "Update application"
			: reviewerVerificationStatus === "rejected"
				? "Reapply for trust"
				: "Apply for trust";
	const statusCopy =
		reviewerVerificationStatus === "pending"
			? "Your application is waiting for admin review. You can update the proof if something changed."
			: reviewerVerificationStatus === "rejected"
				? "Your last request was not approved. Add clearer proof before reapplying."
				: "Submit one public proof link so an admin can approve the trusted reviewer label.";

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className={`${styles.trustApplyButton} ${styles.trustApplicationButton}`}
					type="button"
					variant="outline"
				>
					<BadgeCheck aria-hidden="true" />
					{buttonLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className={styles.trustDialog}>
				<DialogHeader>
					<DialogTitle>Trusted reviewer application</DialogTitle>
					<DialogDescription>
						Verification is separate from profile editing. Your profile stays
						self-declared until an admin approves the proof.
					</DialogDescription>
				</DialogHeader>

				<div className={styles.trustDialogBody}>
					<div className={styles.trustStatusCard}>
						<BadgeCheck aria-hidden="true" />
						<div>
							<strong>Gold tick after approval</strong>
							<span>{statusCopy}</span>
						</div>
					</div>

					<div className={styles.trustField}>
						<Label htmlFor="trust-proof-url">Public proof link</Label>
						<Input
							id="trust-proof-url"
							maxLength={REVIEWER_FIELD_LIMITS.proofUrl}
							onChange={(event) => onProofUrlChange(event.target.value)}
							placeholder="LinkedIn, portfolio, GitHub, or work profile"
							value={proofUrl}
						/>
					</div>

					<div className={styles.trustField}>
						<div className={styles.fieldLabelRow}>
							<Label htmlFor="trust-application-note">Review note</Label>
							<span className={styles.fieldLimit}>
								{applicationNote.length}/
								{REVIEWER_FIELD_LIMITS.applicationNote}
							</span>
						</div>
						<textarea
							className={styles.editTextarea}
							id="trust-application-note"
							maxLength={REVIEWER_FIELD_LIMITS.applicationNote}
							onChange={(event) =>
								onNoteChange(
									limitLiveText(
										event.target.value,
										REVIEWER_FIELD_LIMITS.applicationNote,
									),
								)
							}
							placeholder="Briefly explain what proof this link shows."
							value={applicationNote}
						/>
					</div>
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button disabled={applying} onClick={onApply} type="button">
						<Upload data-icon="inline-start" aria-hidden="true" />
						{applying ? "Sending..." : buttonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

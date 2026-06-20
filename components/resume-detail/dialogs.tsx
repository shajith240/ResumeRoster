import type { FormEvent } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	REPORT_DETAILS_MAX_LENGTH,
	REPORT_REASON_OPTIONS,
	type ReportReason,
} from "@/lib/report-validation";
import type { Review } from "@/lib/supabase/types";
import type { ResumeOwnerAction } from "./types";

type ReportCommentDialogProps = {
	details: string;
	onDetailsChange: (value: string) => void;
	onOpenChange: (open: boolean) => void;
	onReasonChange: (value: ReportReason) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	reason: ReportReason;
	remainingCharacters: number;
	submitting: boolean;
	targetAuthorHandle: string;
	targetReview: Review | null;
};

export function ReportCommentDialog({
	details,
	onDetailsChange,
	onOpenChange,
	onReasonChange,
	onSubmit,
	reason,
	remainingCharacters,
	submitting,
	targetAuthorHandle,
	targetReview,
}: ReportCommentDialogProps) {
	return (
		<Dialog open={Boolean(targetReview)} onOpenChange={onOpenChange}>
			<DialogContent className="report-dialog-content">
				<DialogHeader>
					<DialogTitle>Report comment</DialogTitle>
					<DialogDescription>
						Send this to the moderation queue. Reports are private and help us
						keep feedback useful.
					</DialogDescription>
				</DialogHeader>
				<form className="report-form" onSubmit={onSubmit}>
					{targetReview ? (
						<div className="report-target-preview">
							<span>{targetAuthorHandle}</span>
							<p>{targetReview.content}</p>
						</div>
					) : null}
					<div className="report-reason-grid" aria-label="Report reason">
						{REPORT_REASON_OPTIONS.map((option) => (
							<button
								aria-pressed={reason === option.value}
								className={reason === option.value ? "is-selected" : ""}
								key={option.value}
								onClick={() => onReasonChange(option.value)}
								type="button"
							>
								<span>{option.label}</span>
								<small>{option.description}</small>
							</button>
						))}
					</div>
					<label className="report-details-field">
						<span>Context for moderators</span>
						<textarea
							maxLength={REPORT_DETAILS_MAX_LENGTH}
							onChange={(event) => onDetailsChange(event.target.value)}
							placeholder="Optional, unless you choose Other."
							rows={4}
							value={details}
						/>
					</label>
					<div className="report-form-meta">
						<span>{remainingCharacters} characters left</span>
					</div>
					<DialogFooter>
						<Button
							disabled={submitting}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button className="btn-brand" disabled={submitting} type="submit">
							{submitting ? "Sending..." : "Send report"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

type ResumeOwnerActionDialogProps = {
	busy: boolean;
	copy: {
		action: string;
		description: string;
		title: string;
	};
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	pendingAction: ResumeOwnerAction | null;
};

export function ResumeOwnerActionDialog({
	busy,
	copy,
	onConfirm,
	onOpenChange,
	pendingAction,
}: ResumeOwnerActionDialogProps) {
	return (
		<AlertDialog open={Boolean(pendingAction)} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>{copy.title}</AlertDialogTitle>
					<AlertDialogDescription>{copy.description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{busy ? "Working..." : copy.action}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

type RefundRequestDialogProps = {
	busy: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function RefundRequestDialog({
	busy,
	onConfirm,
	onOpenChange,
	open,
}: RefundRequestDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>Request refund?</AlertDialogTitle>
					<AlertDialogDescription>
						No reviewer has been assigned yet. Your ₹399 payment will be returned
						within 5–7 business days. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{busy ? "Requesting..." : "Request refund"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

type DeleteReviewDialogProps = {
	busy: boolean;
	isReply: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	targetReview: Review | null;
};

export function DeleteReviewDialog({
	busy,
	isReply,
	onConfirm,
	onOpenChange,
	targetReview,
}: DeleteReviewDialogProps) {
	return (
		<AlertDialog open={Boolean(targetReview)} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isReply ? "Delete reply?" : "Delete comment?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isReply
							? "This reply will be removed from the thread. The rest of the conversation will stay visible."
							: "This comment will be removed. Replies from other users will stay visible so the thread still makes sense."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{busy ? "Deleting..." : isReply ? "Delete reply" : "Delete comment"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

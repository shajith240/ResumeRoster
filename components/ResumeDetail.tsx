"use client";

import { getResumePosterLabel } from "@/lib/resume-display";
import { REPORT_DETAILS_MAX_LENGTH } from "@/lib/report-validation";
import { ResumeContextCard } from "./resume-detail/content";
import { DeleteReviewDialog, RefundRequestDialog, ReportCommentDialog, ResumeOwnerActionDialog } from "./resume-detail/dialogs";
import { DiscussionPanel } from "./resume-detail/discussion-panel";
import { ResumePreviewPane } from "./resume-detail/resume-preview-pane";
import { ResumeDetailSkeleton } from "./resume-detail/ResumeDetailSkeleton";
import type { ResumeDetailProps } from "./resume-detail/types";
import { useResumeDetailController } from "./resume-detail/use-resume-detail-controller";
import { getAuthorHandle } from "./resume-detail/utils";

export default function ResumeDetail({ resumeId }: ResumeDetailProps) {
	const controller = useResumeDetailController(resumeId);

	if (controller.loading) {
		return <ResumeDetailSkeleton />;
	}

	if (!controller.resume) {
		return <p className="form-message">{controller.message || "Resume not found."}</p>;
	}

	const resume = controller.resume;
	const jobDescription = resume.job_description ?? "";
	const postDescription = resume.post_description ?? "";
	const visibleReviewCount = controller.reviews.filter(
		(review) => !review.is_deleted,
	).length;
	const deleteTargetIsReply = Boolean(controller.deleteTargetReview?.parent_id);
	const resumeActionCopy =
		controller.pendingResumeAction === "delete"
			? {
					action: "Delete submission",
					description:
						"This removes the resume, its PDF, feedback thread, and saved references. This cannot be undone.",
					title: "Delete submission?",
				}
			: controller.pendingResumeAction === "reopen"
				? {
						action: "Reopen feedback",
						description:
							"Reviewers will be able to add new feedback and replies again.",
						title: "Reopen feedback?",
					}
				: {
						action: "Close feedback",
						description:
							"New reviewers will not be able to comment until you reopen it. Existing feedback stays visible.",
						title: "Close feedback?",
					};
	const posterLabel = getResumePosterLabel(
		resume,
		controller.resumeAuthorProfile,
	);
	const reportTargetAuthorHandle = controller.reportTargetReview
		? getAuthorHandle(
				controller.reportTargetReview.author_id,
				controller.authorProfiles[controller.reportTargetReview.author_id],
			)
		: "";
	const reportDetailsRemaining =
		REPORT_DETAILS_MAX_LENGTH - controller.reportDetails.length;

	return (
		<>
			<section className="resume-thread">
				<div className="resume-detail-main-scroll">
					<ResumePreviewPane
						isClosed={controller.isClosed}
						isOwner={controller.isOwner}
						onLogin={controller.goToLogin}
						onOpenFile={() => {
							void controller.openResumeFile();
						}}
						onReplacePdf={(file) => { void controller.handleReplacePdf(file); }}
						onRequestDelete={controller.requestDeleteResume}
						onRequestStatusChange={controller.requestResumeStatusAction}
						replacingPdf={controller.replacingPdf}
						posterLabel={posterLabel}
						resume={resume}
						resumeActionBusy={controller.resumeActionBusy}
						resumeAuthorProfile={controller.resumeAuthorProfile}
						signedUrl={controller.signedUrl}
						signedUrlError={controller.signedUrlError}
						user={controller.user}
					/>

					<aside className="thread-context-panel" aria-label="Resume context">
						<div className="thread-context-grid" aria-label="Resume context">
							<ResumeContextCard
								eyebrow="Ask"
								title="What they want help with"
								content={postDescription}
								emptyMessage="No post description was attached to this older post."
							/>
							<ResumeContextCard
								eyebrow="JD"
								title="Job description"
								content={jobDescription}
								emptyMessage="No JD was attached to this older post."
							/>
						</div>
					</aside>

					<DiscussionPanel
						attachmentsById={controller.attachmentsById}
						authorProfiles={controller.authorProfiles}
						claiming={controller.claiming}
						collapsedReviewIds={controller.collapsedReviewIds}
						content={controller.content}
						contentFormat={controller.contentFormat}
						deleteSchemaReady={controller.deleteSchemaReady}
						deletingReviewId={controller.deletingReviewId}
						dislikedReviewIds={controller.dislikedReviewIds}
						guidedIssue={controller.guidedIssue}
						guidedIssueType={controller.guidedIssueType}
						guidedSuggestion={controller.guidedSuggestion}
						isClosed={controller.isClosed}
						isClaimable={controller.isClaimable}
						isPremiumClaimed={Boolean(resume.is_premium && resume.assigned_reviewer_id)}
						isOwner={controller.isOwner}
						isPremiumReviewer={controller.isPremiumReviewer}
						isRefundable={controller.isRefundable}
						isWaiting={controller.isWaiting}
						likedReviewIds={controller.likedReviewIds}
						mediaSchemaReady={controller.mediaSchemaReady}
						message={controller.message}
						needsGuidedReviewCredit={controller.needsGuidedReviewCredit}
						onCancelReply={() => {
							controller.setReplyingToId(null);
							controller.setReplyContent("");
							controller.setReplyContentFormat("plain");
							controller.setReplyAttachment(null);
						}}
						onDeleteReviewRequest={(targetReview) => {
							void controller.requestDeleteReview(targetReview);
						}}
						onContentChange={controller.setContent}
						onContentFormatChange={controller.setContentFormat}
						onGuidedIssueChange={controller.setGuidedIssue}
						onGuidedIssueTypeChange={controller.setGuidedIssueType}
						onGuidedSuggestionChange={controller.setGuidedSuggestion}
						onOpenReportDialog={controller.openReportDialog}
						onReactToReview={(targetReview, reaction) => {
							void controller.reactToReview(targetReview, reaction);
						}}
						onReplyAttachmentChange={controller.setReplyAttachment}
						onReplyContentChange={controller.setReplyContent}
						onReplyFormatChange={controller.setReplyContentFormat}
						onReplySubmit={controller.handleReplySubmit}
						onReplyToggle={(reviewId) => {
							controller.setReplyingToId((current) =>
								current === reviewId ? null : reviewId,
							);
							controller.setReplyContent("");
							controller.setReplyContentFormat("plain");
							controller.setReplyAttachment(null);
						}}
						onClaim={() => { void controller.handleClaimResume(); }}
						onPremiumReviewSubmit={(fields) => { void controller.handlePremiumReviewSubmit(fields); }}
						onRequestRefund={() => { controller.setShowRefundConfirm(true); }}
						submittingPremiumReview={controller.submittingPremiumReview}
						onRequireLogin={controller.goToLogin}
						onReviewSubmit={controller.handleReviewSubmit}
						onSelectedAttachmentChange={controller.setSelectedAttachment}
						onToggleReplies={controller.toggleReviewReplies}
						replyAttachment={controller.replyAttachment}
						replyContent={controller.replyContent}
						replyContentFormat={controller.replyContentFormat}
						replyingToId={controller.replyingToId}
						replySchemaReady={controller.replySchemaReady}
						reportSchemaReady={controller.reportSchemaReady}
						resume={resume}
						selectedAttachment={controller.selectedAttachment}
						submitting={controller.submitting}
						submittingReplyId={controller.submittingReplyId}
						threadReviews={controller.threadReviews}
						user={controller.user}
						visibleReviewCount={visibleReviewCount}
					/>
				</div>
			</section>

			<ReportCommentDialog
				details={controller.reportDetails}
				onDetailsChange={controller.setReportDetails}
				onOpenChange={(open) => {
					if (!open && !controller.submittingReport) {
						controller.setReportTargetReview(null);
						controller.setReportDetails("");
					}
				}}
				onReasonChange={controller.setReportReason}
				onSubmit={controller.submitReport}
				reason={controller.reportReason}
				remainingCharacters={reportDetailsRemaining}
				submitting={controller.submittingReport}
				targetAuthorHandle={reportTargetAuthorHandle}
				targetReview={controller.reportTargetReview}
			/>
			<ResumeOwnerActionDialog
				busy={controller.resumeActionBusy}
				copy={resumeActionCopy}
				onConfirm={() => {
					void controller.confirmResumeOwnerAction();
				}}
				onOpenChange={(open) => {
					if (!open && !controller.resumeActionBusy) {
						controller.setPendingResumeAction(null);
					}
				}}
				pendingAction={controller.pendingResumeAction}
			/>
			<RefundRequestDialog
				busy={controller.refunding}
				onConfirm={() => { void controller.handleRefundRequest(); }}
				onOpenChange={(open) => {
					if (!open && !controller.refunding) {
						controller.setShowRefundConfirm(false);
					}
				}}
				open={controller.showRefundConfirm}
			/>
			<DeleteReviewDialog
				busy={Boolean(controller.deletingReviewId)}
				isReply={deleteTargetIsReply}
				onConfirm={() => {
					void controller.deleteReview(controller.deleteTargetReview);
				}}
				onOpenChange={(open) => {
					if (!open && !controller.deletingReviewId) {
						controller.setDeleteTargetReview(null);
					}
				}}
				targetReview={controller.deleteTargetReview}
			/>
		</>
	);
}

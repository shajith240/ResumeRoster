"use client";

import { type Dispatch, type FormEvent, type SetStateAction, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getReportIssue, type ReportReason } from "@/lib/report-validation";
import { supabase } from "@/lib/supabase/client";
import type { Review } from "@/lib/supabase/types";
import { toast } from "sonner";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import { isReportFeatureError } from "./utils";

type ReportInternalError = (
	error: unknown,
	userMessage: string,
	operation: string,
	extra?: Record<string, unknown>,
) => void;

type UseReviewReportActionsParams = {
	goToLogin: () => void;
	reportError: (errorMessage: string) => void;
	reportInternalError: ReportInternalError;
	setMessage: Dispatch<SetStateAction<string>>;
	user: User | null;
};

export function useReviewReportActions({
	goToLogin,
	reportError,
	reportInternalError,
	setMessage,
	user,
}: UseReviewReportActionsParams) {
	const [reportTargetReview, setReportTargetReview] = useState<Review | null>(null);
	const [reportReason, setReportReason] =
		useState<ReportReason>("personal_info");
	const [reportDetails, setReportDetails] = useState("");
	const [submittingReport, setSubmittingReport] = useState(false);
	const [reportSchemaReady, setReportSchemaReady] = useState(true);

	function openReportDialog(targetReview: Review) {
		setMessage("");

		if (!reportSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetReview.author_id === user.id) {
			reportError("You cannot report your own feedback.");
			return;
		}

		if (targetReview.is_deleted) {
			reportError("Deleted feedback cannot be reported.");
			return;
		}

		setReportReason("personal_info");
		setReportDetails("");
		setReportTargetReview(targetReview);
	}

	async function submitReport(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!reportTargetReview) {
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		const issue = getReportIssue({
			reason: reportReason,
			details: reportDetails,
		});

		if (issue) {
			reportError(issue);
			return;
		}

		setSubmittingReport(true);

		const { data, error } = await supabase.rpc("report_content", {
			report_target_type: "review",
			target_resume_id: reportTargetReview.resume_id,
			target_roast_id: reportTargetReview.id,
			report_reason: reportReason,
			report_details: reportDetails.trim(),
		});

		setSubmittingReport(false);

		if (error) {
			if (isReportFeatureError(error)) {
				setReportSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`);
				return;
			}

			reportInternalError(
				error,
				"We could not send this report. Please try again.",
				"report_review",
				{ reportReason, reviewId: reportTargetReview.id },
			);
			return;
		}

		const reportResult = Array.isArray(data) ? data[0] : null;
		setReportTargetReview(null);
		setReportDetails("");
		toast.success(
			reportResult?.was_duplicate
				? "Report updated in the moderation queue."
				: "Report sent for moderation review.",
		);
	}

	return {
		openReportDialog,
		reportDetails,
		reportReason,
		reportSchemaReady,
		reportTargetReview,
		setReportDetails,
		setReportReason,
		setReportTargetReview,
		submitReport,
		submittingReport,
	};
}

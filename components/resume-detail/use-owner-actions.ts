"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { useRouter } from "next/navigation";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { removeRecentPost } from "@/lib/recent-posts";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";
import { toast } from "sonner";
import type { ResumeOwnerAction } from "./types";
import { isPermissionPolicyError } from "./utils";

type UseResumeOwnerActionsParams = {
	clearFeedbackDrafts: () => void;
	isClosed: boolean;
	isOwner: boolean;
	reportError: (errorMessage: string) => void;
	resume: ResumeSummary | null;
	setMessage: Dispatch<SetStateAction<string>>;
	setResume: Dispatch<SetStateAction<ResumeSummary | null>>;
};

export function useResumeOwnerActions({
	clearFeedbackDrafts,
	isClosed,
	isOwner,
	reportError,
	resume,
	setMessage,
	setResume,
}: UseResumeOwnerActionsParams) {
	const router = useRouter();
	const [pendingResumeAction, setPendingResumeAction] =
		useState<ResumeOwnerAction | null>(null);
	const [resumeActionBusy, setResumeActionBusy] = useState(false);

	async function updateResumeStatus(
		nextStatus: Extract<ResumeSummary["status"], "open" | "closed">,
	) {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can change this thread status.");
			return false;
		}

		setResumeActionBusy(true);
		const { error } = await supabase
			.from("resumes")
			.update({ status: nextStatus })
			.eq("id", resume.id);
		setResumeActionBusy(false);

		if (error) {
			reportError(
				isPermissionPolicyError(error)
					? "Only the resume owner can change this thread status."
					: "We could not update this resume status. Please try again.",
			);
			return false;
		}

		setResume((current) =>
			current ? { ...current, status: nextStatus } : current,
		);

		if (nextStatus === "closed") {
			clearFeedbackDrafts();
			setMessage("This resume is now closed for new feedback.");
			toast.success("Feedback closed.");
		} else {
			setMessage("This resume is open for feedback again.");
			toast.success("Feedback reopened.");
		}

		return true;
	}

	async function deleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return false;
		}

		setResumeActionBusy(true);
		const { error } = await supabase
			.from("resumes")
			.delete()
			.eq("id", resume.id);

		if (error) {
			setResumeActionBusy(false);
			reportError(
				isPermissionPolicyError(error)
					? "Only the resume owner can delete this submission."
					: "We could not delete this submission. Please try again.",
			);
			return false;
		}

		removeRecentPost("resume", resume.id);
		const removeFile = await supabase.storage
			.from("resumes")
			.remove([resume.file_path]);
		setResumeActionBusy(false);

		if (removeFile.error) {
			toast.warning(
				"Resume deleted, but the file cleanup needs another attempt.",
			);
		} else {
			toast.success("Resume deleted.");
		}

		announceRouteTransition("/feed");
		router.push("/feed");
		return true;
	}

	function requestResumeStatusAction() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can change this thread status.");
			return;
		}

		setPendingResumeAction(isClosed ? "reopen" : "close");
	}

	function requestDeleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return;
		}

		setPendingResumeAction("delete");
	}

	async function confirmResumeOwnerAction() {
		if (!pendingResumeAction) {
			return;
		}

		if (pendingResumeAction === "delete") {
			const deleted = await deleteResume();
			if (deleted) {
				setPendingResumeAction(null);
			}
			return;
		}

		const updated = await updateResumeStatus(
			pendingResumeAction === "close" ? "closed" : "open",
		);

		if (updated) {
			setPendingResumeAction(null);
		}
	}

	return {
		confirmResumeOwnerAction,
		pendingResumeAction,
		requestDeleteResume,
		requestResumeStatusAction,
		resumeActionBusy,
		setPendingResumeAction,
	};
}

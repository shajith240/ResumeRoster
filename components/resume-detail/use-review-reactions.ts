"use client";

import { type Dispatch, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Review } from "@/lib/supabase/types";
import { toast } from "sonner";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import type { Reaction } from "./types";

type CaptureResumeDetailError = (
	error: unknown,
	operation: string,
	extra?: Record<string, unknown>,
) => void;

type ReportInternalError = (
	error: unknown,
	userMessage: string,
	operation: string,
	extra?: Record<string, unknown>,
) => void;

type UseReviewReactionsParams = {
	captureResumeDetailError: CaptureResumeDetailError;
	dislikedReviewIds: Set<string>;
	goToLogin: () => void;
	isOwner: boolean;
	likedReviewIds: Set<string>;
	reportError: (errorMessage: string) => void;
	reportInternalError: ReportInternalError;
	setDislikedReviewIds: Dispatch<SetStateAction<Set<string>>>;
	setLikedReviewIds: Dispatch<SetStateAction<Set<string>>>;
	setMessage: Dispatch<SetStateAction<string>>;
	setReviews: Dispatch<SetStateAction<Review[]>>;
	user: User | null;
};

export function useReviewReactions({
	captureResumeDetailError,
	dislikedReviewIds,
	goToLogin,
	isOwner,
	likedReviewIds,
	reportError,
	reportInternalError,
	setDislikedReviewIds,
	setLikedReviewIds,
	setMessage,
	setReviews,
	user,
}: UseReviewReactionsParams) {
	async function reactToReview(targetReview: Review, reaction: Reaction) {
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (targetReview.author_id === user.id) {
			reportError("You cannot react to your own feedback.");
			return;
		}

		if (isOwner) {
			reportError("Resume owners cannot react to feedback for their own resume.");
			return;
		}

		const currentReaction = likedReviewIds.has(targetReview.id)
			? "like"
			: dislikedReviewIds.has(targetReview.id)
				? "dislike"
				: null;

		const applyLocalReaction = (nextReaction: Reaction | null) => {
			setLikedReviewIds((current) => {
				const next = new Set(current);
				if (nextReaction === "like") {
					next.add(targetReview.id);
				} else {
					next.delete(targetReview.id);
				}
				return next;
			});
			setDislikedReviewIds((current) => {
				const next = new Set(current);
				if (nextReaction === "dislike") {
					next.add(targetReview.id);
				} else {
					next.delete(targetReview.id);
				}
				return next;
			});
			setReviews((current) =>
				current.map((review) => {
					if (review.id !== targetReview.id) return review;

					const removeLike = currentReaction === "like" ? -1 : 0;
					const addLike = nextReaction === "like" ? 1 : 0;
					const removeDislike = currentReaction === "dislike" ? -1 : 0;
					const addDislike = nextReaction === "dislike" ? 1 : 0;

					return {
						...review,
						dislike_count: Math.max(
							0,
							(review.dislike_count ?? 0) + removeDislike + addDislike,
						),
						helpful_votes: Math.max(
							0,
							review.helpful_votes + removeLike + addLike,
						),
					};
				}),
			);
		};

		if (currentReaction === reaction) {
			const { error } = await supabase
				.from("votes")
				.delete()
				.eq("roast_id", targetReview.id)
				.eq("voter_id", user.id);

			if (error) {
				reportInternalError(
					error,
					"We could not update your reaction. Please try again.",
					"delete_review_reaction",
					{ reaction, reviewId: targetReview.id },
				);
				return;
			}

			applyLocalReaction(null);
			toast.info(reaction === "like" ? "Like removed." : "Dislike removed.");
			return;
		}

		const voteQuery = currentReaction
			? supabase
					.from("votes")
					.update({ reaction })
					.eq("roast_id", targetReview.id)
					.eq("voter_id", user.id)
			: supabase.from("votes").insert({
					reaction,
					roast_id: targetReview.id,
					voter_id: user.id,
				});

		const { error } = await voteQuery;

		if (error) {
			if (error.message.includes("reaction")) {
				captureResumeDetailError(error, "save_review_reaction", {
					reaction,
					reviewId: targetReview.id,
				});
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Reactions are not ready yet.`);
			} else {
				reportInternalError(
					error,
					"We could not update your reaction. Please try again.",
					"save_review_reaction",
					{ reaction, reviewId: targetReview.id },
				);
			}
			return;
		}

		applyLocalReaction(reaction);
		toast.success(reaction === "like" ? "Liked feedback." : "Disliked feedback.");
	}

	return { reactToReview };
}

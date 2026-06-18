"use client";

type FeedSkeletonProps = {
	ariaLabel?: string;
	rowCount?: number;
};

export default function FeedSkeleton({
	ariaLabel = "Loading feed",
	rowCount = 3,
}: FeedSkeletonProps) {
	return (
		<div className="feed-skeleton-list" aria-label={ariaLabel}>
			{Array.from({ length: rowCount }, (_, item) => (
				<article className="resume-card skeleton-card" key={item}>
					<div className="post-content">
						<span className="skeleton skeleton-line meta" />
						<span className="skeleton skeleton-line title" />
						<span className="skeleton skeleton-line tags" />
						<span className="skeleton skeleton-line preview" />
						<span className="skeleton skeleton-line copy" />
						<span className="skeleton skeleton-line actions" />
					</div>
				</article>
			))}
		</div>
	);
}

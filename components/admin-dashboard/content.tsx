import Link from "next/link";
import { PanelHeader } from "./shared";
import { formatDate } from "./utils";
import type { AdminOverview, AdminResume, AdminReview } from "./types";

export function ContentPage({ overview }: { overview: AdminOverview | null }) {
	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Newest submissions and feedback for launch monitoring."
				title="Content Watch"
			/>
			<div className="admin-content-grid">
				<RecentContentList
					items={overview?.activity.recentResumes ?? []}
					kind="resume"
				/>
				<RecentContentList
					items={
						overview?.activity.recentReviews ??
						overview?.activity.recentRoasts ??
						[]
					}
					kind="feedback"
				/>
			</div>
		</section>
	);
}

export function RecentContentList({
	items,
	kind,
}: {
	items: Array<AdminResume | AdminReview>;
	kind: "feedback" | "resume";
}) {
	return (
		<div className="admin-content-list">
			<h3>{kind === "resume" ? "Recent resumes" : "Recent feedback"}</h3>
			{items.map((item) => {
				const href =
					kind === "resume"
						? `/resume/${item.id}`
						: `/resume/${(item as AdminReview).resume_id}`;
				const title =
					"title" in item ? item.title : (item as AdminReview).content;
				const detail =
					"status" in item
						? item.status
						: (item as AdminReview).is_deleted
							? "removed"
							: "live";

				return (
					<Link href={href} key={`${kind}-${item.id}`}>
						<strong>{title}</strong>
						<span>
							{detail} - {formatDate(item.created_at)}
						</span>
					</Link>
				);
			})}
			{!items.length ? <p className="muted-text">Nothing to show yet.</p> : null}
		</div>
	);
}

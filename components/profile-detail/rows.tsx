import Link from "next/link";
import type { PublicProfileReview } from "@/lib/supabase/types";
import styles from "../ProfileDetail.module.css";
import type { ActivityItem } from "./types";
import { formatActivityDate } from "./utils";

export function ActivityRow({ item }: { item: ActivityItem }) {
	const content = (
		<>
			<div>
				<strong>{item.title}</strong>
				<span>{item.detail}</span>
			</div>
		</>
	);

	if (item.href) {
		return (
			<Link className={styles.activityRow} href={item.href}>
				{content}
			</Link>
		);
	}

	return <div className={styles.activityRow}>{content}</div>;
}

export function ReviewRow({ review }: { review: PublicProfileReview }) {
	return (
		<Link className={styles.reviewRow} href={`/resume/${review.resume_id}`}>
			<div>
				<p>"{review.content}"</p>
				<span>
					{review.resume_title} - {formatActivityDate(review.created_at)}
				</span>
			</div>
		</Link>
	);
}

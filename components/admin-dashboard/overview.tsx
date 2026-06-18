import Link from "next/link";
import type { ReactNode } from "react";
import {
	BadgeCheck,
	Database,
	FileText,
	Flag,
	History,
	Inbox,
	UsersRound,
} from "@/components/ui/solar-icons";
import { PanelHeader } from "./shared";
import type { AdminStats } from "./types";

export function MetricCard({
	icon,
	label,
	tone = "normal",
	value,
}: {
	icon: ReactNode;
	label: string;
	tone?: "danger" | "normal";
	value: number;
}) {
	return (
		<div className={`admin-metric-card admin-metric-${tone}`}>
			<div>{icon}</div>
			<strong>{value.toLocaleString()}</strong>
			<span>{label}</span>
		</div>
	);
}

export function OverviewPage({ stats }: { stats?: AdminStats }) {
	const cards = [
		{
			detail: `${stats?.feedbackOpen ?? 0} open`,
			href: "/admin/feedback",
			icon: Inbox,
			label: "Feedback Inbox",
		},
		{
			detail: `${stats?.pendingReports ?? 0} pending`,
			href: "/admin/reports",
			icon: Flag,
			label: "Reports",
		},
		{
			detail: `${stats?.users ?? 0} accounts`,
			href: "/admin/people",
			icon: UsersRound,
			label: "People",
		},
		{
			detail: `${stats?.pendingReviewers ?? 0} waiting`,
			href: "/admin/reviewers",
			icon: BadgeCheck,
			label: "Reviewer Trust",
		},
		{
			detail: `${stats?.resumes ?? 0} resumes`,
			href: "/admin/content",
			icon: FileText,
			label: "Content",
		},
		{
			detail: "Moderation history",
			href: "/admin/audit",
			icon: History,
			label: "Audit Trail",
		},
		{
			detail: "Tables and deletion model",
			href: "/admin/data",
			icon: Database,
			label: "Data Control",
		},
	];

	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Choose one workspace. Each page owns one job."
				title="Control Areas"
			/>
			<div className="admin-overview-grid">
				{cards.map((card) => {
					const Icon = card.icon;
					return (
						<Link className="admin-overview-card" href={card.href} key={card.href}>
							<Icon aria-hidden="true" />
							<strong>{card.label}</strong>
							<span>{card.detail}</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

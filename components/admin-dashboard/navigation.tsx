import Link from "next/link";
import { adminSections } from "./constants";
import { getSectionBadge } from "./utils";
import type { AdminDashboardView, AdminSection, AdminStats } from "./types";

export function AdminSectionNav({
	activeView,
	stats,
}: {
	activeView: AdminDashboardView;
	stats?: AdminStats;
}) {
	const groups: Array<AdminSection["group"]> = ["Operations", "Governance"];

	return (
		<nav className="admin-section-nav" aria-label="Admin sections">
			<div className="admin-section-nav-header">
				<strong>Operations Console</strong>
				<span>Moderate, message, and inspect.</span>
			</div>
			{groups.map((group) => (
				<div className="admin-section-nav-group" key={group}>
					<span>{group}</span>
					{adminSections
						.filter((section) => section.group === group)
						.map((section) => {
							const Icon = section.icon;
							const badge = getSectionBadge(section.id, stats);
							return (
								<Link
									aria-current={activeView === section.id ? "page" : undefined}
									className={activeView === section.id ? "active" : ""}
									href={section.href}
									key={section.id}
								>
									<Icon aria-hidden="true" />
									<span className="admin-nav-item-copy">
										<strong>{section.label}</strong>
										<small>{section.description}</small>
									</span>
									{badge ? (
										<b className="admin-nav-badge">{badge.toLocaleString()}</b>
									) : null}
								</Link>
							);
						})}
				</div>
			))}
		</nav>
	);
}

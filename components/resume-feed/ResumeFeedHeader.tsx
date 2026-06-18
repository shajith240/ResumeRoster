"use client";

import Link from "next/link";

type ResumeFeedHeaderProps = {
	actionHref?: string;
	actionLabel?: string;
	description: string;
	title: string;
};

export default function ResumeFeedHeader({
	actionHref,
	actionLabel,
	description,
	title,
}: ResumeFeedHeaderProps) {
	const action =
		actionHref && actionLabel ? { href: actionHref, label: actionLabel } : null;

	return (
		<header className="feed-route-header">
			<div className="feed-route-header-copy">
				<h1>{title}</h1>
				<p>{description}</p>
			</div>
			{action ? (
				<div className="feed-header-actions">
					<Link className="btn-primary" href={action.href}>
						{action.label}
					</Link>
				</div>
			) : null}
		</header>
	);
}

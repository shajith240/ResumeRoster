import type { ReactNode } from "react";

export function PanelHeader({
	children,
	description,
	title,
}: {
	children?: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<div className="admin-panel-header">
			<div>
				<h2>{title}</h2>
				<p>{description}</p>
			</div>
			{children ? <div className="admin-panel-tools">{children}</div> : null}
		</div>
	);
}

export function SegmentedTabs({
	active,
	onChange,
	values,
}: {
	active: string;
	onChange: (value: string) => void;
	values: string[];
}) {
	return (
		<div className="admin-tabs">
			{values.map((value) => (
				<button
					aria-pressed={active === value}
					className={active === value ? "active" : ""}
					key={value}
					onClick={() => onChange(value)}
					type="button"
				>
					{value}
				</button>
			))}
		</div>
	);
}

export function ActionButton({
	action,
	busyAction,
	disabled,
	icon,
	label,
	onClick,
	scope,
	targetId,
	tone = "normal",
}: {
	action: string;
	busyAction: string;
	disabled?: boolean;
	icon?: ReactNode;
	label: string;
	onClick: () => Promise<void>;
	scope: "report" | "reviewer" | "user";
	targetId: string;
	tone?: "danger" | "normal";
}) {
	const isBusy = busyAction === `${scope}:${targetId}:${action}`;
	return (
		<button
			className={tone === "danger" ? "admin-danger-action" : undefined}
			disabled={disabled || isBusy}
			onClick={() => void onClick()}
			type="button"
		>
			{icon}
			{isBusy ? "Working..." : label}
		</button>
	);
}

export function EmptyPanel({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<div className="admin-empty-panel">
			<strong>{title}</strong>
			<span>{description}</span>
		</div>
	);
}

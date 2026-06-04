import { PanelHeader } from "./shared";
import type { AdminDataInventory, DataMetric } from "./types";

export function DataPage({ inventory }: { inventory: AdminDataInventory | null }) {
	const tables = inventory?.tables ?? [];
	const storage = inventory?.storage ?? [];
	const lifecycle = inventory?.lifecycle ?? [];

	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Operational inventory for data ownership and deletion checks."
				title="Data Control"
			/>
			<div className="admin-data-grid">
				<MetricList metrics={tables} title="Tables" />
				<MetricList metrics={storage} title="Storage" />
				<MetricList metrics={lifecycle} title="User Deletion Path" />
			</div>
		</section>
	);
}

export function MetricList({ metrics, title }: { metrics: DataMetric[]; title: string }) {
	return (
		<div className="admin-data-panel">
			<h3>{title}</h3>
			{metrics.map((metric) => (
				<div className="admin-data-row" key={metric.key}>
					<div>
						<strong>{metric.label}</strong>
						{metric.detail ? <span>{metric.detail}</span> : null}
					</div>
					<b>{metric.value}</b>
				</div>
			))}
			{!metrics.length ? <p className="muted-text">No data loaded.</p> : null}
		</div>
	);
}

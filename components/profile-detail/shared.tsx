import { Label } from "@/components/ui/label";
import styles from "../ProfileDetail.module.css";

export function FieldHeader({
	children,
	htmlFor,
	max,
	value,
}: {
	children: string;
	htmlFor: string;
	max?: number;
	value?: string;
}) {
	return (
		<div className={styles.fieldLabelRow}>
			<Label htmlFor={htmlFor}>{children}</Label>
			{max ? (
				<span className={styles.fieldLimit}>
					{(value ?? "").length}/{max}
				</span>
			) : null}
		</div>
	);
}

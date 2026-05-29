import { Info } from "lucide-react";
import type { ReactNode } from "react";

type InfoHintProps = {
	align?: "center" | "left" | "right";
	children: ReactNode;
	className?: string;
	focusable?: boolean;
	label?: string;
};

export default function InfoHint({
	align = "center",
	children,
	className = "",
	focusable = true,
	label = "More information",
}: InfoHintProps) {
	return (
		<span
			aria-label={label}
			className={`info-hint ${className}`.trim()}
			data-align={align}
			tabIndex={focusable ? 0 : undefined}
		>
			<Info aria-hidden="true" />
			<span className="info-hint-bubble" role="tooltip">
				{children}
			</span>
		</span>
	);
}

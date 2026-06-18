import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./PresenceAvatar.module.css";

type PresenceAvatarSize = "sm" | "md" | "lg";

type PresenceAvatarProps = {
	children: ReactNode;
	className?: string;
	isOnline?: boolean;
	size?: PresenceAvatarSize;
};

const sizeClassName: Record<PresenceAvatarSize, string> = {
	sm: styles.sm,
	md: styles.md,
	lg: styles.lg,
};

export function PresenceAvatar({
	children,
	className,
	isOnline = false,
	size = "md",
}: PresenceAvatarProps) {
	return (
		<span className={cn(styles.root, sizeClassName[size], className)}>
			{children}
			{isOnline ? <span aria-hidden="true" className={styles.dot} /> : null}
		</span>
	);
}

"use client";

import dynamic from "next/dynamic";
import styles from "@/components/ProfileDetail.module.css";
import type { ProfileDetailProps } from "@/components/profile-detail/types";

function ProfileDetailRouteSkeleton() {
	return (
		<section className={styles.shell}>
			<div className={`${styles.canvas} ${styles.loadingBoard}`}>
				<div className={styles.loadingHero}>
					<span />
					<span />
					<span />
				</div>
				<div className={styles.loadingGrid}>
					<span />
					<span />
					<span />
				</div>
			</div>
		</section>
	);
}

const ProfileDetail = dynamic<ProfileDetailProps>(
	() => import("@/components/ProfileDetail"),
	{
		loading: ProfileDetailRouteSkeleton,
		ssr: false,
	},
);

export default function ProfileDetailLazy(props: ProfileDetailProps) {
	return <ProfileDetail {...props} />;
}

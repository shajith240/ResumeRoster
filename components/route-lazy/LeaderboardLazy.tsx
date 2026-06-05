"use client";

import dynamic from "next/dynamic";
import styles from "@/components/Leaderboard.module.css";

function LeaderboardRouteSkeleton() {
	return (
		<section className={styles.page}>
			<div className={styles.loadingHero} />
			<div className={styles.loadingTable} />
		</section>
	);
}

const Leaderboard = dynamic(() => import("@/components/Leaderboard"), {
	loading: LeaderboardRouteSkeleton,
	ssr: false,
});

export default function LeaderboardLazy() {
	return <Leaderboard />;
}

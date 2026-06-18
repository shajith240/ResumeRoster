"use client";

import dynamic from "next/dynamic";
import { LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardSkeleton";

const Leaderboard = dynamic(() => import("@/components/Leaderboard"), {
	loading: LeaderboardSkeleton,
	ssr: false,
});

export default function LeaderboardLazy() {
	return <Leaderboard />;
}

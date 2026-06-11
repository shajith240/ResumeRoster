"use client";

import dynamic from "next/dynamic";
import { ProfileDetailSkeleton } from "@/components/profile-detail/ProfileDetailSkeleton";
import type { ProfileDetailProps } from "@/components/profile-detail/types";

const ProfileDetail = dynamic<ProfileDetailProps>(
	() => import("@/components/ProfileDetail"),
	{
		loading: ProfileDetailSkeleton,
		ssr: false,
	},
);

export default function ProfileDetailLazy(props: ProfileDetailProps) {
	return <ProfileDetail {...props} />;
}

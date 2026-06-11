"use client";

import dynamic from "next/dynamic";
import { ResumeDetailSkeleton } from "@/components/resume-detail/ResumeDetailSkeleton";
import type { ResumeDetailProps } from "@/components/resume-detail/types";

const ResumeDetail = dynamic<ResumeDetailProps>(
	() => import("@/components/ResumeDetail"),
	{
		loading: ResumeDetailSkeleton,
		ssr: false,
	},
);

export default function ResumeDetailLazy(props: ResumeDetailProps) {
	return <ResumeDetail {...props} />;
}

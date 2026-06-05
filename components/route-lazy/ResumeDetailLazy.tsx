"use client";

import dynamic from "next/dynamic";
import type { ResumeDetailProps } from "@/components/resume-detail/types";

function ResumeDetailRouteSkeleton() {
	return (
		<section className="resume-thread">
			<div className="thread-viewer-card">
				<span className="skeleton skeleton-line title" />
				<span className="skeleton skeleton-line copy" />
				<span className="skeleton skeleton-line actions" />
			</div>
		</section>
	);
}

const ResumeDetail = dynamic<ResumeDetailProps>(
	() => import("@/components/ResumeDetail"),
	{
		loading: ResumeDetailRouteSkeleton,
		ssr: false,
	},
);

export default function ResumeDetailLazy(props: ResumeDetailProps) {
	return <ResumeDetail {...props} />;
}

import { notFound } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import CommunityPostDetail from "@/components/community/CommunityPostDetail";
import RouteHeader from "@/components/RouteHeader";
import { areCommunityPostsEnabled } from "@/lib/community";

export const dynamic = "force-dynamic";

type CommunityPostPageProps = {
	params: Promise<{ id: string }>;
};

export default async function CommunityPostPage({
	params,
}: CommunityPostPageProps) {
	if (!areCommunityPostsEnabled()) {
		notFound();
	}

	const { id } = await params;

	return (
		<AuthGate>
			<div className="community-detail-page-shell">
				<RouteHeader />
				<main className="community-post-route page-enter">
					<CommunityPostDetail postId={id} />
				</main>
			</div>
		</AuthGate>
	);
}

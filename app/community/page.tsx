import { notFound } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import CommunityPostFeed from "@/components/community/CommunityPostFeed";
import RecentPostsPanel from "@/components/RecentPostsPanel";
import RouteHeader from "@/components/RouteHeader";
import { areCommunityPostsEnabled } from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
	if (!areCommunityPostsEnabled()) {
		notFound();
	}

	return (
		<AuthGate>
			<RouteHeader />
			<main className="feed-app-shell community-feed-route page-enter">
				<section className="feed-center community-feed-center">
					<header className="community-feed-intro">
						<h1>Community</h1>
						<p>
							Placement, interview, project, and tech conversations from
							people building their careers in public.
						</p>
					</header>
					<CommunityPostFeed />
				</section>
				<RecentPostsPanel kind="community" surface="rail" />
			</main>
		</AuthGate>
	);
}

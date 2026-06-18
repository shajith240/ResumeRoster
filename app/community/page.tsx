import { notFound } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import CommunityPostFeed from "@/components/community/CommunityPostFeed";
import FeedRailLegalFooter from "@/components/FeedRailLegalFooter";
import PwaHomeRedirect from "@/components/PwaHomeRedirect";
import RecentPostsPanel from "@/components/RecentPostsPanel";
import RouteHeader from "@/components/RouteHeader";
import { areCommunityPostsEnabled } from "@/lib/community";

export default async function CommunityPage() {
	if (!areCommunityPostsEnabled()) {
		notFound();
	}

	return (
		<AuthGate>
			<PwaHomeRedirect to="/feed" />
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
				<aside className="feed-right-rail recent-posts-rail">
					<RecentPostsPanel kind="community" surface="rail-content" />
					<FeedRailLegalFooter />
				</aside>
			</main>
		</AuthGate>
	);
}

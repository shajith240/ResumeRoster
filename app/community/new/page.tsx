import { notFound } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import CommunityPostComposer from "@/components/community/CommunityPostComposer";
import RouteHeader from "@/components/RouteHeader";
import { areCommunityPostsEnabled } from "@/lib/community";

export const dynamic = "force-dynamic";

export default function NewCommunityPostPage() {
	if (!areCommunityPostsEnabled()) {
		notFound();
	}

	return (
		<AuthGate>
			<RouteHeader />
			<main className="community-compose-route page-enter">
				<CommunityPostComposer />
			</main>
		</AuthGate>
	);
}

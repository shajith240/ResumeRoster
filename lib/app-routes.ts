import { areCommunityPostsEnabled } from "@/lib/community";

const RESUME_FEED_ROUTE = "/feed";
const COMMUNITY_HOME_ROUTE = "/community";

export function getAppHomeRoute(communityEnabled = areCommunityPostsEnabled()) {
	return communityEnabled ? COMMUNITY_HOME_ROUTE : RESUME_FEED_ROUTE;
}

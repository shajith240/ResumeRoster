import { areCommunityPostsEnabled } from "@/lib/community";

export const RESUME_FEED_ROUTE = "/feed";
export const COMMUNITY_HOME_ROUTE = "/community";

export function getAppHomeRoute(communityEnabled = areCommunityPostsEnabled()) {
	return communityEnabled ? COMMUNITY_HOME_ROUTE : RESUME_FEED_ROUTE;
}

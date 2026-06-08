import { areCommunityPostsEnabled } from "@/lib/community";

export type PrimaryNavItemId =
	| "feed"
	| "community"
	| "submit"
	| "community-new"
	| "leaderboard"
	| "admin";

export type PrimaryNavigationItemBase = {
	id: PrimaryNavItemId;
	href: string;
	label: string;
	mobileLabel: string;
	active: boolean;
	tone?: "primary";
};

export type PrimaryNavigationContext = {
	pathname: string;
	communityEnabled?: boolean;
	includeAdmin?: boolean;
	isAdmin?: boolean;
};

function isWithinRoute(pathname: string, route: string) {
	return pathname === route || pathname.startsWith(`${route}/`);
}

function isCommunityComposeRoute(pathname: string) {
	return pathname === "/community/new" || pathname.startsWith("/community/new/");
}

export function getPrimaryNavigationItems({
	pathname,
	communityEnabled = areCommunityPostsEnabled(),
	includeAdmin = false,
	isAdmin = false,
}: PrimaryNavigationContext): PrimaryNavigationItemBase[] {
	const items: PrimaryNavigationItemBase[] = [];

	if (communityEnabled) {
		items.push({
			id: "community",
			href: "/community",
			label: "Community",
			mobileLabel: "Home",
			active:
				isWithinRoute(pathname, "/community") &&
				!isCommunityComposeRoute(pathname),
		});
	}

	items.push({
		id: "feed",
		href: "/feed",
		label: "Resume Feed",
		mobileLabel: "Resume",
		active: pathname === "/feed" || isWithinRoute(pathname, "/resume"),
	});

	items.push({
		id: "submit",
		href: "/submit",
		label: "Post resume",
		mobileLabel: "Post",
		active: pathname === "/submit",
		tone: "primary",
	});

	if (communityEnabled) {
		items.push({
			id: "community-new",
			href: "/community/new",
			label: "Write post",
			mobileLabel: "Write",
			active: isCommunityComposeRoute(pathname),
		});
	}

	items.push({
		id: "leaderboard",
		href: "/leaderboard",
		label: "Leaderboard",
		mobileLabel: "Leaders",
		active: pathname === "/leaderboard",
	});

	if (includeAdmin && isAdmin) {
		items.push({
			id: "admin",
			href: "/admin",
			label: "Admin",
			mobileLabel: "Admin",
			active: isWithinRoute(pathname, "/admin"),
		});
	}

	return items;
}

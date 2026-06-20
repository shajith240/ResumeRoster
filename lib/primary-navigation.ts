import { areCommunityPostsEnabled } from "@/lib/community";

export type PrimaryNavItemId =
	| "feed"
	| "community"
	| "submit"
	| "community-new"
	| "leaderboard"
	| "reviewer"
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
	includeReviewer?: boolean;
	isVerifiedReviewer?: boolean;
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
	includeReviewer = false,
	isVerifiedReviewer = false,
}: PrimaryNavigationContext): PrimaryNavigationItemBase[] {
	const items: PrimaryNavigationItemBase[] = [];

	items.push({
		id: "feed",
		href: "/feed",
		label: "Home",
		mobileLabel: "Home",
		active: pathname === "/feed" || isWithinRoute(pathname, "/resume"),
	});

	if (communityEnabled) {
		items.push({
			id: "community",
			href: "/community",
			label: "Community",
			mobileLabel: "Community",
			active:
				isWithinRoute(pathname, "/community") &&
				!isCommunityComposeRoute(pathname),
		});
	}

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

	if (includeReviewer && isVerifiedReviewer) {
		items.push({
			id: "reviewer",
			href: "/reviewer",
			label: "My queue",
			mobileLabel: "Queue",
			active: isWithinRoute(pathname, "/reviewer"),
		});
	}

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

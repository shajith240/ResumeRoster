"use client";

import {
	FileText,
	Home,
	PencilLine,
	Plus,
	ShieldCheck,
	Trophy,
	UsersRound,
	type SolarIconComponent,
} from "@/components/ui/solar-icons";
import {
	getPrimaryNavigationItems as getPrimaryNavigationItemsBase,
	type PrimaryNavigationContext,
	type PrimaryNavigationItemBase,
	type PrimaryNavItemId,
} from "@/lib/primary-navigation";

export type { PrimaryNavItemId };

type PrimaryNavigationIcons = {
	dockIcon: SolarIconComponent;
	sidebarIcon: SolarIconComponent;
};

export type PrimaryNavigationItem = PrimaryNavigationItemBase &
	PrimaryNavigationIcons;

const PRIMARY_NAV_ICONS: Record<PrimaryNavItemId, PrimaryNavigationIcons> = {
	admin: {
		dockIcon: ShieldCheck,
		sidebarIcon: ShieldCheck,
	},
	community: {
		dockIcon: Home,
		sidebarIcon: Home,
	},
	"community-new": {
		dockIcon: PencilLine,
		sidebarIcon: PencilLine,
	},
	feed: {
		dockIcon: UsersRound,
		sidebarIcon: UsersRound,
	},
	leaderboard: {
		dockIcon: Trophy,
		sidebarIcon: Trophy,
	},
	submit: {
		dockIcon: Plus,
		sidebarIcon: Plus,
	},
};

export function getPrimaryNavigationItems(
	context: PrimaryNavigationContext,
): PrimaryNavigationItem[] {
	return getPrimaryNavigationItemsBase(context).map((item) => ({
		...item,
		...PRIMARY_NAV_ICONS[item.id],
	}));
}

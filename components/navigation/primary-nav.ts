"use client";

import {
	FileText,
	Home,
	PencilLine,
	Plus,
	ShieldCheck,
	Trophy,
	type LucideIcon,
} from "lucide-react";
import {
	HomeIcon,
	PlusIcon,
	ResumeIcon,
	ShieldIcon,
	TrophyIcon,
	WritePostIcon,
	type SidebarAnimatedIconComponent,
} from "@/components/navigation/sidebar-icons";
import {
	getPrimaryNavigationItems as getPrimaryNavigationItemsBase,
	type PrimaryNavigationContext,
	type PrimaryNavigationItemBase,
	type PrimaryNavItemId,
} from "@/lib/primary-navigation";

export type { PrimaryNavItemId };

type PrimaryNavigationIcons = {
	dockIcon: LucideIcon;
	sidebarIcon: SidebarAnimatedIconComponent;
};

export type PrimaryNavigationItem = PrimaryNavigationItemBase &
	PrimaryNavigationIcons;

const PRIMARY_NAV_ICONS: Record<PrimaryNavItemId, PrimaryNavigationIcons> = {
	admin: {
		dockIcon: ShieldCheck,
		sidebarIcon: ShieldIcon,
	},
	community: {
		dockIcon: Home,
		sidebarIcon: HomeIcon,
	},
	"community-new": {
		dockIcon: PencilLine,
		sidebarIcon: WritePostIcon,
	},
	feed: {
		dockIcon: FileText,
		sidebarIcon: ResumeIcon,
	},
	leaderboard: {
		dockIcon: Trophy,
		sidebarIcon: TrophyIcon,
	},
	submit: {
		dockIcon: Plus,
		sidebarIcon: PlusIcon,
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

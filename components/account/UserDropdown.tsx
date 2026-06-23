"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import {
	ArrowLeft,
	ArrowRight,
	Bookmark,
	CheckCircle,
	CircleHelp,
	Contrast,
	Download,
	IdCard,
	Logout,
	Mailbox,
	Moon,
	ShieldCheck,
	Sun,
} from "@/components/ui/solar-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MenuAction =
	| "admin"
	| "profile"
	| "install"
	| "saved"
	| "help"
	| "feedback"
	| "logout";

type AppTheme = "dark" | "light";
type MobilePanel = "main" | "appearance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PhosphorIcon = ComponentType<any>;

type MenuItem = {
	icon: PhosphorIcon;
	label: string;
	action: MenuAction;
	iconClass?: string;
	badge?: {
		text: string;
		className: string;
	};
	rightIcon?: PhosphorIcon;
};

type ThemeItem = {
	value: AppTheme;
	icon: PhosphorIcon;
	label: string;
};

type UserDropdownUser = {
	name: string;
	username: string;
	avatar?: string;
	initials: string;
};

type UserDropdownProps = {
	isAdmin?: boolean;
	isOnline?: boolean;
	user?: UserDropdownUser;
	onAction?: (action: MenuAction) => void;
	onThemeChange?: (theme: AppTheme) => void;
	selectedTheme?: AppTheme;
	promoDiscount?: string;
};

const MENU_ITEMS: {
	appearance: ThemeItem[];
	profile: MenuItem[];
	admin: MenuItem[];
	activity: MenuItem[];
	account: MenuItem[];
} = {
	appearance: [
		{ value: "dark", icon: Moon, label: "Dark" },
		{ value: "light", icon: Sun, label: "Light" },
	],
	profile: [
		{
			icon: IdCard,
			label: "Your profile",
			action: "profile",
		},
		{
			icon: Download,
			label: "Install Linted",
			action: "install",
		},
	],
	admin: [
		{
			icon: ShieldCheck,
			label: "Admin console",
			action: "admin",
		},
	],
	activity: [
		{
			icon: Bookmark,
			label: "Saved resumes",
			action: "saved",
		},
		{
			icon: CircleHelp,
			label: "Get help",
			action: "help",
		},
		{
			icon: Mailbox,
			label: "Send feedback",
			action: "feedback",
			rightIcon: ArrowRight,
		},
	],
	account: [
		{ icon: Logout, label: "Log out", action: "logout" },
	],
};

export function UserDropdown({
	isAdmin = false,
	isOnline = false,
	user = {
		name: "Resume reviewer",
		username: "@linted",
		avatar:
			"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces",
		initials: "LI",
	},
	onAction = () => undefined,
	onThemeChange = () => undefined,
	selectedTheme = "dark",
	promoDiscount,
}: UserDropdownProps) {
	const [open, setOpen] = useState(false);
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("main");

	const renderMenuItem = (item: MenuItem, index: number) => {
		const ItemIcon = item.icon;
		const RightIcon = item.rightIcon;
		return (
			<DropdownMenuItem
				key={`${item.action}-${index}`}
				className={cn(
					item.badge || item.rightIcon ? "justify-between" : "",
					"cursor-pointer rounded-lg p-2",
				)}
				onClick={() => onAction(item.action)}
			>
				<span className="flex items-center gap-1.5 font-medium">
					<ItemIcon
						aria-hidden="true"
						className={cn("size-5 text-[var(--text-tertiary)]", item.iconClass)}
					/>
					{item.label}
				</span>
				{item.badge ? (
					<Badge className={item.badge.className}>
						{promoDiscount || item.badge.text}
					</Badge>
				) : null}
				{RightIcon ? (
					<RightIcon
						aria-hidden="true"
						className="size-4 text-[var(--text-tertiary)]"
					/>
				) : null}
			</DropdownMenuItem>
		);
	};

	const selectedThemeItem =
		MENU_ITEMS.appearance.find((theme) => theme.value === selectedTheme) ??
		MENU_ITEMS.appearance[0];

	const renderMobilePanelTrigger = (
		panel: Exclude<MobilePanel, "main">,
		PanelIcon: PhosphorIcon,
		label: string,
		valueLabel: string,
	) => (
		<button
			className="user-menu-mobile-trigger"
			onClick={() => setMobilePanel(panel)}
			type="button"
		>
			<span className="user-menu-mobile-trigger-label">
				<PanelIcon aria-hidden="true" className="size-5" />
				{label}
			</span>
			<span className="user-menu-mobile-trigger-value">{valueLabel}</span>
			<ArrowRight
				aria-hidden="true"
				className="user-menu-mobile-trigger-chevron"
			/>
		</button>
	);

	const renderMobileDrilldown = () => {
		const title = "Appearance";
		const selectedValue = selectedTheme;

		return (
			<section className="user-menu-mobile-panel">
				<button
					className="user-menu-mobile-back"
					onClick={() => setMobilePanel("main")}
					type="button"
				>
					<ArrowLeft aria-hidden="true" className="size-5" />
					{title}
				</button>
				<div className="user-menu-mobile-list" aria-label={title}>
					{MENU_ITEMS.appearance.map((item) => {
						const ThemeIcon = item.icon;
						return (
							<button
								aria-pressed={selectedValue === item.value}
								className={cn(
									"user-menu-mobile-option",
									selectedValue === item.value ? "is-selected" : "",
								)}
								key={item.value}
								onClick={() => {
									onThemeChange(item.value === "light" ? "light" : "dark");
									setMobilePanel("main");
								}}
								type="button"
							>
								<span>
									<ThemeIcon aria-hidden="true" className="size-5" />
									{item.label}
								</span>
								{selectedValue === item.value ? (
									<CheckCircle aria-hidden="true" className="size-5" />
								) : null}
							</button>
						);
					})}
				</div>
			</section>
		);
	};

	return (
		<DropdownMenu
			modal={false}
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) {
					setMobilePanel("main");
				}
			}}
		>
			<DropdownMenuTrigger asChild>
				<button
					aria-label="Open profile menu"
					className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
					type="button"
				>
					<Avatar className="size-10 cursor-pointer border border-[var(--border-default)] shadow-sm">
						<AvatarImage src={user.avatar} alt={user.name} />
						<AvatarFallback className="bg-[var(--brand)] text-[var(--text-inverse)]">
							{user.initials}
						</AvatarFallback>
					</Avatar>
					{isOnline ? (
						<span
							aria-hidden="true"
							className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--bg-base)] bg-green-500 shadow-sm"
						/>
					) : null}
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				className="user-menu-content no-scrollbar z-[1000] w-[310px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/30"
				align="end"
				collisionPadding={12}
				sideOffset={12}
			>
				{mobilePanel !== "main" ? renderMobileDrilldown() : null}
				<div className={mobilePanel === "main" ? "" : "user-menu-main-hidden"}>
				<section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow backdrop-blur-lg">
					<div className="flex items-center p-2">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<span className="relative shrink-0">
								<Avatar className="size-10 cursor-pointer border border-[var(--border-default)] shadow">
									<AvatarImage src={user.avatar} alt={user.name} />
									<AvatarFallback className="bg-[var(--brand)] text-[var(--text-inverse)]">
										{user.initials}
									</AvatarFallback>
								</Avatar>
								{isOnline ? (
									<span
										aria-label="Online now"
										className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--bg-surface)] bg-green-500 shadow-sm"
										title="Online now"
									/>
								) : null}
							</span>
							<div className="min-w-0 flex-1">
								<h3
									className="truncate text-sm font-semibold text-[var(--text-primary)]"
									title={user.name}
								>
									{user.name}
								</h3>
								<p
									className="truncate text-xs text-[var(--text-secondary)]"
									title={user.username}
								>
									{user.username}
								</p>
							</div>
						</div>
					</div>

					<DropdownMenuGroup>
						{MENU_ITEMS.profile.map(renderMenuItem)}
						<div className="user-menu-submenu-only">
							<DropdownMenuSub>
								<DropdownMenuSubTrigger className="cursor-pointer rounded-lg p-2">
									<span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
										<Contrast
											aria-hidden="true"
											className="size-5 text-[var(--text-tertiary)]"
										/>
										Appearance
									</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuPortal>
									<DropdownMenuSubContent
										className="z-[1001] border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] backdrop-blur-lg"
										collisionPadding={12}
										sideOffset={8}
									>
										<DropdownMenuRadioGroup
											value={selectedTheme}
											onValueChange={(value) =>
												onThemeChange(value === "light" ? "light" : "dark")
											}
										>
											{MENU_ITEMS.appearance.map((themeItem) => {
												const ThemeIcon = themeItem.icon;
												return (
													<DropdownMenuRadioItem
														className="gap-2 pr-3"
														key={themeItem.value}
														value={themeItem.value}
													>
														<ThemeIcon
															aria-hidden="true"
															className="size-5 text-[var(--text-tertiary)]"
														/>
														<span className="flex-1">{themeItem.label}</span>
														{selectedTheme === themeItem.value ? (
															<CheckCircle
																aria-hidden="true"
																className="ml-auto size-4 text-[var(--brand)]"
															/>
														) : null}
													</DropdownMenuRadioItem>
												);
											})}
										</DropdownMenuRadioGroup>
									</DropdownMenuSubContent>
								</DropdownMenuPortal>
							</DropdownMenuSub>
						</div>
						{renderMobilePanelTrigger(
							"appearance",
							Contrast,
							"Appearance",
							selectedThemeItem.label,
						)}
					</DropdownMenuGroup>

					{isAdmin ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								{MENU_ITEMS.admin.map(renderMenuItem)}
							</DropdownMenuGroup>
						</>
					) : null}

					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						{MENU_ITEMS.activity.map(renderMenuItem)}
					</DropdownMenuGroup>
				</section>

				<section className="mt-1 rounded-2xl p-1">
					<DropdownMenuGroup>
						{MENU_ITEMS.account.map(renderMenuItem)}
					</DropdownMenuGroup>
				</section>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

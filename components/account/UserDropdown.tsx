"use client";

import { Fragment, useState } from "react";
import altArrowLeftLineDuotone from "@iconify-icons/solar/alt-arrow-left-line-duotone";
import altArrowRightLineDuotone from "@iconify-icons/solar/alt-arrow-right-line-duotone";
import bookmarkLineDuotone from "@iconify-icons/solar/bookmark-line-duotone";
import checkCircleBold from "@iconify-icons/solar/check-circle-bold";
import documentAddLineDuotone from "@iconify-icons/solar/document-add-line-duotone";
import letterUnreadLineDuotone from "@iconify-icons/solar/letter-unread-line-duotone";
import logout2BoldDuotone from "@iconify-icons/solar/logout-2-bold-duotone";
import moonLineDuotone from "@iconify-icons/solar/moon-line-duotone";
import paletteRoundLineDuotone from "@iconify-icons/solar/palette-round-line-duotone";
import questionCircleLineDuotone from "@iconify-icons/solar/question-circle-line-duotone";
import shieldCheckLineDuotone from "@iconify-icons/solar/shield-check-line-duotone";
import smartphone2LineDuotone from "@iconify-icons/solar/smartphone-2-line-duotone";
import squareTopDownLineDuotone from "@iconify-icons/solar/square-top-down-line-duotone";
import sunLineDuotone from "@iconify-icons/solar/sun-line-duotone";
import userCircleLineDuotone from "@iconify-icons/solar/user-circle-line-duotone";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
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
	| "submit"
	| "install"
	| "saved"
	| "help"
	| "feedback"
	| "logout";

type AppTheme = "dark" | "light";
type MobilePanel = "main" | "appearance";

type MenuItem = {
	icon: IconifyIcon;
	label: string;
	action: MenuAction;
	iconClass?: string;
	badge?: {
		text: string;
		className: string;
	};
	rightIcon?: IconifyIcon;
};

type ThemeItem = {
	value: AppTheme;
	icon: IconifyIcon;
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
		{ value: "dark", icon: moonLineDuotone, label: "Dark" },
		{ value: "light", icon: sunLineDuotone, label: "Light" },
	],
	profile: [
		{
			icon: userCircleLineDuotone,
			label: "Your profile",
			action: "profile",
		},
		{
			icon: documentAddLineDuotone,
			label: "Post resume",
			action: "submit",
		},
		{
			icon: smartphone2LineDuotone,
			label: "Install Linted",
			action: "install",
		},
	],
	admin: [
		{
			icon: shieldCheckLineDuotone,
			label: "Admin console",
			action: "admin",
		},
	],
	activity: [
		{
			icon: bookmarkLineDuotone,
			label: "Saved resumes",
			action: "saved",
		},
		{
			icon: questionCircleLineDuotone,
			label: "Get help",
			action: "help",
		},
		{
			icon: letterUnreadLineDuotone,
			label: "Send feedback",
			action: "feedback",
			rightIcon: squareTopDownLineDuotone,
		},
	],
	account: [
		{ icon: logout2BoldDuotone, label: "Log out", action: "logout" },
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
					<Icon
						aria-hidden="true"
						icon={item.icon}
						className={cn("size-5 text-[var(--text-tertiary)]", item.iconClass)}
					/>
					{item.label}
				</span>
				{item.badge ? (
					<Badge className={item.badge.className}>
						{promoDiscount || item.badge.text}
					</Badge>
				) : null}
				{item.rightIcon ? (
					<Icon
						aria-hidden="true"
						icon={item.rightIcon}
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
		icon: IconifyIcon,
		label: string,
		valueLabel: string,
	) => (
		<button
			className="user-menu-mobile-trigger"
			onClick={() => setMobilePanel(panel)}
			type="button"
		>
			<span className="user-menu-mobile-trigger-label">
				<Icon aria-hidden="true" className="size-5" icon={icon} />
				{label}
			</span>
			<span className="user-menu-mobile-trigger-value">{valueLabel}</span>
			<Icon
				aria-hidden="true"
				className="user-menu-mobile-trigger-chevron"
				icon={altArrowRightLineDuotone}
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
					<Icon
						aria-hidden="true"
						className="size-5"
						icon={altArrowLeftLineDuotone}
					/>
					{title}
				</button>
				<div className="user-menu-mobile-list" aria-label={title}>
					{MENU_ITEMS.appearance.map((item) => (
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
								<Icon aria-hidden="true" className="size-5" icon={item.icon} />
								{item.label}
							</span>
							{selectedValue === item.value ? (
								<Icon
									aria-hidden="true"
									className="size-5"
									icon={checkCircleBold}
								/>
							) : null}
						</button>
					))}
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
							className="absolute right-0 top-0 size-3 rounded-full border-2 border-[var(--bg-base)] bg-green-500 shadow-sm"
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
										className="absolute right-0 top-0 size-3 rounded-full border-2 border-[var(--bg-surface)] bg-green-500 shadow-sm"
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
						{MENU_ITEMS.profile.map((item, index) => (
							<Fragment key={`${item.action}-${index}`}>
								{renderMenuItem(item, index)}
								{item.action === "submit" ? (
									<>
										<div className="user-menu-submenu-only">
											<DropdownMenuSub>
												<DropdownMenuSubTrigger className="cursor-pointer rounded-lg p-2">
													<span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
														<Icon
															aria-hidden="true"
															className="size-5 text-[var(--text-tertiary)]"
															icon={paletteRoundLineDuotone}
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
															{MENU_ITEMS.appearance.map((themeItem) => (
																<DropdownMenuRadioItem
																	className="gap-2 pr-3"
																	key={themeItem.value}
																	value={themeItem.value}
																>
																	<Icon
																		aria-hidden="true"
																		className="size-5 text-[var(--text-tertiary)]"
																		icon={themeItem.icon}
																	/>
																	<span className="flex-1">{themeItem.label}</span>
																	{selectedTheme === themeItem.value ? (
																		<Icon
																			aria-hidden="true"
																			className="ml-auto size-4 text-[var(--brand)]"
																			icon={checkCircleBold}
																		/>
																	) : null}
																</DropdownMenuRadioItem>
															))}
														</DropdownMenuRadioGroup>
													</DropdownMenuSubContent>
												</DropdownMenuPortal>
											</DropdownMenuSub>
										</div>
										{renderMobilePanelTrigger(
											"appearance",
											paletteRoundLineDuotone,
											"Appearance",
											selectedThemeItem.label,
										)}
									</>
								) : null}
							</Fragment>
						))}
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

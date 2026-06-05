"use client";

import { Fragment, useState } from "react";
import altArrowLeftLineDuotone from "@iconify-icons/solar/alt-arrow-left-line-duotone";
import altArrowRightLineDuotone from "@iconify-icons/solar/alt-arrow-right-line-duotone";
import bellLineDuotone from "@iconify-icons/solar/bell-line-duotone";
import bookmarkLineDuotone from "@iconify-icons/solar/bookmark-line-duotone";
import checkCircleBold from "@iconify-icons/solar/check-circle-bold";
import documentAddLineDuotone from "@iconify-icons/solar/document-add-line-duotone";
import emojiFunnyCircleLineDuotone from "@iconify-icons/solar/emoji-funny-circle-line-duotone";
import fireLineDuotone from "@iconify-icons/solar/fire-line-duotone";
import letterUnreadLineDuotone from "@iconify-icons/solar/letter-unread-line-duotone";
import logout2BoldDuotone from "@iconify-icons/solar/logout-2-bold-duotone";
import moonLineDuotone from "@iconify-icons/solar/moon-line-duotone";
import moonSleepLineDuotone from "@iconify-icons/solar/moon-sleep-line-duotone";
import paletteRoundLineDuotone from "@iconify-icons/solar/palette-round-line-duotone";
import questionCircleLineDuotone from "@iconify-icons/solar/question-circle-line-duotone";
import smileCircleLineDuotone from "@iconify-icons/solar/smile-circle-line-duotone";
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
	| "profile"
	| "submit"
	| "notifications"
	| "saved"
	| "help"
	| "feedback"
	| "logout";

type AppTheme = "dark" | "light";
type MobilePanel = "main" | "status" | "appearance";

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

type StatusItem = {
	value: string;
	icon: IconifyIcon;
	label: string;
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
	status: "online" | "focus" | "offline" | "busy";
};

type UserDropdownProps = {
	user?: UserDropdownUser;
	onAction?: (action: MenuAction) => void;
	onStatusChange?: (status: string) => void;
	onThemeChange?: (theme: AppTheme) => void;
	selectedStatus?: string;
	selectedTheme?: AppTheme;
	promoDiscount?: string;
};

const MENU_ITEMS: {
	status: StatusItem[];
	appearance: ThemeItem[];
	profile: MenuItem[];
	activity: MenuItem[];
	account: MenuItem[];
} = {
	status: [
		{ value: "online", icon: fireLineDuotone, label: "Reviewing" },
		{
			value: "focus",
			icon: emojiFunnyCircleLineDuotone,
			label: "Focus",
		},
		{
			value: "offline",
			icon: moonSleepLineDuotone,
			label: "Appear offline",
		},
	],
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
			icon: bellLineDuotone,
			label: "Notifications",
			action: "notifications",
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
	user = {
		name: "Resume reviewer",
		username: "@linted",
		avatar:
			"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces",
		initials: "LI",
		status: "online",
	},
	onAction = () => undefined,
	onStatusChange = () => undefined,
	onThemeChange = () => undefined,
	selectedStatus = "online",
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

	const getStatusColor = (status: string) => {
		const colors = {
			online:
				"border-green-300 bg-green-100 text-green-700 dark:border-green-500/50 dark:bg-green-900/30 dark:text-green-400",
			focus:
				"border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-500/50 dark:bg-orange-900/30 dark:text-orange-400",
			offline:
				"border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400",
			busy: "border-red-300 bg-red-100 text-red-600 dark:border-red-500/50 dark:bg-red-900/30 dark:text-red-400",
		};

		return colors[status.toLowerCase() as keyof typeof colors] || colors.online;
	};

	const selectedStatusItem =
		MENU_ITEMS.status.find((status) => status.value === selectedStatus) ??
		MENU_ITEMS.status[0];
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
		const isStatusPanel = mobilePanel === "status";
		const title = isStatusPanel ? "Update status" : "Appearance";
		const items = isStatusPanel ? MENU_ITEMS.status : MENU_ITEMS.appearance;
		const selectedValue = isStatusPanel ? selectedStatus : selectedTheme;

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
					{items.map((item) => (
						<button
							aria-pressed={selectedValue === item.value}
							className={cn(
								"user-menu-mobile-option",
								selectedValue === item.value ? "is-selected" : "",
							)}
							key={item.value}
							onClick={() => {
								if (isStatusPanel) {
									onStatusChange(item.value);
								} else {
									onThemeChange(item.value === "light" ? "light" : "dark");
								}
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
				<Avatar className="size-10 cursor-pointer border border-[var(--border-default)] shadow-sm">
					<AvatarImage src={user.avatar} alt={user.name} />
					<AvatarFallback className="bg-[var(--brand)] text-[var(--text-inverse)]">
						{user.initials}
					</AvatarFallback>
				</Avatar>
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
							<Avatar className="size-10 cursor-pointer border border-[var(--border-default)] shadow">
								<AvatarImage src={user.avatar} alt={user.name} />
								<AvatarFallback className="bg-[var(--brand)] text-[var(--text-inverse)]">
									{user.initials}
								</AvatarFallback>
							</Avatar>
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
						<Badge
							className={`${getStatusColor(user.status)} shrink-0 rounded-sm border-[0.5px] text-[11px] capitalize`}
						>
							{user.status === "online" ? "reviewing" : user.status}
						</Badge>
					</div>

					<DropdownMenuGroup>
						<div className="user-menu-submenu-only">
							<DropdownMenuSub>
								<DropdownMenuSubTrigger className="cursor-pointer rounded-lg p-2">
									<span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
										<Icon
											aria-hidden="true"
											className="size-5 text-[var(--text-tertiary)]"
											icon={smileCircleLineDuotone}
										/>
										Update status
									</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuPortal>
									<DropdownMenuSubContent
										className="z-[1001] border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] backdrop-blur-lg"
										collisionPadding={12}
										sideOffset={8}
									>
										<DropdownMenuRadioGroup
											value={selectedStatus}
											onValueChange={onStatusChange}
										>
											{MENU_ITEMS.status.map((status, index) => (
												<DropdownMenuRadioItem
													className="gap-2"
													key={index}
													value={status.value}
												>
													<Icon
														aria-hidden="true"
														className="size-5 text-[var(--text-tertiary)]"
														icon={status.icon}
													/>
													{status.label}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuSubContent>
								</DropdownMenuPortal>
							</DropdownMenuSub>
						</div>
						{renderMobilePanelTrigger(
							"status",
							smileCircleLineDuotone,
							"Status",
							selectedStatusItem.label,
						)}
					</DropdownMenuGroup>

					<DropdownMenuSeparator />
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
																	className="gap-2"
																	key={themeItem.value}
																	value={themeItem.value}
																>
																	<Icon
																		aria-hidden="true"
																		className="size-5 text-[var(--text-tertiary)]"
																		icon={themeItem.icon}
																	/>
																	{themeItem.label}
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

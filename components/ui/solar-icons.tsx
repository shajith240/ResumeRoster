"use client";

import activityIcon from "@iconify-icons/solar/pulse-line-duotone";
import addCircleIcon from "@iconify-icons/solar/add-circle-line-duotone";
import arrowDownIcon from "@iconify-icons/solar/alt-arrow-down-line-duotone";
import arrowLeftIcon from "@iconify-icons/solar/alt-arrow-left-line-duotone";
import arrowRightIcon from "@iconify-icons/solar/alt-arrow-right-line-duotone";
import arrowUpIcon from "@iconify-icons/solar/alt-arrow-up-line-duotone";
import badgeCheckIcon from "@iconify-icons/solar/verified-check-line-duotone";
import bellIcon from "@iconify-icons/solar/bell-line-duotone";
import bellOffIcon from "@iconify-icons/solar/bell-off-line-duotone";
import bellRingIcon from "@iconify-icons/solar/bell-bing-line-duotone";
import bookmarkFilledIcon from "@iconify-icons/solar/bookmark-bold-duotone";
import bookmarkIcon from "@iconify-icons/solar/bookmark-line-duotone";
import briefcaseIcon from "@iconify-icons/solar/case-line-duotone";
import calendarIcon from "@iconify-icons/solar/calendar-date-line-duotone";
import cameraIcon from "@iconify-icons/solar/camera-line-duotone";
import checkCircleIcon from "@iconify-icons/solar/check-circle-line-duotone";
import checkReadIcon from "@iconify-icons/solar/check-read-line-duotone";
import checklistIcon from "@iconify-icons/solar/checklist-line-duotone";
import clockIcon from "@iconify-icons/solar/clock-circle-line-duotone";
import closeCircleIcon from "@iconify-icons/solar/close-circle-line-duotone";
import codeIcon from "@iconify-icons/solar/code-2-line-duotone";
import dangerCircleIcon from "@iconify-icons/solar/danger-circle-line-duotone";
import databaseIcon from "@iconify-icons/solar/database-line-duotone";
import diplomaIcon from "@iconify-icons/solar/diploma-line-duotone";
import downloadIcon from "@iconify-icons/solar/download-line-duotone";
import editIcon from "@iconify-icons/solar/pen-new-square-line-duotone";
import externalLinkIcon from "@iconify-icons/solar/square-alt-arrow-right-line-duotone";
import eyeIcon from "@iconify-icons/solar/eye-line-duotone";
import fileTextIcon from "@iconify-icons/solar/file-text-line-duotone";
import fireIcon from "@iconify-icons/solar/fire-line-duotone";
import flagIcon from "@iconify-icons/solar/flag-2-line-duotone";
import forwardIcon from "@iconify-icons/solar/forward-line-duotone";
import galleryIcon from "@iconify-icons/solar/gallery-line-duotone";
import galleryWideIcon from "@iconify-icons/solar/gallery-wide-line-duotone";
import handStarsIcon from "@iconify-icons/solar/hand-stars-line-duotone";
import hamburgerIcon from "@iconify-icons/solar/hamburger-menu-line-duotone";
import historyIcon from "@iconify-icons/solar/history-line-duotone";
import homeIcon from "@iconify-icons/solar/home-smile-line-duotone";
import inboxIcon from "@iconify-icons/solar/inbox-line-duotone";
import letterIcon from "@iconify-icons/solar/letter-line-duotone";
import likeFilledIcon from "@iconify-icons/solar/like-bold-duotone";
import likeIcon from "@iconify-icons/solar/like-line-duotone";
import linkIcon from "@iconify-icons/solar/link-line-duotone";
import listIcon from "@iconify-icons/solar/list-line-duotone";
import lockIcon from "@iconify-icons/solar/lock-keyhole-line-duotone";
import mapPointIcon from "@iconify-icons/solar/map-point-line-duotone";
import maximizeIcon from "@iconify-icons/solar/maximize-line-duotone";
import menuDotsIcon from "@iconify-icons/solar/menu-dots-line-duotone";
import messageCircleIcon from "@iconify-icons/solar/chat-round-line-duotone";
import messageReplyIcon from "@iconify-icons/solar/chat-square-arrow-line-duotone";
import messageSquareIcon from "@iconify-icons/solar/chat-square-line-duotone";
import minusCircleIcon from "@iconify-icons/solar/minus-circle-line-duotone";
import pauseIcon from "@iconify-icons/solar/pause-circle-line-duotone";
import penIcon from "@iconify-icons/solar/pen-line-duotone";
import plainIcon from "@iconify-icons/solar/plain-2-line-duotone";
import playIcon from "@iconify-icons/solar/play-circle-line-duotone";
import refreshIcon from "@iconify-icons/solar/refresh-line-duotone";
import restartIcon from "@iconify-icons/solar/restart-line-duotone";
import searchIcon from "@iconify-icons/solar/rounded-magnifer-line-duotone";
import shareIcon from "@iconify-icons/solar/share-line-duotone";
import shieldCheckIcon from "@iconify-icons/solar/shield-check-line-duotone";
import shieldWarningIcon from "@iconify-icons/solar/shield-warning-line-duotone";
import smartphoneIcon from "@iconify-icons/solar/smartphone-2-line-duotone";
import starIcon from "@iconify-icons/solar/star-fall-2-line-duotone";
import tableIcon from "@iconify-icons/solar/widget-4-line-duotone";
import textBoldIcon from "@iconify-icons/solar/text-bold-line-duotone";
import textCrossIcon from "@iconify-icons/solar/text-cross-line-duotone";
import textIcon from "@iconify-icons/solar/text-line-duotone";
import textItalicIcon from "@iconify-icons/solar/text-italic-line-duotone";
import textSquareIcon from "@iconify-icons/solar/text-square-line-duotone";
import thumbsDownFilledIcon from "@iconify-icons/solar/dislike-bold-duotone";
import thumbsDownIcon from "@iconify-icons/solar/dislike-line-duotone";
import trashIcon from "@iconify-icons/solar/trash-bin-trash-line-duotone";
import trophyIcon from "@iconify-icons/solar/cup-star-line-duotone";
import unlockIcon from "@iconify-icons/solar/lock-unlocked-line-duotone";
import uploadIcon from "@iconify-icons/solar/upload-line-duotone";
import userCheckIcon from "@iconify-icons/solar/user-check-line-duotone";
import userCircleIcon from "@iconify-icons/solar/user-circle-line-duotone";
import userCrossIcon from "@iconify-icons/solar/user-cross-line-duotone";
import usersIcon from "@iconify-icons/solar/users-group-rounded-line-duotone";
import widgetIcon from "@iconify-icons/solar/widget-2-line-duotone";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import type {
	ComponentPropsWithoutRef,
	CSSProperties,
	ReactElement,
	SVGProps,
} from "react";

type NativeSolarSvgProps = Omit<
	SVGProps<SVGSVGElement>,
	"color" | "height" | "mode" | "ref" | "width"
>;

export type SolarIconProps = NativeSolarSvgProps & {
	absoluteStrokeWidth?: boolean;
	color?: string;
	height?: number | string;
	size?: number | string;
	strokeWidth?: number | string;
	width?: number | string;
};

export type SolarIconComponent = {
	(props: SolarIconProps): ReactElement;
	displayName?: string;
};

export type LucideIcon = SolarIconComponent;

function createSolarIcon(displayName: string, icon: IconifyIcon): SolarIconComponent {
	const SolarIcon = ({
		absoluteStrokeWidth,
		color,
		height,
		size = 24,
		strokeWidth,
		style,
		width,
		...props
	}: SolarIconProps) => {
		void absoluteStrokeWidth;
		void strokeWidth;

		const iconStyle: CSSProperties | undefined = color
			? { ...style, color }
			: style;
		const iconProps = props as Omit<
			ComponentPropsWithoutRef<typeof Icon>,
			"height" | "icon" | "width"
		>;

		return (
			<Icon
				height={height ?? size}
				icon={icon}
				style={iconStyle}
				width={width ?? size}
				{...iconProps}
			/>
		);
	};

	SolarIcon.displayName = displayName;
	return SolarIcon;
}

export const Activity = createSolarIcon("Activity", activityIcon);
export const ArrowRight = createSolarIcon("ArrowRight", arrowRightIcon);
export const BadgeCheck = createSolarIcon("BadgeCheck", badgeCheckIcon);
export const Bell = createSolarIcon("Bell", bellIcon);
export const BellOff = createSolarIcon("BellOff", bellOffIcon);
export const BellRing = createSolarIcon("BellRing", bellRingIcon);
export const Bold = createSolarIcon("Bold", textBoldIcon);
export const Bookmark = createSolarIcon("Bookmark", bookmarkIcon);
export const BookmarkFilled = createSolarIcon("BookmarkFilled", bookmarkFilledIcon);
export const Braces = createSolarIcon("Braces", codeIcon);
export const BriefcaseBusiness = createSolarIcon(
	"BriefcaseBusiness",
	briefcaseIcon,
);
export const CalendarDays = createSolarIcon("CalendarDays", calendarIcon);
export const Camera = createSolarIcon("Camera", cameraIcon);
export const Check = createSolarIcon("Check", checkCircleIcon);
export const CheckCheck = createSolarIcon("CheckCheck", checkReadIcon);
export const CheckCircle2 = createSolarIcon("CheckCircle2", checkCircleIcon);
export const ChevronDown = createSolarIcon("ChevronDown", arrowDownIcon);
export const ChevronLeft = createSolarIcon("ChevronLeft", arrowLeftIcon);
export const ChevronRight = createSolarIcon("ChevronRight", arrowRightIcon);
export const ChevronUp = createSolarIcon("ChevronUp", arrowUpIcon);
export const CircleAlert = createSolarIcon("CircleAlert", dangerCircleIcon);
export const Clock = createSolarIcon("Clock", clockIcon);
export const Code = createSolarIcon("Code", codeIcon);
export const Database = createSolarIcon("Database", databaseIcon);
export const Download = createSolarIcon("Download", downloadIcon);
export const Edit3 = createSolarIcon("Edit3", editIcon);
export const ExternalLink = createSolarIcon("ExternalLink", externalLinkIcon);
export const Eye = createSolarIcon("Eye", eyeIcon);
export const FileText = createSolarIcon("FileText", fileTextIcon);
export const Fire = createSolarIcon("Fire", fireIcon);
export const Flag = createSolarIcon("Flag", flagIcon);
export const Forward = createSolarIcon("Forward", forwardIcon);
export const GraduationCap = createSolarIcon("GraduationCap", diplomaIcon);
export const Heading2 = createSolarIcon("Heading2", textSquareIcon);
export const History = createSolarIcon("History", historyIcon);
export const Home = createSolarIcon("Home", homeIcon);
export const Image = createSolarIcon("Image", galleryIcon);
export const ImageIcon = createSolarIcon("ImageIcon", galleryIcon);
export const Images = createSolarIcon("Images", galleryWideIcon);
export const Inbox = createSolarIcon("Inbox", inboxIcon);
export const Italic = createSolarIcon("Italic", textItalicIcon);
export const LayoutDashboard = createSolarIcon("LayoutDashboard", widgetIcon);
export const Link = createSolarIcon("Link", linkIcon);
export const List = createSolarIcon("List", listIcon);
export const ListChecks = createSolarIcon("ListChecks", checklistIcon);
export const ListOrdered = createSolarIcon("ListOrdered", checklistIcon);
export const Loader2 = createSolarIcon("Loader2", refreshIcon);
export const Lock = createSolarIcon("Lock", lockIcon);
export const Mail = createSolarIcon("Mail", letterIcon);
export const MapPin = createSolarIcon("MapPin", mapPointIcon);
export const Maximize2 = createSolarIcon("Maximize2", maximizeIcon);
export const Menu = createSolarIcon("Menu", hamburgerIcon);
export const MessageCircle = createSolarIcon("MessageCircle", messageCircleIcon);
export const MessageSquare = createSolarIcon("MessageSquare", messageSquareIcon);
export const MessageSquareReply = createSolarIcon(
	"MessageSquareReply",
	messageReplyIcon,
);
export const Minus = createSolarIcon("Minus", minusCircleIcon);
export const MoreHorizontal = createSolarIcon("MoreHorizontal", menuDotsIcon);
export const MoreVertical = createSolarIcon("MoreVertical", menuDotsIcon);
export const Pause = createSolarIcon("Pause", pauseIcon);
export const Pencil = createSolarIcon("Pencil", penIcon);
export const PencilLine = createSolarIcon("PencilLine", editIcon);
export const Play = createSolarIcon("Play", playIcon);
export const Plus = createSolarIcon("Plus", addCircleIcon);
export const Quote = createSolarIcon("Quote", textSquareIcon);
export const RefreshCcw = createSolarIcon("RefreshCcw", restartIcon);
export const RefreshCw = createSolarIcon("RefreshCw", refreshIcon);
export const RotateCcw = createSolarIcon("RotateCcw", restartIcon);
export const Search = createSolarIcon("Search", searchIcon);
export const Send = createSolarIcon("Send", plainIcon);
export const Share2 = createSolarIcon("Share2", shareIcon);
export const ShieldAlert = createSolarIcon("ShieldAlert", shieldWarningIcon);
export const ShieldCheck = createSolarIcon("ShieldCheck", shieldCheckIcon);
export const Smartphone = createSolarIcon("Smartphone", smartphoneIcon);
export const Sparkles = createSolarIcon("Sparkles", handStarsIcon);
export const Star = createSolarIcon("Star", starIcon);
export const Strikethrough = createSolarIcon("Strikethrough", textCrossIcon);
export const Table = createSolarIcon("Table", tableIcon);
export const ThumbsDown = createSolarIcon("ThumbsDown", thumbsDownIcon);
export const ThumbsDownFilled = createSolarIcon(
	"ThumbsDownFilled",
	thumbsDownFilledIcon,
);
export const ThumbsUp = createSolarIcon("ThumbsUp", likeIcon);
export const ThumbsUpFilled = createSolarIcon("ThumbsUpFilled", likeFilledIcon);
export const Trash = createSolarIcon("Trash", trashIcon);
export const Trash2 = createSolarIcon("Trash2", trashIcon);
export const Trophy = createSolarIcon("Trophy", trophyIcon);
export const Type = createSolarIcon("Type", textIcon);
export const Unlock = createSolarIcon("Unlock", unlockIcon);
export const Upload = createSolarIcon("Upload", uploadIcon);
export const UserCheck = createSolarIcon("UserCheck", userCheckIcon);
export const UserRound = createSolarIcon("UserRound", userCircleIcon);
export const UsersRound = createSolarIcon("UsersRound", usersIcon);
export const UserX = createSolarIcon("UserX", userCrossIcon);
export const X = createSolarIcon("X", closeCircleIcon);
export const XCircle = createSolarIcon("XCircle", closeCircleIcon);

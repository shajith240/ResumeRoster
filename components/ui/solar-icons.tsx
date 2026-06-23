// Icon set: pqoqubbw/icons (animated, parent-hover) + @phosphor-icons/react fallbacks
// All pqoqubbw icons are wrapped with withParentHover so they animate on parent button hover.
"use client";

import type { ComponentType } from "react";
import type { HTMLAttributes } from "react";
import { withParentHover } from "@/components/ui/anim-icon";

// ─── Shared types ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LucideIcon = ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SolarIconComponent = ComponentType<any>;
export type SolarIconProps = HTMLAttributes<HTMLDivElement>;

// ─── Animated icons — parent-hover wrapped ────────────────────────────────────
import { ActivityIcon          } from "@/components/icons";
import { ArrowDownIcon         } from "@/components/icons";
import { ArrowLeftIcon         } from "@/components/icons";
import { ArrowRightIcon        } from "@/components/icons";
import { ArrowUpIcon           } from "@/components/icons";
import { BanIcon               } from "@/components/icons";
import { BadgeAlertIcon        } from "@/components/icons";
import { BellIcon              } from "@/components/icons";
import { BellElectricIcon      } from "@/components/icons";
import { BoldIcon              } from "@/components/icons";
import { BookmarkIcon          } from "@/components/icons";
import { BookmarkCheckIcon     } from "@/components/icons";
import { BookmarkPlusIcon      } from "@/components/icons";
import { BriefcaseBusinessIcon } from "@/components/icons";
import { CalendarDaysIcon      } from "@/components/icons";
import { CheckIcon             } from "@/components/icons";
import { CheckCheckIcon        } from "@/components/icons";
import { CircleCheckIcon       } from "@/components/icons";
import { CircleHelpIcon        } from "@/components/icons";
import { ContrastIcon          } from "@/components/icons";
import { CrownIcon             } from "@/components/icons";
import { MailboxIcon           } from "@/components/icons";
import { ChevronDownIcon       } from "@/components/icons";
import { ChevronLeftIcon       } from "@/components/icons";
import { ChevronRightIcon      } from "@/components/icons";
import { ChevronUpIcon         } from "@/components/icons";
import { ClockIcon             } from "@/components/icons";
import { CopyIcon              } from "@/components/icons";
import { DeleteIcon            } from "@/components/icons";
import { DownloadIcon          } from "@/components/icons";
import { DownvoteIcon          } from "@/components/icons";
import { EyeIcon               } from "@/components/icons";
import { EyeOffIcon            } from "@/components/icons";
import { FilePenLineIcon       } from "@/components/icons";
import { FileTextIcon          } from "@/components/icons";
import { FlameIcon             } from "@/components/icons";
import { GalleryThumbnailsIcon } from "@/components/icons";
import { GraduationCapIcon     } from "@/components/icons";
import { GripHorizontalIcon    } from "@/components/icons";
import { GripVerticalIcon      } from "@/components/icons";
import { HistoryIcon           } from "@/components/icons";
import { IdCardIcon            } from "@/components/icons";
import { HomeIcon              } from "@/components/icons";
import { ItalicIcon            } from "@/components/icons";
import { LayoutPanelTopIcon    } from "@/components/icons";
import { LinkIcon              } from "@/components/icons";
import { LoaderCircleIcon      } from "@/components/icons";
import { LockIcon              } from "@/components/icons";
import { LockOpenIcon          } from "@/components/icons";
import { LogInIcon             } from "@/components/icons";
import { LogoutIcon            } from "@/components/icons";
import { MapPinIcon            } from "@/components/icons";
import { Maximize2Icon         } from "@/components/icons";
import { MenuIcon              } from "@/components/icons";
import { MessageCircleIcon     } from "@/components/icons";
import { MessageSquareIcon     } from "@/components/icons";
import { MessageSquareMoreIcon } from "@/components/icons";
import { MoonIcon              } from "@/components/icons";
import { PauseIcon             } from "@/components/icons";
import { PlayIcon              } from "@/components/icons";
import { PlusIcon              } from "@/components/icons";
import { RedoIcon              } from "@/components/icons";
import { RefreshCCWIcon        } from "@/components/icons";
import { RefreshCWIcon         } from "@/components/icons";
import { RotateCCWIcon         } from "@/components/icons";
import { SearchIcon            } from "@/components/icons";
import { SendIcon              } from "@/components/icons";
import { ShieldCheckIcon       } from "@/components/icons";
import { SmartphoneNfcIcon     } from "@/components/icons";
import { SparklesIcon          } from "@/components/icons";
import { SquarePenIcon         } from "@/components/icons";
import { SquareStackIcon       } from "@/components/icons";
import { SunIcon               } from "@/components/icons";
import { SwitchCameraIcon      } from "@/components/icons";
import { TerminalIcon          } from "@/components/icons";
import { UndoIcon              } from "@/components/icons";
import { UploadIcon            } from "@/components/icons";
import { UpvoteIcon            } from "@/components/icons";
import { UserCheckIcon         } from "@/components/icons";
import { UserIcon              } from "@/components/icons";
import { UsersIcon             } from "@/components/icons";
import { UsersRoundIcon        } from "@/components/icons";
import { XIcon                 } from "@/components/icons";
import { ZapIcon               } from "@/components/icons";

export const Activity         = withParentHover(ActivityIcon);
export const ArrowDown        = withParentHover(ArrowDownIcon);
export const ArrowLeft        = withParentHover(ArrowLeftIcon);
export const ArrowRight       = withParentHover(ArrowRightIcon);
export const ArrowUp          = withParentHover(ArrowUpIcon);
export const BadgeAlert       = withParentHover(BadgeAlertIcon);
export const Ban              = withParentHover(BanIcon);
export const Bell             = withParentHover(BellIcon);
export const BellRing         = withParentHover(BellElectricIcon);
export const Bold             = withParentHover(BoldIcon);
export const Bookmark         = withParentHover(BookmarkIcon);
export const BookmarkFilled   = withParentHover(BookmarkCheckIcon);
export const BookmarkPlus     = withParentHover(BookmarkPlusIcon);
export const BriefcaseBusiness = withParentHover(BriefcaseBusinessIcon);
export const CalendarDays     = withParentHover(CalendarDaysIcon);
export const Check            = withParentHover(CheckIcon);
export const CheckCheck       = withParentHover(CheckCheckIcon);
export const CheckCircle      = withParentHover(CircleCheckIcon);
export const CheckCircle2     = withParentHover(CircleCheckIcon);
export const CircleHelp       = withParentHover(CircleHelpIcon);
export const Contrast         = withParentHover(ContrastIcon);
export const Crown            = withParentHover(CrownIcon);
export const Mailbox          = withParentHover(MailboxIcon);
export const ChevronDown      = withParentHover(ChevronDownIcon);
export const ChevronLeft      = withParentHover(ChevronLeftIcon);
export const ChevronRight     = withParentHover(ChevronRightIcon);
export const ChevronUp        = withParentHover(ChevronUpIcon);
export const Checks           = withParentHover(CheckCheckIcon);
export const CircleAlert      = withParentHover(BadgeAlertIcon);
export const Clock            = withParentHover(ClockIcon);
export const Copy             = withParentHover(CopyIcon);
export const Download         = withParentHover(DownloadIcon);
export const Edit3            = withParentHover(SquarePenIcon);
export const Eye              = withParentHover(EyeIcon);
export const EyeOff           = withParentHover(EyeOffIcon);
export const FileText         = withParentHover(FileTextIcon);
export const Fire             = withParentHover(FlameIcon);
export const Flame            = withParentHover(FlameIcon);
export const Flag             = withParentHover(BookmarkPlusIcon);
export const GraduationCap    = withParentHover(GraduationCapIcon);
export const History          = withParentHover(HistoryIcon);
export const IdCard           = withParentHover(IdCardIcon);
export const Home             = withParentHover(HomeIcon);
export const Images           = withParentHover(GalleryThumbnailsIcon);
export const Italic           = withParentHover(ItalicIcon);
export const LayoutDashboard  = withParentHover(LayoutPanelTopIcon);
export const Link             = withParentHover(LinkIcon);
export const Loader2          = withParentHover(LoaderCircleIcon);
export const Lock             = withParentHover(LockIcon);
export const Login            = withParentHover(LogInIcon);
export const Logout           = withParentHover(LogoutIcon);
export const MapPin           = withParentHover(MapPinIcon);
export const Maximize2        = withParentHover(Maximize2Icon);
export const Menu             = withParentHover(MenuIcon);
export const MessageCircle    = withParentHover(MessageCircleIcon);
export const MessageSquare    = withParentHover(MessageSquareIcon);
export const MessageSquareReply = withParentHover(MessageSquareMoreIcon);
export const Moon             = withParentHover(MoonIcon);
export const MoreHorizontal   = withParentHover(GripHorizontalIcon);
export const MoreVertical     = withParentHover(GripVerticalIcon);
export const Pause            = withParentHover(PauseIcon);
export const PencilLine       = withParentHover(FilePenLineIcon);
export const Play             = withParentHover(PlayIcon);
export const Plus             = withParentHover(PlusIcon);
export const Redo             = withParentHover(RedoIcon);
export const RefreshCcw       = withParentHover(RefreshCCWIcon);
export const RefreshCw        = withParentHover(RefreshCWIcon);
export const RotateCcw        = withParentHover(RotateCCWIcon);
export const Search           = withParentHover(SearchIcon);
export const Send             = withParentHover(SendIcon);
export const ShieldCheck      = withParentHover(ShieldCheckIcon);
export const Smartphone       = withParentHover(SmartphoneNfcIcon);
export const Sparkles         = withParentHover(SparklesIcon);
export const Star             = withParentHover(SparklesIcon);
export const Sun              = withParentHover(SunIcon);
export const SwitchCamera     = withParentHover(SwitchCameraIcon);
export const Terminal         = withParentHover(TerminalIcon);
export const ThumbsDown       = withParentHover(DownvoteIcon);
export const ThumbsUp         = withParentHover(UpvoteIcon);
export const Trash            = withParentHover(DeleteIcon);
export const Trash2           = withParentHover(DeleteIcon);
export const Trophy           = withParentHover(ZapIcon);
export const Undo             = withParentHover(UndoIcon);
export const Unlock           = withParentHover(LockOpenIcon);
export const Upload           = withParentHover(UploadIcon);
export const UserCheck        = withParentHover(UserCheckIcon);
export const UserRound        = withParentHover(UserIcon);
export const Users            = withParentHover(UsersIcon);
export const UsersRound       = withParentHover(UsersRoundIcon);
export const WarningCircle    = withParentHover(BadgeAlertIcon);
export const X                = withParentHover(XIcon);
export const XCircle          = withParentHover(BanIcon);
export const Zap              = withParentHover(ZapIcon);

// ─── Phosphor fallbacks (no pqoqubbw equivalent) ─────────────────────────────
// These icons have no animated pqoqubbw counterpart; they remain static Phosphor glyphs.
export {
	BellSlash         as BellOff,
	BracketsCurly     as Braces,
	Camera,
	CaretDown         as ChevronDownSm,
	CaretLeft         as ChevronLeftSm,
	CaretRight        as ChevronRightSm,
	CaretUp           as ChevronUpSm,
	Code,
	Database,
	EnvelopeOpen,
	ListBullets,
	ListChecks,
	ListNumbers       as ListOrdered,
	Minus,
	Palette,
	Pencil,
	Question,
	Quotes,
	Table,
	TextHTwo          as Heading2,
	TextStrikethrough as Strikethrough,
	TextT             as Type,
	Tray              as Inbox,
	UserMinus         as UserX,
	Warning,
} from "@phosphor-icons/react";

// Icon aliases for components still using Phosphor-style names
export {
	ArrowBendUpRight  as Forward,
	ArrowSquareOut    as ExternalLink,
	CodeBlock         as ToolbarCodeBlock,
	DeviceMobile,
	Envelope          as Mail,
	Image,
	Image             as ImageIcon,
	SealCheck         as BadgeCheck,
	ShareNetwork      as Share2,
	ShieldWarning     as ShieldAlert,
	TextB             as ToolbarBold,
	TextHTwo          as ToolbarHeading,
	TextItalic        as ToolbarItalic,
	TextStrikethrough as ToolbarStrikethrough,
	Table             as ToolbarTable,
	ListBullets       as ToolbarList,
	ListNumbers       as ToolbarListOrdered,
	Quotes            as ToolbarQuote,
} from "@phosphor-icons/react";

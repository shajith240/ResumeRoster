// Phosphor Icons — single icon family replacing Solar Duotone + Lucide React
// @phosphor-icons/react · MIT · 1,500+ icons · 6 weights (regular is default)
"use client";

import { Bookmark as PhosphorBookmark } from "@phosphor-icons/react";
import type { Icon, IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";

export type LucideIcon = ComponentType<IconProps>;
export type SolarIconComponent = ComponentType<IconProps>;
export type SolarIconProps = IconProps;

// ─── Filled-weight wrappers (for icons that need weight="fill" by default) ───
export function BookmarkFilled(props: Omit<IconProps, "weight">) {
	return <PhosphorBookmark {...props} weight="fill" />;
}

// ─── Direct re-exports (same name in Phosphor) ──────────────────────────────
export {
	Bell,
	Bookmark,
	Camera,
	Check,
	CheckCircle,
	Checks,
	Clock,
	Code,
	Database,
	DotsThree,
	DotsThreeVertical,
	Eye,
	FileText,
	Fire,
	Flag,
	Image,
	Images,
	Link,
	List,
	ListBullets,
	ListChecks,
	ListNumbers,
	Lock,
	MapPin,
	Minus,
	Pause,
	Pencil,
	Play,
	Plus,
	Quotes,
	Star,
	Table,
	ThumbsDown,
	ThumbsUp,
	Trash,
	Trophy,
	Upload,
	UploadSimple,
	UserCheck,
	Warning,
	WarningCircle,
	X,
	XCircle,
} from "@phosphor-icons/react";

// ─── Re-exports under legacy / app-canonical names ───────────────────────────
export { ArrowBendUpRight      as Forward            } from "@phosphor-icons/react";
export { ArrowClockwise        as RefreshCw          } from "@phosphor-icons/react";
export { ArrowCounterClockwise as RefreshCcw         } from "@phosphor-icons/react";
export { ArrowCounterClockwise as RotateCcw          } from "@phosphor-icons/react";
export { ArrowDown             as ChevronDown        } from "@phosphor-icons/react";
export { ArrowLeft             as ChevronLeft        } from "@phosphor-icons/react";
export { ArrowRight            as ChevronRight       } from "@phosphor-icons/react";
export { ArrowRight                                  } from "@phosphor-icons/react";
export { ArrowSquareOut        as ExternalLink       } from "@phosphor-icons/react";
export { ArrowUp               as ChevronUp          } from "@phosphor-icons/react";
export { BellRinging           as BellRing           } from "@phosphor-icons/react";
export { BellSlash             as BellOff            } from "@phosphor-icons/react";
export { BracketsCurly         as Braces             } from "@phosphor-icons/react";
export { Briefcase             as BriefcaseBusiness  } from "@phosphor-icons/react";
export { CalendarDots          as CalendarDays       } from "@phosphor-icons/react";
export { CaretDown             as ChevronDownSm      } from "@phosphor-icons/react";
export { CaretLeft             as ChevronLeftSm      } from "@phosphor-icons/react";
export { CaretRight            as ChevronRightSm     } from "@phosphor-icons/react";
export { CaretUp               as ChevronUpSm        } from "@phosphor-icons/react";
export { Certificate           as GraduationCap      } from "@phosphor-icons/react";
export { Chat                  as MessageCircle      } from "@phosphor-icons/react";
export { CheckCircle           as CheckCircle2       } from "@phosphor-icons/react";
export { ChatCenteredText      as MessageSquare      } from "@phosphor-icons/react";
export { ChatText              as MessageSquareReply } from "@phosphor-icons/react";
export { Checks                as CheckCheck         } from "@phosphor-icons/react";
export { CircleNotch           as Loader2            } from "@phosphor-icons/react";
export { ClockCounterClockwise as History            } from "@phosphor-icons/react";
export { CornersOut            as Maximize2          } from "@phosphor-icons/react";
export { DeviceMobile          as Smartphone         } from "@phosphor-icons/react";
export { DownloadSimple        as Download           } from "@phosphor-icons/react";
export { Envelope              as Mail               } from "@phosphor-icons/react";
export { House                 as Home               } from "@phosphor-icons/react";
export { Image                 as ImageIcon          } from "@phosphor-icons/react";
export { List                  as Menu               } from "@phosphor-icons/react";
export { ListNumbers           as ListOrdered        } from "@phosphor-icons/react";
export { LockKeyOpen           as Unlock             } from "@phosphor-icons/react";
export { MagnifyingGlass       as Search             } from "@phosphor-icons/react";
export { NotePencil            as Edit3              } from "@phosphor-icons/react";
export { NotePencil            as PencilLine         } from "@phosphor-icons/react";
export { PaperPlaneTilt        as Send               } from "@phosphor-icons/react";
export { Pulse                 as Activity           } from "@phosphor-icons/react";
export { SealCheck             as BadgeCheck         } from "@phosphor-icons/react";
export { ShareNetwork          as Share2             } from "@phosphor-icons/react";
export { ShieldCheck                                 } from "@phosphor-icons/react";
export { ShieldWarning         as ShieldAlert        } from "@phosphor-icons/react";
export { Sparkle               as Sparkles           } from "@phosphor-icons/react";
export { SquaresFour           as LayoutDashboard    } from "@phosphor-icons/react";
export { TextB                 as Bold               } from "@phosphor-icons/react";
export { TextHTwo              as Heading2           } from "@phosphor-icons/react";
export { TextItalic            as Italic             } from "@phosphor-icons/react";
export { TextStrikethrough     as Strikethrough      } from "@phosphor-icons/react";
export { TextT                 as Type               } from "@phosphor-icons/react";
export { Trash                 as Trash2             } from "@phosphor-icons/react";
export { Tray                  as Inbox              } from "@phosphor-icons/react";
export { UserCircle            as UserRound          } from "@phosphor-icons/react";
export { UserMinus             as UserX              } from "@phosphor-icons/react";
export { UsersThree            as UsersRound         } from "@phosphor-icons/react";
export { WarningCircle         as CircleAlert        } from "@phosphor-icons/react";

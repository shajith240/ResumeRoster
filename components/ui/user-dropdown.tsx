"use client";

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
import { Icon } from "@iconify/react";

type MenuAction =
  | "profile"
  | "submit"
  | "leaderboard"
  | "notifications"
  | "saved"
  | "help"
  | "feedback"
  | "logout";

type MenuItem = {
  icon: string;
  label: string;
  action: MenuAction;
  iconClass?: string;
  badge?: {
    text: string;
    className: string;
  };
  rightIcon?: string;
};

type StatusItem = {
  value: string;
  icon: string;
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
  selectedStatus?: string;
  promoDiscount?: string;
};

const MENU_ITEMS: {
  status: StatusItem[];
  profile: MenuItem[];
  activity: MenuItem[];
  account: MenuItem[];
} = {
  status: [
    { value: "online", icon: "solar:fire-line-duotone", label: "Roasting" },
    { value: "focus", icon: "solar:emoji-funny-circle-line-duotone", label: "Focus" },
    { value: "offline", icon: "solar:moon-sleep-line-duotone", label: "Appear offline" },
  ],
  profile: [
    { icon: "solar:user-circle-line-duotone", label: "Your profile", action: "profile" },
    { icon: "solar:document-add-line-duotone", label: "Post resume", action: "submit" },
    { icon: "solar:cup-star-line-duotone", label: "Leaderboard", action: "leaderboard" },
    { icon: "solar:bell-line-duotone", label: "Notifications", action: "notifications" },
  ],
  activity: [
    {
      icon: "solar:bookmark-line-duotone",
      label: "Saved roasts",
      action: "saved",
      badge: { text: "Soon", className: "bg-[var(--brand-muted)] text-[var(--brand)] text-[11px]" },
    },
    { icon: "solar:question-circle-line-duotone", label: "Get help", action: "help" },
    {
      icon: "solar:letter-unread-line-duotone",
      label: "Send feedback",
      action: "feedback",
      rightIcon: "solar:square-top-down-line-duotone",
    },
  ],
  account: [
    { icon: "solar:logout-2-bold-duotone", label: "Log out", action: "logout" },
  ],
};

export function UserDropdown({
  user = {
    name: "Resume roaster",
    username: "@resumeroster",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces",
    initials: "RR",
    status: "online",
  },
  onAction = () => undefined,
  onStatusChange = () => undefined,
  selectedStatus = "online",
  promoDiscount,
}: UserDropdownProps) {
  const renderMenuItem = (item: MenuItem, index: number) => (
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
          icon={item.icon}
          className={`size-5 ${item.iconClass || "text-gray-500 dark:text-gray-400"}`}
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
          icon={item.rightIcon}
          className="size-4 text-gray-500 dark:text-gray-400"
        />
      ) : null}
    </DropdownMenuItem>
  );

  const getStatusColor = (status: string) => {
    const colors = {
      online:
        "border-green-300 bg-green-100 text-green-700 dark:border-green-500/50 dark:bg-green-900/30 dark:text-green-400",
      focus:
        "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-500/50 dark:bg-orange-900/30 dark:text-orange-400",
      offline:
        "border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400",
      busy:
        "border-red-300 bg-red-100 text-red-600 dark:border-red-500/50 dark:bg-red-900/30 dark:text-red-400",
    };

    return colors[status.toLowerCase() as keyof typeof colors] || colors.online;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-10 cursor-pointer border border-white/20 shadow-sm">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback className="bg-[var(--brand)] text-white">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="no-scrollbar z-[1000] w-[310px] rounded-2xl border-0 bg-gray-50 p-0 shadow-2xl shadow-black/20"
        align="end"
        sideOffset={12}
      >
        <section className="rounded-2xl border border-gray-200 bg-white p-1 shadow backdrop-blur-lg">
          <div className="flex items-center p-2">
            <div className="flex flex-1 items-center gap-2">
              <Avatar className="size-10 cursor-pointer border border-white shadow">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-[var(--brand)] text-white">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-900">{user.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{user.username}</p>
              </div>
            </div>
            <Badge className={`${getStatusColor(user.status)} rounded-sm border-[0.5px] text-[11px] capitalize`}>
              {user.status === "online" ? "roasting" : user.status}
            </Badge>
          </div>

          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer rounded-lg p-2">
                <span className="flex items-center gap-1.5 font-medium text-gray-500">
                  <Icon icon="solar:smile-circle-line-duotone" className="size-5 text-gray-500" />
                  Update status
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="z-[1001] bg-white/95 backdrop-blur-lg">
                  <DropdownMenuRadioGroup value={selectedStatus} onValueChange={onStatusChange}>
                    {MENU_ITEMS.status.map((status, index) => (
                      <DropdownMenuRadioItem className="gap-2" key={index} value={status.value}>
                        <Icon icon={status.icon} className="size-5 text-gray-500" />
                        {status.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {MENU_ITEMS.profile.map(renderMenuItem)}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserDropdown;

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronsUpDown,
  Flame,
  Home,
  ListFilter,
  Plus,
  Trophy,
  Upload,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const sidebarVariants = {
  open: { width: "15rem" },
  closed: { width: "3.05rem" },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const labelVariants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -14,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
};

const transitionProps = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
  staggerChildren: 0.1,
} as const;

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  tone?: "primary";
  badge?: string;
};

export function SessionNavBar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();

  const items = useMemo<NavItem[]>(
    () => [
      {
        href: "/feed",
        label: "Home",
        icon: Home,
        active: pathname === "/feed",
      },
      {
        href: "/feed?sort=new",
        label: "New",
        icon: ListFilter,
        active: false,
      },
      {
        href: "/feed?sort=top",
        label: "Top Roasted",
        icon: Flame,
        active: false,
        badge: "Hot",
      },
      {
        href: "/submit",
        label: "Post Resume",
        icon: Plus,
        active: pathname === "/submit",
        tone: "primary",
      },
      {
        href: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        active: pathname === "/leaderboard",
      },
    ],
    [pathname],
  );

  return (
    <motion.aside
      aria-label="Primary navigation"
      className="session-sidebar fixed left-0 top-[52px] z-40 h-[calc(100vh-52px)] shrink-0 border-r border-border bg-background text-muted-foreground shadow-[8px_0_26px_rgba(23,20,15,0.04)]"
      initial={isCollapsed ? "closed" : "open"}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className="relative z-40 flex h-full shrink-0 flex-col bg-background transition-all"
        variants={contentVariants}
      >
        <motion.div variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex h-[54px] w-full shrink-0 border-b p-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="w-full" asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex w-full items-center justify-start gap-2 px-2"
                  aria-label="Open ResumeRoster shortcuts"
                >
                  <Avatar className="size-5 rounded-md">
                    <AvatarFallback className="bg-orange-100 text-[11px] font-bold text-orange-700">
                      R
                    </AvatarFallback>
                  </Avatar>
                  <motion.span
                    variants={labelVariants}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    {!isCollapsed && (
                      <>
                        <span className="truncate text-sm font-medium text-foreground">
                          ResumeRoster
                        </span>
                        <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50" />
                      </>
                    )}
                  </motion.span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[1001]">
                <DropdownMenuItem asChild>
                  <Link className="flex items-center gap-2" href="/submit">
                    <Upload className="h-4 w-4" /> Submit resume
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link className="flex items-center gap-2" href="/leaderboard">
                    <BarChart3 className="h-4 w-4" /> Leaderboard
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="min-h-0 flex-1 p-2">
            <nav className="flex w-full flex-col gap-1">
              {items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    href={item.href}
                    key={item.label}
                    className={cn(
                      "flex h-9 w-full flex-row items-center rounded-md px-2 py-1.5 text-sm transition hover:bg-muted hover:text-primary",
                      item.active && "bg-muted text-primary",
                      item.tone === "primary" &&
                        "bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <motion.span
                      variants={labelVariants}
                      className="ml-2 flex min-w-0 flex-1 items-center gap-2"
                    >
                      {!isCollapsed && (
                        <>
                          <span className="truncate font-medium">{item.label}</span>
                          {item.badge ? (
                            <Badge
                              variant="outline"
                              className="ml-auto border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] text-orange-700"
                            >
                              {item.badge}
                            </Badge>
                          ) : null}
                        </>
                      )}
                    </motion.span>
                  </Link>
                );
              })}

              <Separator className="my-2" />

              <div className="px-2 py-1.5">
                {!isCollapsed ? (
                  <motion.div
                    variants={labelVariants}
                    className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-left"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      Resumes roasted this week
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-orange-700">
                      42
                    </p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      Active roasters
                    </p>
                    <p className="mt-1 text-xl font-semibold text-orange-700">
                      18
                    </p>
                  </motion.div>
                ) : (
                  <div className="mx-auto h-2 w-2 rounded-full bg-emerald-600" />
                )}
              </div>
            </nav>
          </ScrollArea>
        </motion.div>
      </motion.div>
    </motion.aside>
  );
}

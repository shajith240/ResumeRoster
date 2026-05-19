"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Briefcase01Icon,
  Cancel01Icon,
  File01Icon,
  FireIcon,
  GraduationCap,
  ProfileIcon,
  Search01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResumeSummary, RoasterLeaderboardEntry } from "@/lib/supabase/types";

type RoleType = "role" | "college" | "votes" | "resume";

type StackedListProps = {
  roasters: RoasterLeaderboardEntry[];
  resumes: ResumeSummary[];
  message?: string;
};

const sweepSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.5,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function roasterName(roaster: RoasterLeaderboardEntry) {
  return roaster.username || "Anonymous roaster";
}

function RoleBadge({ type, label }: { type: RoleType; label: string }) {
  const styles = {
    role: {
      bg: "bg-[#FFF7ED]",
      text: "text-[#9A3412]",
      border: "border-[#FED7AA]",
      icon: Briefcase01Icon,
    },
    college: {
      bg: "bg-[#F0F7FF]",
      text: "text-[#1D4ED8]",
      border: "border-[#BFDBFE]",
      icon: GraduationCap,
    },
    votes: {
      bg: "bg-[#F3FAF4]",
      text: "text-[#166534]",
      border: "border-[#BBF7D0]",
      icon: StarIcon,
    },
    resume: {
      bg: "bg-[#FCF5FF]",
      text: "text-[#6B21A8]",
      border: "border-[#E9D5FF]",
      icon: File01Icon,
    },
  };

  const style = styles[type];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
        style.bg,
        style.text,
        style.border,
      )}
    >
      <HugeiconsIcon icon={style.icon} size={12} strokeWidth={1.8} />
      <span className="max-w-[82px] truncate text-xs font-medium uppercase tracking-normal sm:max-w-none">
        {label}
      </span>
    </div>
  );
}

function LeaderboardAvatar({ name, rank }: { name: string; rank: number }) {
  return (
    <div className="relative mr-4 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ff7a18,#f43f5e)] text-sm font-semibold text-white shadow-sm ring-2 ring-background">
      {initials(name)}
      <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border border-background bg-foreground px-1 text-[10px] font-semibold text-background">
        {rank}
      </span>
    </div>
  );
}

function RoasterItem({ roaster, rank }: { roaster: RoasterLeaderboardEntry; rank: number }) {
  const name = roasterName(roaster);
  const meta = [roaster.target_role, roaster.college].filter(Boolean).join(" · ") || "Community reviewer";
  const badgeType: RoleType = roaster.target_role ? "role" : roaster.college ? "college" : "votes";
  const badgeLabel = roaster.target_role || roaster.college || `${roaster.helpful_votes} votes`;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: 10, y: 15, rotate: 1 },
        visible: { opacity: 1, x: 0, y: 0, rotate: 0 },
      }}
      transition={sweepSpring}
      style={{ originX: 1, originY: 1 }}
    >
      <Link
        className="group flex items-center border-b border-border/40 py-4 first:pt-0 last:border-0"
        href={`/profile/${roaster.id}`}
      >
        <LeaderboardAvatar name={name} rank={rank} />
        <div className="min-w-0 flex-1">
          <h3 className="mb-1.5 truncate text-base font-semibold leading-none tracking-tight text-foreground">
            {name}
          </h3>
          <div className="flex items-center gap-1.5 opacity-80">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <p className="truncate text-sm font-medium leading-none text-muted-foreground">
              {roaster.helpful_votes} helpful votes · {roaster.roast_count} roasts
            </p>
          </div>
          <p className="mt-1.5 truncate text-xs font-medium leading-none text-muted-foreground/70">
            {meta}
          </p>
        </div>
        <div className="shrink-0">
          <RoleBadge type={badgeType} label={badgeLabel} />
        </div>
      </Link>
    </motion.div>
  );
}

function ResumeItem({ resume, rank }: { resume: ResumeSummary; rank: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: 10, y: 15, rotate: 1 },
        visible: { opacity: 1, x: 0, y: 0, rotate: 0 },
      }}
      transition={sweepSpring}
      style={{ originX: 1, originY: 1 }}
    >
      <Link
        className="group flex items-center border-b border-border/40 py-4 first:pt-0 last:border-0"
        href={`/resume/${resume.id}`}
      >
        <div className="relative mr-4 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border bg-muted/40 text-muted-foreground">
          <HugeiconsIcon icon={resume.roast_count > 5 ? FireIcon : File01Icon} size={20} strokeWidth={2} />
          <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border border-background bg-foreground px-1 text-[10px] font-semibold text-background">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1.5 truncate text-base font-semibold leading-none tracking-tight text-foreground">
            {resume.title}
          </h3>
          <p className="truncate text-sm font-medium leading-none text-muted-foreground">
            {resume.status === "closed" ? "Closed" : "Open"} · {formatDate(resume.created_at)}
          </p>
        </div>
        <div className="shrink-0">
          <RoleBadge type="resume" label={`${resume.roast_count} roasts`} />
        </div>
      </Link>
    </motion.div>
  );
}

export function StackedList({ roasters, resumes, message = "" }: StackedListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRoasters = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return roasters;
    return roasters.filter((roaster) =>
      [roasterName(roaster), roaster.target_role, roaster.college]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [roasters, searchQuery]);

  const visibleRoasters = useMemo(() => filteredRoasters.slice(0, 5), [filteredRoasters]);

  const filteredResumes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return resumes;
    return resumes.filter((resume) => resume.title.toLowerCase().includes(query));
  }, [resumes, searchQuery]);

  return (
    <div className="leaderboard-stack-shell">
      <div className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[40px] border border-border bg-background pb-6 shadow-sm">
        <div className="flex flex-col bg-background">
          <div className="p-8 pb-3">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                Top roasters
                <span className="mt-0.5 rounded-full bg-muted px-2 py-1 text-xs font-normal leading-none text-muted-foreground">
                  {roasters.length}
                </span>
              </h2>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50"
              >
                <Link href="/feed" aria-label="Find resumes to roast">
                  <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2.5} />
                </Link>
              </Button>
            </div>

            <div className="relative mb-4">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/60"
                size={16}
              />
              <Input
                placeholder="Search roasters..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 rounded-2xl border-none bg-muted/40 pl-11 pr-4 text-base shadow-none transition-all focus-visible:ring-1 focus-visible:ring-border"
              />
            </div>
          </div>

          <div className="min-h-[355px] px-8 pb-24">
            {message ? <p className="form-message">{message}</p> : null}
            <motion.div
              initial={false}
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-0.5"
            >
              {visibleRoasters.map((roaster, index) => (
                <RoasterItem key={`active-${roaster.id}`} roaster={roaster} rank={index + 1} />
              ))}
            </motion.div>
            {!visibleRoasters.length && !message ? (
              <div className="leaderboard-empty">
                <span className="empty-icon">#</span>
                <strong>No roasters yet</strong>
                <p>First useful roast gets the board moving.</p>
                <Link href="/feed">Be the first roaster -&gt;</Link>
              </div>
            ) : null}
          </div>
        </div>

        <motion.div
          layout
          initial={false}
          animate={{
            height: isExpanded ? "calc(100% - 20px)" : "76px",
            width: isExpanded ? "calc(100% - 20px)" : "calc(100% - 40px)",
            bottom: isExpanded ? "10px" : "20px",
            left: isExpanded ? "10px" : "20px",
            borderRadius: isExpanded ? "32px" : "24px",
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 30,
            mass: 0.8,
            ease: "easeInOut",
          }}
          className="absolute z-50 flex flex-col overflow-hidden border border-border bg-card shadow-sm"
          style={{ cursor: isExpanded ? "default" : "pointer" }}
          onClick={() => !isExpanded && setIsExpanded(true)}
        >
          <div
            className={cn(
              "flex h-[76px] shrink-0 items-center justify-between px-3 transition-colors",
              isExpanded ? "border-b border-border/40" : "hover:bg-muted/20",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground/80 shadow-sm">
                <HugeiconsIcon icon={ProfileIcon} size={20} strokeWidth={2} />
              </div>
              <motion.div layout="position" className="min-w-0">
                <h4 className="truncate text-base font-medium leading-none tracking-tight text-foreground">
                  Resume threads
                </h4>
                <p className="mt-1 text-xs font-normal leading-none text-muted-foreground">
                  {resumes.length} ranked by roast activity
                </p>
              </motion.div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {!isExpanded ? (
                <div className="flex -space-x-3">
                  {resumes.slice(0, 3).map((resume) => (
                    <div
                      key={`sum-${resume.id}`}
                      className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-background"
                    >
                      {initials(resume.title)}
                    </div>
                  ))}
                  {resumes.length > 3 ? (
                    <div className="relative z-0 grid h-10 w-10 place-items-center rounded-full bg-muted text-sm font-normal leading-none text-muted-foreground ring-1 ring-background">
                      +{resumes.length - 3}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-all hover:text-foreground active:scale-90"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsExpanded(false);
                  }}
                  type="button"
                  aria-label="Close resume thread list"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <AnimatePresence>
              {isExpanded ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="px-6 py-4"
                >
                  <div className="relative">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/50"
                      size={15}
                    />
                    <Input
                      placeholder="Search leaderboard..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-10 rounded-xl border-none bg-muted/30 pl-10 text-sm shadow-none transition-all focus-visible:ring-1 focus-visible:ring-border"
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto px-6 py-2">
              <motion.div
                initial="hidden"
                animate={isExpanded ? "visible" : "hidden"}
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.03, delayChildren: 0.1 },
                  },
                  hidden: {
                    transition: { staggerChildren: 0.02, staggerDirection: -1 },
                  },
                }}
                className="space-y-0.5"
              >
                {filteredResumes.map((resume, index) => (
                  <ResumeItem key={`list-${resume.id}`} resume={resume} rank={index + 1} />
                ))}
              </motion.div>
              {isExpanded && !filteredResumes.length ? (
                <div className="leaderboard-empty">
                  <span className="empty-icon">R</span>
                  <strong>No matching resume threads</strong>
                  <p>Try a different search or submit a resume.</p>
                </div>
              ) : null}
              {isExpanded && filteredRoasters.length > visibleRoasters.length ? (
                <div className="mt-5 border-t border-border/40 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    More roasters
                  </p>
                  {filteredRoasters.slice(5).map((roaster, index) => (
                    <RoasterItem
                      key={`more-${roaster.id}`}
                      roaster={roaster}
                      rank={index + 6}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default StackedList;

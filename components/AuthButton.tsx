"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Bell,
  FileText,
  LogOut,
  Trophy,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signInWithGoogle, signOut, supabase } from "@/lib/supabase/client";

export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="avatar-skeleton" aria-label="Checking session" />;
  }

  if (!user) {
    return (
      <div className="auth-actions">
        <button className="btn-primary btn-ghost nav-login" onClick={() => void signInWithGoogle()}>
          Log in
        </button>
        <Link className="btn-primary btn-brand" href="/submit">
          Post resume
        </Link>
      </div>
    );
  }

  const displayName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "Resume roaster";
  const email = user.email || "Signed in";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initial = displayName.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="profile-menu">
      <button className="notification-button" type="button" aria-label="Notifications">
        <Bell size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="avatar-button" type="button" aria-label="Open account menu">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="z-[1000] w-72">
          <DropdownMenuLabel className="flex items-start gap-3">
            <span className="mini-avatar h-9 w-9 shrink-0">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : initial}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/profile/me">
                <UserRound size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/submit">
                <FileText size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                <span>My resumes</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/leaderboard">
                <Trophy size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                <span>Leaderboard</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleSignOut()}>
            <LogOut size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { signInWithGoogle, signOut, supabase } from "@/lib/supabase/client";

export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("online");
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

  const displayName = String(
    user.user_metadata?.full_name || user.email?.split("@")[0] || "Resume roaster",
  );
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(/\s+/)
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleAction(action: string) {
    if (action === "logout") {
      await signOut();
      router.replace("/");
      return;
    }

    const routes: Record<string, string> = {
      profile: "/profile/me",
      submit: "/submit",
      leaderboard: "/leaderboard",
      saved: "/feed",
      help: "/feed",
      feedback: "/feed",
    };

    router.push(routes[action] || "/feed");
  }

  return (
    <div className="profile-menu">
      <UserDropdown
        selectedStatus={status}
        user={{
          name: displayName,
          username: user.email ? `@${user.email.split("@")[0]}` : "@resumeroster",
          avatar: avatarUrl,
          initials: initials || "RR",
          status: status as "online" | "focus" | "offline" | "busy",
        }}
        onAction={(action) => void handleAction(action)}
        onStatusChange={setStatus}
      />
    </div>
  );
}

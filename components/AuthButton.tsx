"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { signInWithGoogle, signOut, supabase } from "@/lib/supabase/client";

export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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
      <button className="app-button" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </button>
    );
  }

  const displayName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "Resume roaster";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.replace("/");
  }

  return (
    <div className="profile-menu">
      <button
        className="avatar-button"
        type="button"
        aria-expanded={open}
        aria-label="Open profile menu"
        onClick={() => setOpen((current) => !current)}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
        )}
      </button>

      {open ? (
        <div className="profile-dropdown">
          <Link className="profile-menu-item profile-menu-user" href="/profile/me" onClick={() => setOpen(false)}>
            <span className="mini-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>View Profile</strong>
              <small>{displayName}</small>
            </span>
          </Link>

          <Link className="profile-menu-item" href="/submit" onClick={() => setOpen(false)}>
            <span>+</span>
            Post resume
          </Link>
          <Link className="profile-menu-item" href="/leaderboard" onClick={() => setOpen(false)}>
            <span>↟</span>
            Leaderboard
          </Link>
          <Link className="profile-menu-item" href="/profile/me" onClick={() => setOpen(false)}>
            <span>⚙</span>
            Edit profile
          </Link>

          <button className="profile-menu-item" type="button" onClick={() => void handleSignOut()}>
            <span>↩</span>
            Log Out
          </button>
        </div>
      ) : null}
    </div>
  );
}

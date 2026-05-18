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
    return <button className="app-button ghost">Checking session</button>;
  }

  if (!user) {
    return (
      <button className="app-button" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </button>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="auth-actions">
      <Link className="app-button ghost" href="/profile/me">
        My profile
      </Link>
      <button className="app-button ghost" onClick={() => void handleSignOut()}>
        Sign out
      </button>
    </div>
  );
}

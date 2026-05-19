"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { SessionNavBar } from "@/components/ui/sidebar";

type AuthGateProps = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (!data.session?.user) {
        router.replace("/");
        return;
      }

      setUser(data.session.user);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/");
        return;
      }

      setUser(session.user);
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (checking || !user) {
    return (
      <main className="route-shell compact-route">
        <p className="muted-text">Opening your workspace...</p>
      </main>
    );
  }

  return (
    <>
      <SessionNavBar />
      <div className="app-with-sidebar">{children}</div>
    </>
  );
}

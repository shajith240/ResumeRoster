"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouteHeader from "@/components/RouteHeader";
import { supabase } from "@/lib/supabase/client";

export default function MyProfilePage() {
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        router.replace(`/profile/${data.session.user.id}`);
        return;
      }

      router.replace("/");
    }

    void loadProfile();
  }, [router]);

  return (
    <>
      <RouteHeader />
      <main className="route-shell compact-route">
        <div className="empty-state">
          <h1>Opening your profile</h1>
          <p>Checking your session and sending you to your public roaster profile.</p>
          <Link href="/leaderboard">View public leaderboard</Link>
        </div>
      </main>
    </>
  );
}

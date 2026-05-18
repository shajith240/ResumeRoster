"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouteHeader from "@/components/RouteHeader";
import { signInWithGoogle, supabase } from "@/lib/supabase/client";

export default function MyProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        router.replace(`/profile/${data.user.id}`);
        return;
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  return (
    <>
      <RouteHeader />
      <main className="route-shell compact-route">
        <div className="empty-state">
          <h1>{loading ? "Opening your profile" : "Create your profile"}</h1>
          <p>
            {loading
              ? "Checking your session and sending you to your public roaster profile."
              : "Sign in with Google first, then you can set your username, college, and target role."}
          </p>
          {loading ? null : (
            <button className="app-button" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </button>
          )}
          <Link href="/leaderboard">View public leaderboard</Link>
        </div>
      </main>
    </>
  );
}

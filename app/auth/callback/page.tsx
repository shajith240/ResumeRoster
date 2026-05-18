"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().finally(() => {
      router.replace("/feed");
    });
  }, [router]);

  return (
    <main className="route-shell compact-route">
      <h1>Signing you in</h1>
      <p>Redirecting you back to the community feed.</p>
    </main>
  );
}

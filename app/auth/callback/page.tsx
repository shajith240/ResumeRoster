"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const nextPath = searchParams.get("next") || "/feed";
    const safeNextPath =
      nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/feed";

    supabase.auth.getSession().finally(() => {
      router.replace(safeNextPath);
    });
  }, [router, searchParams]);

  return (
    <main className="route-shell compact-route">
      <h1>Signing you in</h1>
      <p>Redirecting you back to ResumeRoster.</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="route-shell compact-route">
          <h1>Signing you in</h1>
          <p>Preparing your workspace.</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

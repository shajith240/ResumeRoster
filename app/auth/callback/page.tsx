"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Redirecting you back to ResumeRoster.");

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const storedNextPath = window.localStorage.getItem("resumeroster.auth.next");
      window.localStorage.removeItem("resumeroster.auth.next");

      const nextPath = searchParams.get("next") || storedNextPath || "/feed";
      const safeNextPath =
        nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/feed";

      const code = searchParams.get("code");
      const errorDescription =
        searchParams.get("error_description") || searchParams.get("error");

      if (errorDescription) {
        if (active) setMessage("Google sign-in was cancelled or blocked.");
        router.replace(`/?auth_error=${encodeURIComponent(errorDescription)}`);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (active) setMessage("We could not finish Google sign-in.");
          router.replace(`/?auth_error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        if (active) setMessage("No sign-in session was created. Please try again.");
        router.replace("/?auth_error=no_session");
        return;
      }

      router.replace(safeNextPath);
    }

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main className="route-shell compact-route">
      <h1>Signing you in</h1>
      <p>{message}</p>
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

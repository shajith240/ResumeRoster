"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
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
    <main className="full-page-loader">
      <LoadingScreen variant="plain" />
    </main>
  );
}

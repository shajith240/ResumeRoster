import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export async function signInWithGoogle(nextPath = "/feed") {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("resumeroster.auth.next", nextPath);
  }

  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("resumeroster.auth.next");
    }

    throw error;
  }

  return data;
}

export async function signOut() {
  return supabase.auth.signOut();
}

import { createClient, type Provider } from "@supabase/supabase-js";
import { AUTH_NEXT_STORAGE_KEY, getSafeNextPath } from "@/lib/auth-redirect";

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

type LintedAuthProvider = Extract<Provider, "google" | "github">;

function getAuthCallbackUrl(nextPath: string) {
	if (typeof window === "undefined") return undefined;

	const callbackUrl = new URL("/auth/callback", window.location.origin);
	callbackUrl.searchParams.set("next", getSafeNextPath(nextPath));
	return callbackUrl.toString();
}

export async function signInWithProvider(
	provider: LintedAuthProvider,
	nextPath = "/feed",
) {
	const safeNextPath = getSafeNextPath(nextPath);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, safeNextPath);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(safeNextPath),
    },
  });

  if (error) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
    }

    throw error;
  }

  return data;
}

export async function signInWithGoogle(nextPath = "/feed") {
	return signInWithProvider("google", nextPath);
}

export async function signOut() {
  return supabase.auth.signOut();
}

"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_NEXT_STORAGE_KEY, getSafeNextPath } from "@/lib/auth-redirect";
import { signInWithProvider, supabase } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";
type OAuthProvider = "google" | "github";
type SubmitState = AuthMode | OAuthProvider | "resend-confirmation" | null;
type AppTheme = "dark" | "light";
type EmailStatusResponse = {
	accountExists: boolean;
	emailConfirmed: boolean;
	lookupAvailable: boolean;
	providers: string[];
	requiresMigration?: boolean;
};
type ExistingAccountHint = {
	message: string;
	providers: string[];
};

const APP_THEME_STORAGE_KEY = "resumeroster-theme";
const APP_THEME_CHANGE_EVENT = "resumeroster-theme-change";

function getStoredAppTheme(): AppTheme {
	if (typeof window === "undefined") return "dark";
	return window.localStorage.getItem(APP_THEME_STORAGE_KEY) === "light"
		? "light"
		: "dark";
}

function applyAppTheme(theme: AppTheme) {
	const isDark = theme === "dark";
	document.body.classList.toggle("main-app-dark", isDark);
	document.documentElement.classList.toggle("dark", isDark);
	document.documentElement.dataset.appTheme = theme;
}

function getEmailRedirectUrl(nextPath: string) {
	if (typeof window === "undefined") return undefined;
	const callbackUrl = new URL("/auth/callback", window.location.origin);
	callbackUrl.searchParams.set("next", nextPath);
	return callbackUrl.toString();
}

function authErrorMessage(error: unknown) {
	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "We could not complete that. Try again.";
	const message = rawMessage.toLowerCase();

	if (message.includes("invalid login")) {
		return "Email or password is incorrect.";
	}

	if (message.includes("email not confirmed")) {
		return "Check your email to confirm this account before signing in.";
	}

	if (message.includes("already registered") || message.includes("already exists")) {
		return "An account already exists for this email. Try signing in.";
	}

	if (message.includes("provider") || message.includes("oauth")) {
		return "That sign-in provider could not start. Check the provider setup in Supabase.";
	}

	if (message.includes("no_session")) {
		return "Your sign-in did not finish. Please try again.";
	}

	return rawMessage;
}

function confirmationNotice() {
	return "Check your inbox for the confirmation link, then come back to sign in.";
}

function providerLabel(provider: string) {
	const labels: Record<string, string> = {
		email: "email and password",
		github: "GitHub",
		google: "Google",
	};

	return labels[provider] || provider;
}

function existingAccountMessage(providers: string[]) {
	const readableProviders = providers.map(providerLabel);
	const oauthProviders = providers.filter((provider) =>
		["google", "github"].includes(provider),
	);

	if (oauthProviders.length && !providers.includes("email")) {
		return `This email already has a ResumeRoster account. Continue with ${oauthProviders
			.map(providerLabel)
			.join(" or ")} to sign in.`;
	}

	if (readableProviders.length) {
		return `This email already has a ResumeRoster account. Sign in with ${readableProviders.join(
			" or ",
		)} instead.`;
	}

	return "This email already has a ResumeRoster account. Go to sign in instead.";
}

async function lookupEmailStatus(email: string) {
	try {
		const response = await fetch("/api/auth/email-status", {
			body: JSON.stringify({ email }),
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as EmailStatusResponse;
		return data.lookupAvailable ? data : null;
	} catch {
		return null;
	}
}

function GoogleIcon() {
	return (
		<svg aria-hidden="true" height="18" viewBox="0 0 256 262" width="18">
			<path
				d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
				fill="#4285f4"
			/>
			<path
				d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
				fill="#34a853"
			/>
			<path
				d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
				fill="#fbbc05"
			/>
			<path
				d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
				fill="#eb4335"
			/>
		</svg>
	);
}

function GitHubIcon() {
	return (
		<svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
			<path
				clipRule="evenodd"
				d="M12 2C6.477 2 2 6.484 2 12.021c0 4.425 2.865 8.178 6.839 9.504.5.092.683-.217.683-.483 0-.238-.009-.868-.014-1.704-2.782.605-3.369-1.344-3.369-1.344-.455-1.158-1.11-1.466-1.11-1.466-.908-.621.069-.608.069-.608 1.004.07 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.953 0-1.094.39-1.988 1.03-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.641.7 1.028 1.594 1.028 2.688 0 3.85-2.337 4.697-4.566 4.945.359.31.679.923.679 1.86 0 1.342-.012 2.425-.012 2.755 0 .268.18.58.688.482A10.025 10.025 0 0 0 22 12.021C22 6.484 17.523 2 12 2Z"
				fill="currentColor"
				fillRule="evenodd"
			/>
		</svg>
	);
}

export function SignUp() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextPath = useMemo(
		() => getSafeNextPath(searchParams.get("next")),
		[searchParams],
	);
	const [mode, setMode] = useState<AuthMode>(
		searchParams.get("mode") === "signup" ? "signup" : "signin",
	);
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [notice, setNotice] = useState("");
	const [submitting, setSubmitting] = useState<SubmitState>(null);
	const [confirmationEmail, setConfirmationEmail] = useState("");
	const [existingAccount, setExistingAccount] =
		useState<ExistingAccountHint | null>(null);

	useEffect(() => {
		document.body.classList.add("main-app");
		applyAppTheme(getStoredAppTheme());

		function handleThemeChange(event: Event) {
			const theme = (event as CustomEvent<AppTheme>).detail;
			applyAppTheme(theme === "light" ? "light" : "dark");
		}

		window.addEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);

		return () => {
			window.removeEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
			document.body.classList.remove("main-app");
			document.body.classList.remove("main-app-dark");
			document.documentElement.classList.remove("dark");
			delete document.documentElement.dataset.appTheme;
		};
	}, []);

	useEffect(() => {
		const authError = searchParams.get("auth_error");
		if (authError) {
			setMessage(authErrorMessage(authError));
		}
	}, [searchParams]);

	useEffect(() => {
		let active = true;

		supabase.auth.getSession().then(({ data }) => {
			if (!active || !data.session) return;
			router.replace(nextPath);
		});

		return () => {
			active = false;
		};
	}, [nextPath, router]);

	function switchMode(nextMode: AuthMode) {
		setMode(nextMode);
		setMessage("");
		setNotice("");
		setConfirmationEmail("");
		setExistingAccount(null);
	}

	async function handleProvider(provider: OAuthProvider) {
		setSubmitting(provider);
		setMessage("");
		setNotice("");
		setConfirmationEmail("");
		setExistingAccount(null);

		try {
			await signInWithProvider(provider, nextPath);
		} catch (error) {
			setMessage(authErrorMessage(error));
			setSubmitting(null);
		}
	}

	async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");
		setNotice("");
		setConfirmationEmail("");
		setExistingAccount(null);

		const trimmedEmail = email.trim().toLowerCase();
		const trimmedFullName = fullName.trim();

		if (!trimmedEmail) {
			setMessage("Enter your email address.");
			return;
		}

		if (password.length < 8) {
			setMessage("Use at least 8 characters for your password.");
			return;
		}

		if (mode === "signup" && trimmedFullName.length < 2) {
			setMessage("Add the name you want on your profile.");
			return;
		}

		setSubmitting(mode);

		if (mode === "signup") {
			const emailStatus = await lookupEmailStatus(trimmedEmail);

			if (emailStatus?.accountExists) {
				const providers = emailStatus.providers.filter(Boolean);
				setExistingAccount({
					message: existingAccountMessage(providers),
					providers,
				});
				setSubmitting(null);
				return;
			}
		}

		if (typeof window !== "undefined") {
			window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
		}

		const result =
			mode === "signin"
				? await supabase.auth.signInWithPassword({
						email: trimmedEmail,
						password,
					})
				: await supabase.auth.signUp({
						email: trimmedEmail,
						password,
						options: {
							data: {
								full_name: trimmedFullName,
							},
							emailRedirectTo: getEmailRedirectUrl(nextPath),
						},
					});

		if (result.error) {
			window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
			setMessage(authErrorMessage(result.error));
			setSubmitting(null);
			return;
		}

		if (result.data.session) {
			router.replace(nextPath);
			return;
		}

		setSubmitting(null);
		if (mode === "signup") {
			setConfirmationEmail(trimmedEmail);
			setNotice(confirmationNotice());
			return;
		}

		setNotice("Check your email before continuing.");
	}

	async function handleResendConfirmation() {
		const trimmedEmail = email.trim().toLowerCase();

		if (!trimmedEmail) {
			setMessage("Enter your email address first.");
			return;
		}

		setSubmitting("resend-confirmation");
		setMessage("");

		const { error } = await supabase.auth.resend({
			type: "signup",
			email: trimmedEmail,
			options: {
				emailRedirectTo: getEmailRedirectUrl(nextPath),
			},
		});

		setSubmitting(null);

		if (error) {
			setMessage(authErrorMessage(error));
			return;
		}

		setConfirmationEmail(trimmedEmail);
		setNotice(confirmationNotice());
	}

	const isBusy = submitting !== null;
	const canShowSignupNoticeActions =
		mode === "signup" && Boolean(confirmationEmail || notice);
	const existingOAuthProviders =
		existingAccount?.providers.filter((provider): provider is OAuthProvider =>
			["google", "github"].includes(provider),
		) ?? [];
	const title =
		mode === "signin" ? "Welcome back" : "Create your ResumeRoster account";
	const subtitle =
		mode === "signin"
			? "Sign in with email, Google, or GitHub."
			: "Use email, Google, or GitHub to start roasting resumes.";

	return (
		<main className="auth-route page-enter">
			<section className="auth-card" aria-labelledby="auth-title">
				<div className="auth-card-surface">
					<Link className="auth-wordmark" href="/" aria-label="ResumeRoster home">
						ResumeRoster
					</Link>

					<div className="auth-heading">
						<div className="auth-mode-tabs" aria-label="Choose auth mode">
							<button
								aria-pressed={mode === "signin"}
								onClick={() => switchMode("signin")}
								type="button"
							>
								Sign in
							</button>
							<button
								aria-pressed={mode === "signup"}
								onClick={() => switchMode("signup")}
								type="button"
							>
								Sign up
							</button>
						</div>
						<h1 id="auth-title">{title}</h1>
						<p>{subtitle}</p>
					</div>

					<div className="auth-provider-grid">
						<Button
							className="auth-provider-button h-10"
							disabled={isBusy}
							onClick={() => void handleProvider("google")}
							type="button"
							variant="outline"
						>
							<GoogleIcon />
							<span>{submitting === "google" ? "Opening..." : "Google"}</span>
						</Button>
						<Button
							className="auth-provider-button h-10"
							disabled={isBusy}
							onClick={() => void handleProvider("github")}
							type="button"
							variant="outline"
						>
							<GitHubIcon />
							<span>{submitting === "github" ? "Opening..." : "GitHub"}</span>
						</Button>
					</div>

					<div className="auth-divider" aria-hidden="true">
						<span />
						<p>or continue with email</p>
						<span />
					</div>

					<form className="auth-form" onSubmit={handleEmailSubmit}>
						{mode === "signup" ? (
							<div className="auth-field">
								<Label htmlFor="auth-full-name">Display name</Label>
								<div className="auth-input-wrap">
									<UserRound aria-hidden="true" size={16} strokeWidth={1.8} />
									<Input
										autoComplete="name"
										id="auth-full-name"
										maxLength={64}
										onChange={(event) => setFullName(event.target.value)}
										placeholder="Shajith Bathina"
										required
										type="text"
										value={fullName}
									/>
								</div>
							</div>
						) : null}

						<div className="auth-field">
							<Label htmlFor="auth-email">Email</Label>
							<div className="auth-input-wrap">
								<Mail aria-hidden="true" size={16} strokeWidth={1.8} />
								<Input
									autoComplete="email"
									id="auth-email"
									onChange={(event) => {
										setEmail(event.target.value);
										if (existingAccount) {
											setExistingAccount(null);
										}
										if (
											confirmationEmail &&
											event.target.value.trim().toLowerCase() !== confirmationEmail
										) {
											setConfirmationEmail("");
										}
									}}
									placeholder="you@example.com"
									required
									type="email"
									value={email}
								/>
							</div>
						</div>

						<div className="auth-field">
							<Label htmlFor="auth-password">Password</Label>
							<div className="auth-input-wrap">
								<Lock aria-hidden="true" size={16} strokeWidth={1.8} />
								<Input
									autoComplete={
										mode === "signin" ? "current-password" : "new-password"
									}
									id="auth-password"
									minLength={8}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="At least 8 characters"
									required
									type="password"
									value={password}
								/>
							</div>
						</div>

						{message ? (
							<p className="auth-form-message" role="alert">
								{message}
							</p>
						) : null}
						{existingAccount ? (
							<div className="auth-form-message" role="alert">
								<p>{existingAccount.message}</p>
								<div className="auth-notice-actions auth-account-actions">
									{existingOAuthProviders.map((provider) => (
										<button
											disabled={isBusy}
											key={provider}
											onClick={() => void handleProvider(provider)}
											type="button"
										>
											Continue with {providerLabel(provider)}
										</button>
									))}
									<button onClick={() => switchMode("signin")} type="button">
										Go to sign in
									</button>
								</div>
							</div>
						) : null}
						{notice ? (
							<div className="auth-form-notice" role="status">
								<p>{notice}</p>
								{canShowSignupNoticeActions ? (
									<div className="auth-notice-actions">
										<button
											disabled={isBusy}
											onClick={() => void handleResendConfirmation()}
											type="button"
										>
											{submitting === "resend-confirmation"
												? "Sending..."
												: "Resend email"}
										</button>
										<button
											onClick={() => switchMode("signin")}
											type="button"
										>
											Go to sign in
										</button>
									</div>
								) : null}
							</div>
						) : null}

						<Button
							className="auth-submit-button h-10 w-full"
							disabled={isBusy}
							type="submit"
						>
							<span>
								{submitting === mode
									? mode === "signin"
										? "Signing in..."
										: "Creating account..."
									: mode === "signin"
										? "Sign in"
										: "Create account"}
							</span>
							<ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
						</Button>
					</form>
				</div>

				<div className="auth-card-footer">
					<p>
						{mode === "signin"
							? "New to ResumeRoster?"
							: "Already have an account?"}
					</p>
					<button
						onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
						type="button"
					>
						{mode === "signin" ? "Create one" : "Sign in"}
					</button>
				</div>
			</section>
		</main>
	);
}

export const Component = SignUp;
export default SignUp;

"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "@/components/ui/solar-icons";
import BrandMark from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_NEXT_STORAGE_KEY, getSafeNextPath } from "@/lib/auth-redirect";
import { consumeSessionSupersededNotice } from "@/lib/session-lock";
import { signInWithProvider, supabase } from "@/lib/supabase/client";
import styles from "./SignUp.module.css";

type AuthMode = "signin" | "signup";
type OAuthProvider = "google" | "github";
type SubmitState = AuthMode | OAuthProvider | "resend-confirmation" | null;
type AppTheme = "dark" | "light";

const APP_THEME_STORAGE_KEY = "linted-theme";
const APP_THEME_CHANGE_EVENT = "linted-theme-change";

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
		return "Check your inbox for the confirmation link, then come back to sign in.";
	}

	if (message.includes("provider") || message.includes("oauth")) {
		return "That sign-in provider could not start. Check the provider setup in Supabase.";
	}

	if (message.includes("no_session")) {
		return "Your sign-in did not finish. Please try again.";
	}

	if (
		message.includes("session_replaced") ||
		message.includes("active_elsewhere")
	) {
		return "This account is already active in another browser. Sign in again here to continue.";
	}

	return rawMessage;
}

function isExistingAccountError(error: unknown) {
	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	const message = rawMessage.toLowerCase();

	return message.includes("already registered") || message.includes("already exists");
}

function confirmationNotice() {
	return "Check your inbox for the confirmation link, then come back to sign in.";
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

function SignUp() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextPath = useMemo(
		() => getSafeNextPath(searchParams.get("next")),
		[searchParams],
	);
	const [mode, setMode] = useState<AuthMode>(
		searchParams.get("mode") === "signup" ? "signup" : "signin",
	);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [notice, setNotice] = useState("");
	const [submitting, setSubmitting] = useState<SubmitState>(null);
	const [confirmationEmail, setConfirmationEmail] = useState("");

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
		};
	}, []);

	useEffect(() => {
		const sessionNotice = consumeSessionSupersededNotice();
		if (sessionNotice) {
			setMessage(sessionNotice);
		}

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
	}

	async function handleProvider(provider: OAuthProvider) {
		setSubmitting(provider);
		setMessage("");
		setNotice("");
		setConfirmationEmail("");

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

		const trimmedEmail = email.trim().toLowerCase();
		if (!trimmedEmail) {
			setMessage("Enter your email address.");
			return;
		}

		if (password.length < 8) {
			setMessage("Use at least 8 characters for your password.");
			return;
		}

		setSubmitting(mode);

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
							emailRedirectTo: getEmailRedirectUrl(nextPath),
						},
					});

		if (result.error) {
			window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
			if (mode === "signup" && isExistingAccountError(result.error)) {
				setConfirmationEmail(trimmedEmail);
				setNotice(confirmationNotice());
				setSubmitting(null);
				return;
			}

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
	const title = mode === "signin" ? "Welcome back" : "Create your account";
	const subtitle =
		mode === "signin"
			? "Sign in with email, Google, or GitHub."
			: "Use email, Google, or GitHub to start linting resumes.";

	return (
		<main className={`${styles.route} page-enter`}>
			<section className={styles.card} aria-labelledby="auth-title">
				<div className={styles.cardSurface}>
					<Link className={styles.wordmark} href="/" aria-label="Linted home">
						<BrandMark />
					</Link>

					<div className={styles.heading}>
						<div className={styles.modeTabs} aria-label="Choose auth mode">
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

					<div className={styles.providerGrid}>
						<Button
							className={`${styles.providerButton} h-10`}
							disabled={isBusy}
							onClick={() => void handleProvider("google")}
							type="button"
							variant="outline"
						>
							<GoogleIcon />
							<span>{submitting === "google" ? "Opening..." : "Google"}</span>
						</Button>
						<Button
							className={`${styles.providerButton} h-10`}
							disabled={isBusy}
							onClick={() => void handleProvider("github")}
							type="button"
							variant="outline"
						>
							<GitHubIcon />
							<span>{submitting === "github" ? "Opening..." : "GitHub"}</span>
						</Button>
					</div>

					<div className={styles.divider} aria-hidden="true">
						<span />
						<p>or continue with email</p>
						<span />
					</div>

					<form className={styles.form} onSubmit={handleEmailSubmit}>
						<div className={styles.field}>
							<Label htmlFor="auth-email">Email</Label>
							<div className={styles.inputWrap}>
								<Mail aria-hidden="true" size={16} strokeWidth={1.8} />
								<Input
									autoComplete="email"
									id="auth-email"
									onChange={(event) => {
										setEmail(event.target.value);
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

						<div className={styles.field}>
							<Label htmlFor="auth-password">Password</Label>
							<div className={styles.inputWrap}>
								<Lock aria-hidden="true" size={16} />
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
							<p className={styles.formMessage} role="alert">
								{message}
							</p>
						) : null}
						{notice ? (
							<div className={styles.formNotice} role="status">
								<p>{notice}</p>
								{canShowSignupNoticeActions ? (
									<div className={styles.noticeActions}>
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
							className={`${styles.submitButton} h-10 w-full`}
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
							<ArrowRight aria-hidden="true" size={16} />
						</Button>
						<p className={styles.legalCopy}>
							By continuing, you agree to{" "}
							<Link href="/terms">Terms</Link> and{" "}
							<Link href="/privacy">Privacy Policy</Link>.
						</p>
					</form>
				</div>

				<div className={styles.cardFooter}>
					<p>
						{mode === "signin"
							? "New to Linted?"
							: "Already have an account?"}
					</p>
					<button
						onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
						type="button"
					>
						{mode === "signin" ? "Create one" : "Sign in"}
					</button>
				</div>
				<div className={styles.cardBack}>
					<Link href="/">← Back to home</Link>
				</div>
			</section>
		</main>
	);
}

export default SignUp;

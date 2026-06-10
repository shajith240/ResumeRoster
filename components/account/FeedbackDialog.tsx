"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Send } from "@/components/ui/solar-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import {
	USER_FEEDBACK_BODY_MAX_LENGTH,
	USER_FEEDBACK_CATEGORIES,
	USER_FEEDBACK_CATEGORY_LABELS,
	USER_FEEDBACK_TITLE_MAX_LENGTH,
} from "@/lib/user-feedback";
import type { UserFeedbackCategory } from "@/lib/supabase/types";

export function FeedbackDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [body, setBody] = useState("");
	const [category, setCategory] = useState<UserFeedbackCategory>("bug");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [title, setTitle] = useState("");

	useEffect(() => {
		if (!open) {
			setMessage("");
		}
	}, [open]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		const trimmedTitle = title.trim();
		const trimmedBody = body.trim();
		if (trimmedTitle.length < 3) {
			setMessage("Add a short title.");
			return;
		}
		if (trimmedBody.length < 10) {
			setMessage("Add a little more detail.");
			return;
		}

		setSubmitting(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session?.access_token) {
				throw new Error("Sign in again before sending feedback.");
			}

			const response = await fetch("/api/feedback", {
				body: JSON.stringify({
					body: trimmedBody,
					category,
					metadata: {
						referrer: document.referrer || "",
						title: document.title || "",
					},
					sourcePath: `${window.location.pathname}${window.location.search}`,
					title: trimmedTitle,
					viewport: `${window.innerWidth}x${window.innerHeight}`,
				}),
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					(data as { message?: string }).message ?? "Feedback could not be sent.",
				);
			}

			toast.success("Feedback sent. I will review it from admin.");
			setBody("");
			setCategory("bug");
			setTitle("");
			onOpenChange(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Feedback could not be sent.";
			setMessage(errorMessage);
			toast.error(errorMessage);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="user-feedback-dialog">
				<DialogHeader>
					<DialogTitle>Send feedback</DialogTitle>
					<DialogDescription>
						Report bugs, UI friction, confusing flows, or ideas that would make
						Linted better.
					</DialogDescription>
				</DialogHeader>
				<form className="user-feedback-form" onSubmit={handleSubmit}>
					<label>
						<span>Type</span>
						<Select
							onValueChange={(value) =>
								setCategory(value as UserFeedbackCategory)
							}
							value={category}
						>
							<SelectTrigger className="user-feedback-select-trigger">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="user-feedback-select-content">
								<SelectGroup>
									{USER_FEEDBACK_CATEGORIES.map((item) => (
										<SelectItem
											className="user-feedback-select-item"
											key={item}
											value={item}
										>
											{USER_FEEDBACK_CATEGORY_LABELS[item]}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</label>
					<label>
						<span>
							Title <b>{title.length}/{USER_FEEDBACK_TITLE_MAX_LENGTH}</b>
						</span>
						<input
							maxLength={USER_FEEDBACK_TITLE_MAX_LENGTH}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="What should I look at?"
							value={title}
						/>
					</label>
					<label>
						<span>
							Details <b>{body.length}/{USER_FEEDBACK_BODY_MAX_LENGTH}</b>
						</span>
						<textarea
							maxLength={USER_FEEDBACK_BODY_MAX_LENGTH}
							onChange={(event) => setBody(event.target.value)}
							placeholder="What happened, what did you expect, and where did it feel wrong?"
							value={body}
						/>
					</label>
					{message ? <p className="form-message">{message}</p> : null}
					<DialogFooter>
						<Button
							disabled={submitting}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={submitting} type="submit">
							<Send aria-hidden="true" />
							{submitting ? "Sending..." : "Send feedback"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

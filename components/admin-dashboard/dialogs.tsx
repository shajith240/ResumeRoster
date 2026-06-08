import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
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
import {
	ADMIN_MESSAGE_BODY_MAX_LENGTH,
	ADMIN_MESSAGE_TITLE_MAX_LENGTH,
	DEFAULT_ADMIN_MESSAGE_LINK,
	isSafeAdminMessageLink,
} from "@/lib/admin-messages";
import { adminMessageLinkOptions, adminMessageTemplates } from "./constants";
import {
	createAdminMessageRequestId,
	getAdminMessageAudienceLabel,
	getAdminMessageLinkChoice,
	getFootprintTotal,
	getProfileLabel,
} from "./utils";
import type { AdminMessageDialogTarget, AdminMessageForm, AdminUser } from "./types";

export function AdminMessageDialog({
	busy,
	onOpenChange,
	onSend,
	target,
}: {
	busy: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (message: AdminMessageForm) => Promise<void>;
	target: AdminMessageDialogTarget | null;
}) {
	const [form, setForm] = useState<AdminMessageForm>({
		body: "",
		customLinkHref: "",
		linkChoice: DEFAULT_ADMIN_MESSAGE_LINK,
		requestId: "",
		title: "",
	});
	const [broadcastConfirmed, setBroadcastConfirmed] = useState(false);
	const audienceLabel = getAdminMessageAudienceLabel(target);
	const titleLength = form.title.length;
	const bodyLength = form.body.length;
	const titleReady =
		form.title.trim().length > 0 &&
		form.title.trim().length <= ADMIN_MESSAGE_TITLE_MAX_LENGTH;
	const bodyReady =
		form.body.trim().length > 0 &&
		form.body.trim().length <= ADMIN_MESSAGE_BODY_MAX_LENGTH;
	const linkReady =
		form.linkChoice !== "custom" ||
		isSafeAdminMessageLink(form.customLinkHref);
	const requestReady = form.requestId.length > 0;
	const needsBroadcastConfirmation = target?.mode === "all";
	const canSend =
		Boolean(target) &&
		titleReady &&
		bodyReady &&
		linkReady &&
		requestReady &&
		(!needsBroadcastConfirmation || broadcastConfirmed) &&
		!busy;

	useEffect(() => {
		if (!target) return;

		setForm({
			body: "",
			customLinkHref: "",
			linkChoice: DEFAULT_ADMIN_MESSAGE_LINK,
			requestId: createAdminMessageRequestId(),
			title: "",
		});
		setBroadcastConfirmed(false);
	}, [target]);

	function applyTemplate(template: (typeof adminMessageTemplates)[number]) {
		const linkChoice = getAdminMessageLinkChoice(template.linkHref);

		setForm((current) => ({
			body: template.body,
			customLinkHref: linkChoice === "custom" ? template.linkHref : "",
			linkChoice,
			requestId: current.requestId,
			title: template.title,
		}));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSend) return;

		await onSend(form);
	}

	return (
		<Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
			<DialogContent className="admin-message-dialog">
				<DialogHeader>
					<DialogTitle>Message users</DialogTitle>
					<DialogDescription>
						Send a system notification through the existing inbox.
					</DialogDescription>
				</DialogHeader>
				<form className="admin-message-form" onSubmit={handleSubmit}>
					<div className="admin-message-audience">
						<span>Audience</span>
						<strong title={audienceLabel}>{audienceLabel}</strong>
					</div>

					<div className="admin-message-templates" aria-label="Message templates">
						{adminMessageTemplates.map((template) => (
							<button
								key={template.id}
								onClick={() => applyTemplate(template)}
								type="button"
							>
								{template.label}
							</button>
						))}
					</div>

					<label className="admin-message-field">
						<span>
							Title <b>{titleLength}/{ADMIN_MESSAGE_TITLE_MAX_LENGTH}</b>
						</span>
						<input
							maxLength={ADMIN_MESSAGE_TITLE_MAX_LENGTH}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							value={form.title}
						/>
					</label>

					<label className="admin-message-field">
						<span>
							Message <b>{bodyLength}/{ADMIN_MESSAGE_BODY_MAX_LENGTH}</b>
						</span>
						<textarea
							maxLength={ADMIN_MESSAGE_BODY_MAX_LENGTH}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									body: event.target.value,
								}))
							}
							value={form.body}
						/>
					</label>

					<label className="admin-message-field">
						<span>Link</span>
						<Select
							onValueChange={(value) =>
								setForm((current) => ({
									...current,
									linkChoice: value,
								}))
							}
							value={form.linkChoice}
						>
							<SelectTrigger className="admin-message-select">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="admin-message-select-content">
								<SelectGroup>
									{adminMessageLinkOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</label>

					{form.linkChoice === "custom" ? (
						<label className="admin-message-field">
							<span>Custom path</span>
							<input
								aria-invalid={
									form.customLinkHref
										? !isSafeAdminMessageLink(form.customLinkHref)
										: undefined
								}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										customLinkHref: event.target.value,
									}))
								}
								placeholder="/community"
								value={form.customLinkHref}
							/>
						</label>
					) : null}

					{target?.mode === "all" ? (
						<label className="admin-message-confirm">
							<input
								checked={broadcastConfirmed}
								onChange={(event) =>
									setBroadcastConfirmed(event.target.checked)
								}
								type="checkbox"
							/>
							<span>Send this to all users</span>
						</label>
					) : null}

					<DialogFooter>
						<DialogClose asChild>
							<Button disabled={busy} type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button disabled={!canSend} type="submit">
							<Send aria-hidden="true" />
							{busy ? "Sending..." : "Send"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function DeleteUserDialog({
	busy,
	onConfirm,
	onOpenChange,
	user,
}: {
	busy: boolean;
	onConfirm: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	user: AdminUser | null;
}) {
	const label =
		user?.email || getProfileLabel(user?.profile ?? null) || "this user";
	const footprintTotal = getFootprintTotal(user?.dataFootprint);

	return (
		<AlertDialog open={Boolean(user)} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>Delete user?</AlertDialogTitle>
					<AlertDialogDescription>
						This will remove {label}, their account, profile, resumes, reviews,
						votes, notifications, uploads, and {footprintTotal} linked records.
						This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							void onConfirm();
						}}
					>
						{busy ? "Deleting..." : "Delete user"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

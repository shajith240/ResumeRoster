import Link from "next/link";
import {
	Activity,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	MessageSquare,
	RotateCcw,
	Search,
	ShieldAlert,
	Trash2,
	UserX,
} from "@/components/ui/solar-icons";
import { Button } from "@/components/ui/button";
import { ActionButton, EmptyPanel, PanelHeader } from "./shared";
import {
	formatAdminPresenceStatus,
	formatDate,
	formatRelativeAdminTime,
	getFootprintTotal,
	getProfileLabel,
	getProfileSecondary,
} from "./utils";
import type {
	ActiveAdminUser,
	AdminMessageDialogTarget,
	AdminUser,
	AdminUsersPagination,
} from "./types";

export function PeoplePage({
	activeUsers,
	busyAction,
	currentAdminUserId,
	latestUsers,
	onAction,
	onDeleteRequest,
	onMessageRequest,
	onPageChange,
	onQueryChange,
	pagination,
	query,
	users,
}: {
	activeUsers: ActiveAdminUser[];
	busyAction: string;
	currentAdminUserId: string;
	latestUsers: AdminUser[];
	onAction: (userId: string, action: string) => Promise<void>;
	onDeleteRequest: (user: AdminUser) => void;
	onMessageRequest: (target: AdminMessageDialogTarget) => void;
	onPageChange: (page: number) => void;
	onQueryChange: (value: string) => void;
	pagination: AdminUsersPagination;
	query: string;
	users: AdminUser[];
}) {
	return (
		<div className="admin-people-workspace">
			<div className="admin-people-overview-grid">
				<LatestPeoplePanel users={latestUsers} />
				<ActiveUsersPanel activeUsers={activeUsers} />
			</div>

			<section className="admin-console-section">
				<PanelHeader
					description="Search accounts, inspect footprint, and manage profile or deletion actions."
					title="People Directory"
				>
					<Button
						className="admin-panel-button"
						onClick={() => onMessageRequest({ mode: "all" })}
						type="button"
					>
						<MessageSquare aria-hidden="true" />
						Message users
					</Button>
				</PanelHeader>
				<div className="admin-people-toolbar">
					<label className="admin-search">
						<Search aria-hidden="true" />
						<input
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder="Search email, username, reviewer claim, trust status"
							value={query}
						/>
					</label>
					<PeoplePagination
						onPageChange={onPageChange}
						pagination={pagination}
					/>
				</div>
				<div className="admin-table-wrap">
					<table className="admin-table admin-people-table">
						<thead>
							<tr>
								<th>User</th>
								<th>Public profile</th>
								<th>Footprint</th>
								<th>Trust</th>
								<th>Last sign in</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((adminUser) => (
								<UserRow
									adminUser={adminUser}
									busyAction={busyAction}
									currentAdminUserId={currentAdminUserId}
									key={adminUser.id}
									onAction={onAction}
									onDeleteRequest={onDeleteRequest}
									onMessageRequest={onMessageRequest}
								/>
							))}
						</tbody>
					</table>
					{!users.length ? (
						<EmptyPanel
							description="Try a different email, username, or role."
							title="No matching users"
						/>
					) : null}
				</div>
				<PeoplePagination onPageChange={onPageChange} pagination={pagination} />
			</section>
		</div>
	);
}

export function LatestPeoplePanel({ users }: { users: AdminUser[] }) {
	return (
		<section className="admin-console-section admin-people-summary-panel">
			<PanelHeader
				description="The newest profiles created in Linted."
				title="Latest 10 People"
			/>
			<div className="admin-compact-list">
				{users.map((user) => (
					<MiniUserRow
						detail={user.email ?? "No email"}
						href={`/profile/${user.id}`}
						key={user.id}
						meta={formatRelativeAdminTime(user.created_at)}
						timestamp={user.created_at ?? undefined}
						title={getProfileLabel(user.profile)}
					/>
				))}
				{!users.length ? (
					<EmptyPanel
						description="New accounts will appear here."
						title="No people yet"
					/>
				) : null}
			</div>
		</section>
	);
}

export function ActiveUsersPanel({
	activeUsers,
}: {
	activeUsers: ActiveAdminUser[];
}) {
	return (
		<section className="admin-console-section admin-people-summary-panel">
			<PanelHeader
				description="Profiles seen in the last two minutes."
				title="Live Active Users"
			>
				<span className="admin-live-count">
					<Activity aria-hidden="true" />
					{activeUsers.length}
				</span>
			</PanelHeader>
			<div className="admin-compact-list">
				{activeUsers.map((user) => (
					<MiniUserRow
						detail={user.email ?? "No email"}
						href={`/profile/${user.userId}`}
						key={`${user.userId}-${user.lastSeenAt}`}
						meta={`${formatAdminPresenceStatus(user.status)} - ${formatRelativeAdminTime(user.lastSeenAt)}`}
						timestamp={user.lastSeenAt}
						title={getProfileLabel(user.profile)}
					/>
				))}
				{!activeUsers.length ? (
					<EmptyPanel
						description="Active sessions refresh automatically."
						title="No one active now"
					/>
				) : null}
			</div>
		</section>
	);
}

export function MiniUserRow({
	detail,
	href,
	meta,
	timestamp,
	title,
}: {
	detail: string;
	href: string;
	meta: string;
	timestamp?: string;
	title: string;
}) {
	const initials = title
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<Link className="admin-mini-user-row" href={href}>
			<span className="admin-mini-avatar">{initials || "LI"}</span>
			<span className="admin-mini-copy">
				<strong>{title}</strong>
				<small>{detail}</small>
			</span>
			<time dateTime={timestamp}>{meta}</time>
		</Link>
	);
}

export function PeoplePagination({
	onPageChange,
	pagination,
}: {
	onPageChange: (page: number) => void;
	pagination: AdminUsersPagination;
}) {
	const page = pagination.page;
	const lastPage = Math.max(1, pagination.lastPage);

	return (
		<div className="admin-pagination" aria-label="People table pagination">
			<span>
				{pagination.total
					? `${pagination.from}-${pagination.to} of ${pagination.total}`
					: "0 people"}
			</span>
			<div>
				<button
					disabled={!pagination.hasPreviousPage}
					onClick={() => onPageChange(Math.max(1, page - 1))}
					type="button"
				>
					<ChevronLeft aria-hidden="true" />
					Previous
				</button>
				<b>
					Page {page} of {lastPage}
				</b>
				<button
					disabled={!pagination.hasNextPage}
					onClick={() => onPageChange(Math.min(lastPage, page + 1))}
					type="button"
				>
					Next
					<ChevronRight aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

export function UserRow({
	adminUser,
	busyAction,
	currentAdminUserId,
	onAction,
	onDeleteRequest,
	onMessageRequest,
}: {
	adminUser: AdminUser;
	busyAction: string;
	currentAdminUserId: string;
	onAction: (userId: string, action: string) => Promise<void>;
	onDeleteRequest: (user: AdminUser) => void;
	onMessageRequest: (target: AdminMessageDialogTarget) => void;
}) {
	const profile = adminUser.profile;
	const label = profile ? getProfileLabel(profile) : adminUser.email || adminUser.id;
	const footprint = adminUser.dataFootprint;
	const isSelf = currentAdminUserId === adminUser.id;

	return (
		<tr>
			<td>
				<div className="admin-cell-stack">
					<strong>{label}</strong>
					<span>{adminUser.email ?? "No email"}</span>
				</div>
			</td>
			<td>
				<div className="admin-cell-stack">
					<span>{getProfileSecondary(profile)}</span>
					<span>{profile?.community_role ?? "candidate"}</span>
				</div>
			</td>
			<td>
				<div className="admin-cell-stack">
					<strong>{getFootprintTotal(footprint)} linked records</strong>
					<span>
						{footprint?.resumes ?? 0} resumes, {footprint?.reviews ?? 0} reviews
					</span>
					<span>
						{footprint?.votes ?? 0} votes, {footprint?.attachments ?? 0} uploads
					</span>
				</div>
			</td>
			<td>
				<span className="admin-pill">
					{profile?.reviewer_verification_status ?? "none"}
				</span>
			</td>
			<td>{formatDate(adminUser.last_sign_in_at)}</td>
			<td>
				<div className="admin-action-row admin-people-actions">
					<Link href={`/profile/${adminUser.id}`}>
						<ExternalLink aria-hidden="true" />
						Open
					</Link>
					<button
						onClick={() => onMessageRequest({ mode: "user", user: adminUser })}
						type="button"
					>
						<MessageSquare aria-hidden="true" />
						Message
					</button>
					<ActionButton
						action="reset_reviewer_trust"
						busyAction={busyAction}
						icon={<RotateCcw aria-hidden="true" />}
						label="Reset trust"
						onClick={() => onAction(adminUser.id, "reset_reviewer_trust")}
						scope="user"
						targetId={adminUser.id}
					/>
					<ActionButton
						action="clear_public_profile_text"
						busyAction={busyAction}
						icon={<Trash2 aria-hidden="true" />}
						label="Clear text"
						onClick={() => onAction(adminUser.id, "clear_public_profile_text")}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
					<ActionButton
						action="clear_reviewer_profile"
						busyAction={busyAction}
						icon={<ShieldAlert aria-hidden="true" />}
						label="Clear reviewer"
						onClick={() => onAction(adminUser.id, "clear_reviewer_profile")}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
					<ActionButton
						action="delete_user_account"
						busyAction={busyAction}
						disabled={isSelf}
						icon={<UserX aria-hidden="true" />}
						label="Delete user"
						onClick={() => {
							onDeleteRequest(adminUser);
							return Promise.resolve();
						}}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
				</div>
			</td>
		</tr>
	);
}

"use client";

import Link from "next/link";
import {
	BriefcaseBusiness,
	CalendarDays,
	Flag,
	GraduationCap,
	MapPin,
	Pencil,
} from "@/components/ui/solar-icons";
import LintPointsFlame from "@/components/LintPointsFlame";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASON_OPTIONS } from "@/lib/report-validation";
import styles from "./ProfileDetail.module.css";
import { SUPABASE_MIGRATION_MESSAGE, VERIFIED_TICK_SRC } from "./profile-detail/constants";
import { ProfileEditDialog } from "./profile-detail/edit-dialog";
import { ProfileDetailSkeleton } from "./profile-detail/ProfileDetailSkeleton";
import { ActivityRow, ReviewRow } from "./profile-detail/rows";
import type { ProfileDetailProps } from "./profile-detail/types";
import { useProfileDetailController } from "./profile-detail/use-profile-detail-controller";
import { formatDate } from "./profile-detail/utils";

export default function ProfileDetail({ profileId }: ProfileDetailProps) {
	const {
		about,
		avatarPreview,
		college,
		collegeLocation,
		currentPosition,
		editOpen,
		fullName,
		handleAvatarChange,
		isOnline,
		isOwnProfile,
		loading,
		message,
		openProfileReportDialog,
		profile,
		profileReportDetails,
		profileReportOpen,
		profileReportReason,
		profileReportSchemaReady,
		profileReportSubmitting,
		profileView,
		reviews,
		saveMessage,
		saveProfile,
		saving,
		setAbout,
		setCollege,
		setCollegeLocation,
		setCurrentPosition,
		setEditOpen,
		setFullName,
		setProfileReportDetails,
		setProfileReportOpen,
		setProfileReportReason,
		setSkillsInput,
		setTagline,
		setUsername,
		skillsInput,
		submitProfileReport,
		tagline,
		username,
	} = useProfileDetailController(profileId);

	if (loading) {
		return <ProfileDetailSkeleton />;
	}

	if (message) {
		return (
			<section className={styles.shell}>
				<div className={styles.emptyState}>
					<h1>Profile unavailable</h1>
					<p>{message}</p>
					<Link className="btn-primary" href="/leaderboard">
						View leaderboard
					</Link>
				</div>
			</section>
		);
	}

	if (!profile || !profileView) {
		return (
			<section className={styles.shell}>
				<div className={styles.emptyState}>
					<h1>Profile not found</h1>
					<p>This community member does not have public activity yet.</p>
					<Link className="btn-primary" href="/leaderboard">
						View leaderboard
					</Link>
				</div>
			</section>
		);
	}

	return (
		<section className={`${styles.shell} page-enter`}>
			<div className={styles.canvas}>
				<header className={styles.hero}>
					<div className={styles.avatarFrame}>
						<img
							src={profileView.avatarUrl}
							alt={`${profileView.displayName} profile photo`}
							width={180}
							height={180}
						/>
						{isOnline ? (
							<span
								aria-label={`${profileView.displayName} is online`}
								className={styles.onlineIndicator}
								title="Online now"
							/>
						) : null}
					</div>

					<div className={styles.identity}>
						<div className={styles.identityHeader}>
							<h1>{profileView.displayName}</h1>
							{profileView.reviewerStatus === "verified" ? (
								<span
									className={styles.verifiedNameBadge}
									title="Trusted reviewer verified by Linted"
									aria-label="Trusted reviewer verified by Linted"
								>
									<img src={VERIFIED_TICK_SRC} alt="" aria-hidden="true" />
								</span>
							) : null}
						</div>
						<div className={styles.profileSignals}>
							<div className={styles.roleTag}>{profileView.roleTag}</div>
							<div
								className={styles.lintPointsBadge}
								aria-label={`${profileView.lintPoints.toLocaleString()} lint points`}
							>
								<LintPointsFlame className={styles.lintPointsFlame} />
								<strong>{profileView.lintPoints.toLocaleString()}</strong>
								<span>Lint Points</span>
							</div>
						</div>
						<p>{profileView.tagline}</p>
						<div className={styles.profileDetailsRow}>
							<div className={styles.metaList}>
								<span>
									<BriefcaseBusiness aria-hidden="true" />
									{profileView.currentRole}
								</span>
								<span>
									<GraduationCap aria-hidden="true" />
									{profileView.collegeLabel}
								</span>
								<span>
									<MapPin aria-hidden="true" />
									{profileView.collegeLocation}
								</span>
								<span>
									<CalendarDays aria-hidden="true" />
									Member since {formatDate(profile.created_at)}
								</span>
							</div>

							{isOwnProfile ? (
								<Dialog open={editOpen} onOpenChange={setEditOpen}>
									<DialogTrigger asChild>
										<Button className={styles.editButton} type="button">
											<Pencil aria-hidden="true" />
											Edit Profile
										</Button>
									</DialogTrigger>
									<ProfileEditDialog
										about={about}
										avatarPreview={avatarPreview || profileView.avatarUrl}
										college={college}
										collegeLocation={collegeLocation}
										currentPosition={currentPosition}
										displayName={profileView.displayName}
										fullName={fullName}
										handleAvatarChange={handleAvatarChange}
										initials={profileView.initials}
										onAboutChange={setAbout}
										onCollegeChange={setCollege}
										onCollegeLocationChange={setCollegeLocation}
										onCurrentPositionChange={setCurrentPosition}
										onFullNameChange={setFullName}
										profileOwnerId={profile.id}
										onSave={saveProfile}
										onSkillsChange={setSkillsInput}
										onTaglineChange={setTagline}
										onUsernameChange={setUsername}
										originalUsername={profile.username ?? ""}
										saveMessage={saveMessage}
										saving={saving}
										skillsInput={skillsInput}
										tagline={tagline}
										username={username}
									/>
								</Dialog>
							) : null}
							{!isOwnProfile ? (
								<Button
									className={styles.reportProfileButton}
									disabled={!profileReportSchemaReady}
									onClick={openProfileReportDialog}
									title={
										profileReportSchemaReady
											? undefined
											: `${SUPABASE_MIGRATION_MESSAGE} Profile reports are not ready yet.`
									}
									type="button"
									variant="outline"
								>
									<Flag aria-hidden="true" />
									Report Profile
								</Button>
							) : null}
						</div>
					</div>
				</header>

				<div className={styles.profileGrid}>
					<section className={styles.aboutPanel}>
						<h2>About Me</h2>
						<p>
							{profile.about ||
								"Community member focused on practical feedback, sharper proof, and cleaner first impressions."}
						</p>
					</section>

					<section className={styles.skillsPanel}>
						<h2>Top Skills</h2>
						<div className={styles.skillCloud}>
							{profileView.skills.map((skill) => (
								<span key={skill}>{skill}</span>
							))}
						</div>
					</section>
				</div>

				<div className={styles.activityGrid}>
					<section className={styles.activityPanel}>
						<div className={styles.panelHeader}>
							<h2>Recent Activity</h2>
							<Link href="/feed">View all</Link>
						</div>
						<div className={styles.activityList}>
							{profileView.activity.map((item) => (
								<ActivityRow item={item} key={item.id} />
							))}
						</div>
					</section>

					<section className={styles.reviewsPanel}>
						<div className={styles.panelHeader}>
							<h2>Recent Reviews</h2>
							<Link href="/feed">View all</Link>
						</div>
						{reviews.length ? (
							<div className={styles.reviewList}>
								{reviews.slice(0, 4).map((review) => (
									<ReviewRow review={review} key={review.id} />
								))}
							</div>
						) : (
							<p className={styles.mutedCopy}>
								No public reviews yet. Helpful feedback will show up here.
							</p>
						)}
					</section>
				</div>
			</div>
			<Dialog
				open={profileReportOpen}
				onOpenChange={(open) => {
					if (!open && !profileReportSubmitting) {
						setProfileReportOpen(false);
						setProfileReportDetails("");
					}
				}}
			>
				<DialogContent className="report-dialog-content">
					<DialogHeader>
						<DialogTitle>Report profile</DialogTitle>
						<DialogDescription>
							Send this profile to the moderation queue. Reports are private and
							help keep community profiles trustworthy.
						</DialogDescription>
					</DialogHeader>
					<form className="report-form" onSubmit={submitProfileReport}>
						<div className="report-target-preview">
							<span>{profileView.displayName}</span>
							<p>{profileView.tagline}</p>
						</div>
						<div className="report-reason-grid" aria-label="Report reason">
							{REPORT_REASON_OPTIONS.map((option) => (
								<button
									aria-pressed={profileReportReason === option.value}
									className={
										profileReportReason === option.value ? "is-selected" : ""
									}
									key={option.value}
									onClick={() => setProfileReportReason(option.value)}
									type="button"
								>
									<span>{option.label}</span>
									<small>{option.description}</small>
								</button>
							))}
						</div>
						<label className="report-details-field">
							<span>Context for moderators</span>
							<textarea
								maxLength={REPORT_DETAILS_MAX_LENGTH}
								onChange={(event) => setProfileReportDetails(event.target.value)}
								placeholder="Optional, unless you choose Other."
								rows={4}
								value={profileReportDetails}
							/>
						</label>
						<div className="report-form-meta">
							<span>
								{REPORT_DETAILS_MAX_LENGTH - profileReportDetails.length} characters
								left
							</span>
						</div>
						<DialogFooter>
							<Button
								disabled={profileReportSubmitting}
								onClick={() => {
									setProfileReportOpen(false);
									setProfileReportDetails("");
								}}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="btn-brand"
								disabled={profileReportSubmitting}
								type="submit"
							>
								{profileReportSubmitting ? "Sending..." : "Send report"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</section>
	);
}

import type { ReactNode } from "react";
import styles from "../ProfileDetail.module.css";

function SkeletonMetaRow() {
	return (
		<div className={styles.skeletonMetaItem}>
			<span className={styles.skeletonMetaIcon} />
			<span className={styles.skeletonMetaLine} />
		</div>
	);
}

function SkeletonPanel({
	children,
	className,
}: {
	children: ReactNode;
	className: string;
}) {
	return (
		<section className={`${className} ${styles.skeletonPanel}`}>
			{children}
		</section>
	);
}

export function ProfileDetailSkeleton() {
	return (
		<section
			className={styles.shell}
			aria-busy="true"
			aria-label="Loading profile"
		>
			<div className={`${styles.canvas} ${styles.profileSkeleton}`}>
				<header className={`${styles.hero} ${styles.profileSkeletonHero}`}>
					<div
						className={`${styles.avatarFrame} ${styles.skeletonAvatar}`}
						aria-hidden="true"
					>
						<span className={styles.skeletonOnlineDot} />
					</div>

					<div className={styles.identity}>
						<div className={styles.identityHeader}>
							<span
								className={`${styles.skeletonBlock} ${styles.skeletonName}`}
							/>
							<span className={styles.skeletonVerifiedBadge} />
						</div>
						<div className={styles.profileSignals}>
							<span
								className={`${styles.skeletonPill} ${styles.skeletonRolePill}`}
							/>
							<span
								className={`${styles.skeletonPill} ${styles.skeletonPointsPill}`}
							/>
						</div>
						<p className={`${styles.skeletonBlock} ${styles.skeletonTagline}`} />
						<div className={styles.profileDetailsRow}>
							<div className={`${styles.metaList} ${styles.skeletonMetaList}`}>
								<SkeletonMetaRow />
								<SkeletonMetaRow />
								<SkeletonMetaRow />
								<SkeletonMetaRow />
							</div>
							<span className={styles.skeletonActionButton} />
						</div>
					</div>
				</header>

				<div className={styles.profileGrid}>
					<SkeletonPanel className={styles.aboutPanel}>
						<span
							className={`${styles.skeletonBlock} ${styles.skeletonPanelTitle}`}
						/>
						<div className={styles.skeletonCopyGroup}>
							<span />
							<span />
							<span />
						</div>
					</SkeletonPanel>

					<SkeletonPanel className={styles.skillsPanel}>
						<span
							className={`${styles.skeletonBlock} ${styles.skeletonPanelTitle}`}
						/>
						<div className={styles.skeletonSkillCloud}>
							<span />
							<span />
							<span />
							<span />
							<span />
						</div>
					</SkeletonPanel>
				</div>

				<div className={styles.activityGrid}>
					<SkeletonPanel className={styles.activityPanel}>
						<div className={styles.skeletonPanelHeader}>
							<span />
							<span />
						</div>
						<div className={styles.skeletonList}>
							<span />
							<span />
							<span />
						</div>
					</SkeletonPanel>

					<SkeletonPanel className={styles.reviewsPanel}>
						<div className={styles.skeletonPanelHeader}>
							<span />
							<span />
						</div>
						<div className={styles.skeletonReviewList}>
							<span />
							<span />
							<span />
							<span />
						</div>
					</SkeletonPanel>
				</div>
			</div>
		</section>
	);
}

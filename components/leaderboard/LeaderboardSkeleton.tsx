import styles from "../Leaderboard.module.css";

const loadingRows = Array.from({ length: 7 }, (_, index) => index);

function LeaderboardSkeletonRow() {
	return (
		<article className={styles.loadingRow}>
			<span className={styles.loadingRank} />
			<div className={styles.loadingContributor}>
				<span className={styles.loadingAvatar} />
				<div className={styles.loadingContributorCopy}>
					<span />
					<span />
				</div>
			</div>
			<span className={styles.loadingRoleCell} />
			<span className={styles.loadingPointsCell} />
			<span className={styles.loadingFeedbackCell} />
			<span className={styles.loadingActionCell} />
		</article>
	);
}

export function LeaderboardSkeleton() {
	return (
		<section
			className={styles.page}
			aria-busy="true"
			aria-label="Loading leaderboard"
		>
			<header className={styles.header}>
				<div className={styles.loadingTitleGroup}>
					<span className={styles.loadingTitle} />
					<span className={styles.loadingSubtitle} />
				</div>

				<div className={styles.toolbar}>
					<span className={styles.loadingRangeTrigger} />
				</div>
			</header>

			<section className={styles.loadingBoard} aria-hidden="true">
				<div className={styles.loadingSearchShell}>
					<span className={styles.loadingSearch} />
				</div>

				<div className={styles.loadingTableHeader}>
					<span />
					<span />
					<span className={styles.loadingHeaderRole} />
					<span />
					<span className={styles.loadingHeaderFeedback} />
					<span />
				</div>

				<div className={styles.loadingRows}>
					{loadingRows.map((row) => (
						<LeaderboardSkeletonRow key={row} />
					))}
				</div>

				<div className={styles.loadingDirectory}>
					<div className={styles.loadingDirectoryTitle}>
						<span />
						<span />
					</div>
					<div className={styles.loadingAvatarStack}>
						<span />
						<span />
						<span />
						<span />
					</div>
				</div>
			</section>
		</section>
	);
}

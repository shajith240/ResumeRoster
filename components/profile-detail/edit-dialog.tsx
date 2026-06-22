import {
	useEffect,
	useMemo,
	useState,
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
} from "react";
import { Camera, Plus, Search, Upload, X } from "@/components/ui/solar-icons";
import { Button } from "@/components/ui/button";
import {
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ONBOARDING_PROFILE_POSITION_OPTIONS } from "@/lib/onboarding-validation";
import {
	PROFILE_FIELD_LIMITS,
	SKILL_OPTIONS,
	limitText,
	normalizeUsername,
	parseSkills,
} from "@/lib/profile-validation";
import styles from "../ProfileDetail.module.css";
import { NO_POSITION_VALUE } from "./constants";
import { FieldHeader } from "./shared";
import type { UsernameAvailability } from "./types";
import { getUsernameAvailability } from "./utils";

export function ProfileEditDialog({
	about,
	avatarPreview,
	college,
	collegeLocation,
	currentPosition,
	displayName,
	fullName,
	handleAvatarChange,
	initials,
	onAboutChange,
	onCollegeChange,
	onCollegeLocationChange,
	onCurrentPositionChange,
	onFullNameChange,
	profileOwnerId,
	onSave,
	onSkillsChange,
	onTaglineChange,
	onUsernameChange,
	originalUsername,
	saveMessage,
	saving,
	skillsInput,
	tagline,
	username,
}: {
	about: string;
	avatarPreview: string;
	college: string;
	collegeLocation: string;
	currentPosition: string;
	displayName: string;
	fullName: string;
	handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
	initials: string;
	onAboutChange: (value: string) => void;
	onCollegeChange: (value: string) => void;
	onCollegeLocationChange: (value: string) => void;
	onCurrentPositionChange: (value: string) => void;
	onFullNameChange: (value: string) => void;
	profileOwnerId: string;
	onSave: (event: FormEvent<HTMLFormElement>) => void;
	onSkillsChange: (value: string) => void;
	onTaglineChange: (value: string) => void;
	onUsernameChange: (value: string) => void;
	originalUsername: string;
	saveMessage: string;
	saving: boolean;
	skillsInput: string;
	tagline: string;
	username: string;
}) {
	const [skillQuery, setSkillQuery] = useState("");
	const [usernameAvailability, setUsernameAvailability] =
		useState<UsernameAvailability>({
			status: "idle",
			message: "",
			suggestions: [],
		});
	const selectedSkills = useMemo(() => parseSkills(skillsInput), [skillsInput]);
	const normalizedUsername = normalizeUsername(username);
	const normalizedOriginalUsername = normalizeUsername(originalUsername);
	const usernameChanged =
		Boolean(normalizedUsername) && normalizedUsername !== normalizedOriginalUsername;
	const positionOptions = useMemo(() => {
		const normalizedCurrentPosition = currentPosition.trim();
		if (
			normalizedCurrentPosition &&
			!(ONBOARDING_PROFILE_POSITION_OPTIONS as readonly string[]).includes(
				normalizedCurrentPosition,
			)
		) {
			return [normalizedCurrentPosition, ...ONBOARDING_PROFILE_POSITION_OPTIONS];
		}

		return ONBOARDING_PROFILE_POSITION_OPTIONS;
	}, [currentPosition]);
	const normalizedSkillQuery = skillQuery.trim().replace(/\s+/g, " ");
	const selectedSkillKeys = useMemo(
		() => new Set(selectedSkills.map((skill) => skill.toLowerCase())),
		[selectedSkills],
	);
	const skillSuggestions = useMemo(() => {
		const query = normalizedSkillQuery.toLowerCase();

		return SKILL_OPTIONS.filter((skill) => {
			const key = skill.toLowerCase();
			return !selectedSkillKeys.has(key) && (!query || key.includes(query));
		}).slice(0, 8);
	}, [normalizedSkillQuery, selectedSkillKeys]);
	const canAddCustomSkill =
		selectedSkills.length < PROFILE_FIELD_LIMITS.skills &&
		normalizedSkillQuery.length >= 2 &&
		normalizedSkillQuery.length <= PROFILE_FIELD_LIMITS.skill &&
		!selectedSkillKeys.has(normalizedSkillQuery.toLowerCase()) &&
		!SKILL_OPTIONS.some(
			(skill) => skill.toLowerCase() === normalizedSkillQuery.toLowerCase(),
		);

	useEffect(() => {
		let active = true;
		const nextUsername = normalizedUsername;

		if (!nextUsername) {
			setUsernameAvailability({
				status: "idle",
				message: "Use letters, numbers, underscores, or hyphens.",
				suggestions: [],
			});
			return;
		}

		if (nextUsername.length < 3) {
			setUsernameAvailability({
				status: "idle",
				message: "Use at least 3 characters.",
				suggestions: [],
			});
			return;
		}

		if (!usernameChanged) {
			setUsernameAvailability({ status: "idle", message: "", suggestions: [] });
			return;
		}

		setUsernameAvailability({
			status: "checking",
			message: "Checking username...",
			suggestions: [],
		});

		const timeout = window.setTimeout(() => {
			void getUsernameAvailability(nextUsername, profileOwnerId)
				.then((availability) => {
					if (!active) return;
					setUsernameAvailability(
						availability.taken
							? {
									status: "taken",
									message: "That username is taken. Try another name.",
									suggestions: availability.suggestions,
								}
							: {
									status: "available",
									message: "Username is available.",
									suggestions: [],
								},
					);
				})
				.catch(() => {
					if (!active) return;
					setUsernameAvailability({
						status: "idle",
						message: "",
						suggestions: [],
					});
				});
		}, 300);

		return () => {
			active = false;
			window.clearTimeout(timeout);
		};
	}, [normalizedUsername, profileOwnerId, usernameChanged]);

	function commitSkills(nextSkills: string[]) {
		onSkillsChange(nextSkills.join(", "));
	}

	function addSkill(skill: string) {
		const cleanedSkill = skill.trim().replace(/\s+/g, " ");
		if (
			cleanedSkill.length < 2 ||
			cleanedSkill.length > PROFILE_FIELD_LIMITS.skill ||
			selectedSkillKeys.has(cleanedSkill.toLowerCase()) ||
			selectedSkills.length >= PROFILE_FIELD_LIMITS.skills
		) {
			return;
		}

		commitSkills([...selectedSkills, cleanedSkill]);
		setSkillQuery("");
	}

	function removeSkill(skill: string) {
		commitSkills(
			selectedSkills.filter(
				(selectedSkill) => selectedSkill.toLowerCase() !== skill.toLowerCase(),
			),
		);
	}

	function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
			addSkill(skillSuggestions[0] ?? normalizedSkillQuery);
			return;
		}

		if (event.key === "Backspace" && !skillQuery && selectedSkills.length) {
			commitSkills(selectedSkills.slice(0, -1));
		}
	}

	const usernameBlocksSave =
		usernameAvailability.status === "checking" ||
		usernameAvailability.status === "taken";
	const usernameAssistClass = [
		styles.usernameAssist,
		usernameAvailability.status === "taken" ? styles.usernameAssistError : "",
		usernameAvailability.status === "available" ? styles.usernameAssistSuccess : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<DialogContent className={styles.editDialog}>
			<DialogHeader className={styles.editHeader}>
				<DialogTitle className={styles.editTitle}>Edit profile</DialogTitle>
				<DialogDescription className={styles.editDescription}>
					Update the public details shown on your Linted profile.
				</DialogDescription>
			</DialogHeader>
			<form className={styles.editForm} onSubmit={onSave}>
				<div className={styles.editPreview}>
					<div className={styles.editAvatar}>
						{avatarPreview ? (
							<img src={avatarPreview} alt={`${displayName} profile photo`} />
						) : (
							initials
						)}
					</div>
					<div>
						<strong>{displayName}</strong>
						<span>JPG, PNG, WEBP, or GIF up to 5 MB.</span>
					</div>
					<label className={styles.avatarUploadButton}>
						<Camera aria-hidden="true" />
						Upload
						<input
							accept="image/jpeg,image/png,image/webp,image/gif"
							onChange={handleAvatarChange}
							type="file"
						/>
					</label>
				</div>

				<div className={styles.editFields}>
					<div className={styles.editColumn}>
						<div className={styles.editFieldGrid}>
							<div>
								<FieldHeader
									htmlFor="profile-full-name"
									max={PROFILE_FIELD_LIMITS.fullName}
									value={fullName}
								>
									Display name
								</FieldHeader>
								<Input
									id="profile-full-name"
									maxLength={PROFILE_FIELD_LIMITS.fullName}
									onChange={(event) =>
										onFullNameChange(
											limitText(event.target.value, PROFILE_FIELD_LIMITS.fullName),
										)
									}
									placeholder="Alex Morgan"
									value={fullName}
								/>
							</div>
							<div>
								<FieldHeader
									htmlFor="profile-username"
									max={PROFILE_FIELD_LIMITS.username}
									value={username}
								>
									Username
								</FieldHeader>
								<Input
									id="profile-username"
									maxLength={PROFILE_FIELD_LIMITS.username}
									onChange={(event) =>
										onUsernameChange(
											limitText(
												normalizeUsername(event.target.value),
												PROFILE_FIELD_LIMITS.username,
											),
										)
									}
									placeholder="alexmorgan"
									value={username}
								/>
								<div className={usernameAssistClass} aria-live="polite">
									{usernameAvailability.message ? (
										<span>{usernameAvailability.message}</span>
									) : null}
									{usernameAvailability.suggestions.length ? (
										<div className={styles.usernameSuggestions}>
											{usernameAvailability.suggestions.map((suggestion) => (
												<button
													key={suggestion}
													onClick={() => onUsernameChange(suggestion)}
													type="button"
												>
													@{suggestion}
												</button>
											))}
										</div>
									) : null}
								</div>
							</div>
						</div>

						<div>
							<FieldHeader
								htmlFor="profile-tagline"
								max={PROFILE_FIELD_LIMITS.tagline}
								value={tagline}
							>
								Tagline
							</FieldHeader>
							<Input
								id="profile-tagline"
								maxLength={PROFILE_FIELD_LIMITS.tagline}
								onChange={(event) =>
									onTaglineChange(
										limitText(event.target.value, PROFILE_FIELD_LIMITS.tagline),
									)
								}
								placeholder="Building better resumes, one lint pass at a time."
								value={tagline}
							/>
						</div>

						<div className={styles.editFieldGrid}>
							<div>
								<FieldHeader
									htmlFor="profile-current-position"
								>
									Profile role
								</FieldHeader>
								<Select
									onValueChange={(value) =>
										onCurrentPositionChange(
											value === NO_POSITION_VALUE
												? ""
												: limitText(value, PROFILE_FIELD_LIMITS.currentPosition),
										)
									}
									value={currentPosition || NO_POSITION_VALUE}
								>
									<SelectTrigger
										className={styles.highlightSelectTrigger}
										id="profile-current-position"
									>
										<SelectValue placeholder="Choose profile role" />
									</SelectTrigger>
									<SelectContent className={styles.highlightSelectContent}>
										<SelectGroup>
											<SelectItem
												className={styles.highlightSelectItem}
												value={NO_POSITION_VALUE}
											>
												Not set
											</SelectItem>
											{positionOptions.map((position) => (
												<SelectItem
													className={styles.highlightSelectItem}
													key={position}
													value={position}
												>
													{position}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div>
								<FieldHeader
									htmlFor="profile-college"
									max={PROFILE_FIELD_LIMITS.college}
									value={college}
								>
									College
								</FieldHeader>
								<Input
									id="profile-college"
									maxLength={PROFILE_FIELD_LIMITS.college}
									onChange={(event) =>
										onCollegeChange(
											limitText(event.target.value, PROFILE_FIELD_LIMITS.college),
										)
									}
									placeholder="State University"
									value={college}
								/>
							</div>
						</div>

						<div>
							<FieldHeader
								htmlFor="profile-college-location"
								max={PROFILE_FIELD_LIMITS.collegeLocation}
								value={collegeLocation}
							>
								College location
							</FieldHeader>
							<Input
								id="profile-college-location"
								maxLength={PROFILE_FIELD_LIMITS.collegeLocation}
								onChange={(event) =>
									onCollegeLocationChange(
										limitText(
											event.target.value,
											PROFILE_FIELD_LIMITS.collegeLocation,
										),
									)
								}
								placeholder="City, State"
								value={collegeLocation}
							/>
						</div>

					</div>

					<div className={styles.editColumn}>
						<div>
							<FieldHeader
								htmlFor="profile-about"
								max={PROFILE_FIELD_LIMITS.about}
								value={about}
							>
								About me
							</FieldHeader>
							<textarea
								className={`${styles.editTextarea} ${styles.aboutTextarea}`}
								id="profile-about"
								maxLength={PROFILE_FIELD_LIMITS.about}
								onChange={(event) =>
									onAboutChange(
										limitText(event.target.value, PROFILE_FIELD_LIMITS.about),
									)
								}
								placeholder="A short description about your goals, background, and review style."
								value={about}
							/>
						</div>

						<div>
							<div className={styles.skillEditorHeader}>
								<Label htmlFor="profile-skills">Skills</Label>
								<span>
									{selectedSkills.length}/{PROFILE_FIELD_LIMITS.skills}
								</span>
							</div>
							<div className={styles.skillEditor}>
								<div className={styles.selectedSkillList}>
									{selectedSkills.length ? (
										selectedSkills.map((skill) => (
											<button
												aria-label={`Remove ${skill}`}
												key={skill}
												onClick={() => removeSkill(skill)}
												type="button"
											>
												{skill}
												<X aria-hidden="true" />
											</button>
										))
									) : (
										<span>Add skills that describe your review style.</span>
									)}
								</div>
								<div className={styles.skillSearch}>
									<Search aria-hidden="true" />
									<Input
										id="profile-skills"
										maxLength={PROFILE_FIELD_LIMITS.skill}
										onChange={(event) => setSkillQuery(event.target.value)}
										onKeyDown={handleSkillKeyDown}
										placeholder="Search or add a skill"
										value={skillQuery}
									/>
								</div>
								<div className={styles.skillSuggestions}>
									{canAddCustomSkill ? (
										<button
											onClick={() => addSkill(normalizedSkillQuery)}
											type="button"
										>
											<Plus aria-hidden="true" />
											Add "{normalizedSkillQuery}"
										</button>
									) : null}
									{skillSuggestions.map((skill) => (
										<button
											disabled={selectedSkills.length >= PROFILE_FIELD_LIMITS.skills}
											key={skill}
											onClick={() => addSkill(skill)}
											type="button"
										>
											<Plus aria-hidden="true" />
											{skill}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{saveMessage && saveMessage !== "Saved" ? (
						<p className="form-message">{saveMessage}</p>
					) : null}
				</div>

				<DialogFooter className={styles.editFooter}>
					<DialogClose asChild>
						<Button className={styles.footerButton} type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button
						className={styles.footerButton}
						disabled={saving || usernameBlocksSave}
					>
						<Upload size={16} aria-hidden="true" />
						{saving ? "Saving..." : "Save profile"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

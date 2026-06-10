"use client";

import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type DragEvent,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	CircleAlert,
	FileText,
	Image,
	Pause,
	Play,
	Trash,
	Upload,
} from "@/components/ui/solar-icons";

import { Button } from "@/components/ui/button";
import { cn, generateUniqueId } from "@/lib/utils";

export enum FileStatus {
	Uploading,
	Paused,
	Completed,
	Error,
	Cancelled,
	Pending,
}

export interface FileInfo {
	id: string;
	name: string;
	size: number;
	type: string;
	file: File;
	progress: number;
	status: FileStatus;
	error?: string;
}

interface FileUploadContextType {
	files: FileInfo[];
	error: string | null;
	setError: (error: string | null) => void;
	maxCount?: number;
	maxSize?: number;
	accept?: string;
	multiple?: boolean;
	validateFiles: (files: File[]) => { valid: boolean; errorMessage?: string };
	onFileSelect?: (files: File[]) => void;
	onFileSelectChange?: (files: FileInfo[]) => void;
	onUpload?: () => void;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	disabled?: boolean;
}

const FileUploadContext = createContext<FileUploadContextType | undefined>(
	undefined,
);

export const useFileUpload = () => {
	const context = useContext(FileUploadContext);
	if (!context) {
		throw new Error("useFileUpload must be used within a FileUploadProvider");
	}
	return context;
};

export interface FileErrorProps {
	message?: string;
	onClose?: () => void;
	className?: string;
}

export function FileError({ message, onClose, className }: FileErrorProps) {
	const { error } = useFileUpload();
	const [isVisible, setIsVisible] = useState(true);
	const displayMessage = message || error;

	useEffect(() => {
		if (displayMessage) setIsVisible(true);
	}, [displayMessage]);

	if (!displayMessage) return null;

	return (
		<AnimatePresence>
			{isVisible ? (
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className={cn(
						"flex items-center justify-between gap-3 rounded-[var(--button-radius)] border border-destructive/20 bg-destructive/10 p-3 text-destructive",
						className,
					)}
					exit={{ opacity: 0, y: -8 }}
					initial={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.2 }}
				>
					<div className="flex min-w-0 items-center gap-2">
						<CircleAlert className="size-4 shrink-0" aria-hidden="true" />
						<p className="text-sm">{displayMessage}</p>
					</div>
					<Button
						aria-label="Dismiss file error"
						className="size-7 rounded-[var(--button-radius-sm)] hover:bg-destructive/15"
						onClick={() => {
							setIsVisible(false);
							onClose?.();
						}}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X className="size-4" aria-hidden="true" />
					</Button>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}

export const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export function FileTypeIcon({ type }: { type: string }) {
	return type.includes("image") ? (
		<Image className="size-5" aria-hidden="true" />
	) : (
		<FileText className="size-5" aria-hidden="true" />
	);
}

export interface FileProgressProps {
	progress?: number;
	status?: FileInfo["status"];
	fileId?: string;
	className?: string;
}

export function FileProgress({
	progress,
	status,
	fileId,
	className,
}: FileProgressProps) {
	const { files } = useFileUpload();
	const file = fileId ? files.find((item) => item.id === fileId) : null;
	const fileStatus = file?.status ?? status;
	const fileProgress = file?.progress ?? progress;

	if (
		fileStatus == null ||
		fileProgress == null ||
		fileStatus === FileStatus.Completed
	) {
		return null;
	}

	return (
		<div
			className={cn(
				"mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted",
				className,
			)}
		>
			<div
				className={cn(
					"h-full rounded-full",
					fileStatus === FileStatus.Error
						? "bg-destructive"
						: fileStatus === FileStatus.Paused
							? "bg-amber-500"
							: "bg-primary",
				)}
				style={{ width: `${fileProgress}%` }}
			/>
		</div>
	);
}

export interface FileItemProps {
	file?: FileInfo;
	fileId?: string;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	className?: string;
	canResume?: boolean;
	canRemove?: boolean;
	showProgress?: boolean;
}

export function FileItem({
	file: propFile,
	fileId,
	onPause = () => {},
	onResume = () => {},
	onRemove = () => {},
	className,
	canResume = false,
	canRemove = true,
	showProgress = false,
}: FileItemProps) {
	const { files } = useFileUpload();
	const file = propFile ?? (fileId ? files.find((item) => item.id === fileId) : null);

	if (!file) return null;

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-[var(--text-primary)] shadow-sm",
				className,
			)}
		>
			<div className="grid size-9 shrink-0 place-items-center rounded-[var(--button-radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--brand)]">
				<FileTypeIcon type={file.type} />
			</div>

			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium" title={file.name}>
					{file.name}
				</p>
				<p className="text-xs text-[var(--text-secondary)]">
					{formatFileSize(file.size)}
					{file.status === FileStatus.Error ? (
						<span className="ml-2 text-destructive">
							{file.error || "File failed to upload"}
						</span>
					) : null}
				</p>
				{showProgress ? (
					<FileProgress progress={file.progress} status={file.status} />
				) : null}
			</div>

			{canResume ? (
				<div className="flex shrink-0 items-center gap-1">
					{file.status === FileStatus.Uploading ? (
						<Button
							aria-label={`Pause ${file.name}`}
							onClick={() => onPause(file.id)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Pause className="size-4" aria-hidden="true" />
						</Button>
					) : null}
					{file.status === FileStatus.Paused ? (
						<Button
							aria-label={`Resume ${file.name}`}
							onClick={() => onResume(file.id)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Play className="size-4" aria-hidden="true" />
						</Button>
					) : null}
				</div>
			) : null}

			{canRemove ? (
				<Button
					aria-label={`Remove ${file.name}`}
					className="text-destructive hover:text-destructive"
					onClick={() => onRemove(file.id)}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Trash className="size-4" aria-hidden="true" />
				</Button>
			) : null}
		</div>
	);
}

export interface FileListProps {
	files?: FileInfo[];
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	onClear?: () => void;
	showHeader?: boolean;
	showUploadButton?: boolean;
	onUpload?: () => void;
	className?: string;
	canResume?: boolean;
	canRemove?: boolean;
}

export function FileList({
	files: propFiles,
	onPause,
	onResume,
	onRemove,
	onClear = () => {},
	showHeader = true,
	showUploadButton = false,
	className,
	canResume,
	canRemove,
}: FileListProps) {
	const { files: contextFiles, onUpload = () => {} } = useFileUpload();
	const files = propFiles || contextFiles;

	if (files.length === 0) return null;

	return (
		<div className={cn("space-y-3", className)}>
			{showHeader ? (
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-sm font-medium text-[var(--text-primary)]">
						Selected files
					</h3>
					<div className="flex gap-2">
						{showUploadButton &&
						files.some((file) => file.status === FileStatus.Pending) ? (
							<Button size="sm" onClick={onUpload} type="button">
								Start upload
							</Button>
						) : null}
						<Button size="sm" variant="outline" onClick={onClear} type="button">
							Clear
						</Button>
					</div>
				</div>
			) : null}

			<div className="grid max-h-[300px] gap-2 overflow-y-auto">
				{files.map((file) => (
					<FileItem
						canRemove={canRemove}
						canResume={canResume}
						file={file}
						key={file.id}
						onPause={onPause}
						onRemove={onRemove}
						onResume={onResume}
					/>
				))}
			</div>
		</div>
	);
}

export interface DropZoneProps {
	onFileSelect?: (files: File[]) => void;
	prompt?: string;
	browseText?: string;
	maxSize?: number;
	maxCount?: number;
	multiple?: boolean;
	accept?: string;
	className?: string;
	onError?: (message: string) => void;
	children?: ReactNode;
}

function getFileInfos(files: File[]) {
	return files.map((file) => ({
		id: generateUniqueId(file.name),
		name: file.name,
		size: file.size,
		type: file.type,
		progress: 0,
		file,
		status: FileStatus.Pending,
	}));
}

export function DropZone({
	onFileSelect: propOnFileSelect,
	prompt = "Drop your file here",
	browseText = "or click to browse",
	maxSize: propMaxSize,
	multiple: propMultiple,
	accept: propAccept,
	className,
	onError: propOnError,
	children,
}: DropZoneProps) {
	const {
		disabled,
		files: contextFiles,
		maxSize: contextMaxSize,
		multiple: contextMultiple,
		accept: contextAccept,
		setError: contextSetError,
		onFileSelect: contextOnFileSelect,
		onFileSelectChange: contextOnFileSelectChange,
		validateFiles: contextValidateFiles,
	} = useFileUpload();
	const maxSize = propMaxSize || contextMaxSize;
	const multiple = propMultiple !== undefined ? propMultiple : contextMultiple;
	const accept = propAccept || contextAccept;
	const onFileSelect = propOnFileSelect || contextOnFileSelect;
	const onError = propOnError || contextSetError;

	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (fileInputRef.current && contextFiles.length === 0) {
			fileInputRef.current.value = "";
		}
	}, [contextFiles]);

	function selectFiles(files: File[]) {
		const validation = contextValidateFiles(files);

		if (!validation.valid) {
			if (validation.errorMessage) onError?.(validation.errorMessage);
			return;
		}

		contextSetError(null);
		onFileSelect?.(files);
		contextOnFileSelectChange?.(getFileInfos(files));
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		event.stopPropagation();
		setIsDragging(false);
		if (disabled) return;

		if (event.dataTransfer.files?.length) {
			selectFiles(Array.from(event.dataTransfer.files));
		}
	}

	function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
		if (event.target.files?.length) {
			selectFiles(Array.from(event.target.files));
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		if (!disabled) fileInputRef.current?.click();
	}

	return (
		<div
			aria-disabled={disabled}
			className={cn(
				"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--button-radius)] border-2 border-dashed p-6 text-center transition-colors",
				isDragging
					? "border-[var(--brand)] bg-[var(--brand-muted)]"
					: "border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--brand)]",
				disabled && "cursor-not-allowed opacity-60",
				className,
			)}
			onClick={() => {
				if (!disabled) fileInputRef.current?.click();
			}}
			onDragEnter={(event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!disabled) setIsDragging(true);
			}}
			onDragLeave={(event) => {
				event.preventDefault();
				event.stopPropagation();
				setIsDragging(false);
			}}
			onDragOver={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onDrop={handleDrop}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={disabled ? -1 : 0}
		>
			{children || (
				<>
					<span className="grid size-10 place-items-center rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--brand)]">
						<Upload className="size-5" aria-hidden="true" />
					</span>
					<strong className="text-sm font-semibold text-[var(--text-primary)]">
						{prompt}
					</strong>
					<span className="text-sm font-medium text-[var(--brand)] underline underline-offset-4">
						{browseText}
					</span>
					{maxSize ? (
						<span className="text-xs text-[var(--text-tertiary)]">
							Max {maxSize}MB - PDF only
						</span>
					) : null}
				</>
			)}
			<input
				accept={accept}
				className="hidden"
				disabled={disabled}
				multiple={multiple}
				onChange={handleFileInputChange}
				ref={fileInputRef}
				type="file"
			/>
		</div>
	);
}

export interface FileUploadProviderProps {
	children: ReactNode;
	files?: FileInfo[];
	multiple?: boolean;
	accept?: string;
	maxCount?: number;
	maxSize?: number;
	onFileSelect?: (files: File[]) => void;
	onFileSelectChange?: (files: FileInfo[]) => void;
	onUpload?: () => void;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	disabled?: boolean;
}

export function FileUploadProvider({
	children,
	files = [],
	multiple = false,
	accept,
	maxCount = 1,
	maxSize = 1,
	onFileSelect,
	onFileSelectChange,
	onUpload,
	onPause,
	onResume,
	onRemove,
	disabled = false,
}: FileUploadProviderProps) {
	const [error, setError] = useState<string | null>(null);

	function validateFiles(filesToValidate: File[]) {
		if (maxCount && filesToValidate.length > maxCount) {
			return {
				valid: false,
				errorMessage: `You can upload up to ${maxCount} file${
					maxCount === 1 ? "" : "s"
				}.`,
			};
		}

		if (maxSize) {
			const oversizedFiles = filesToValidate.filter(
				(file) => file.size > maxSize * 1024 * 1024,
			);
			if (oversizedFiles.length > 0) {
				return {
					valid: false,
					errorMessage: `Keep files under ${maxSize}MB: ${oversizedFiles
						.map((file) => file.name)
						.join(", ")}`,
				};
			}
		}

		if (accept) {
			const acceptedTypes = accept.split(",").map((type) => type.trim());
			const invalidFiles = filesToValidate.filter((file) => {
				const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
				return !acceptedTypes.some(
					(type) =>
						type === fileExt ||
						type === file.type ||
						(type.endsWith("/*") &&
							file.type.startsWith(type.replace("/*", "/"))),
				);
			});

			if (invalidFiles.length > 0) {
				return {
					valid: false,
					errorMessage: `Unsupported file type: ${invalidFiles
						.map((file) => file.name)
						.join(", ")}`,
				};
			}
		}

		return { valid: true };
	}

	return (
		<FileUploadContext.Provider
			value={{
				files,
				error,
				setError,
				maxCount,
				maxSize,
				accept,
				multiple,
				validateFiles,
				onFileSelect,
				onFileSelectChange,
				onUpload,
				onPause,
				onResume,
				onRemove,
				disabled,
			}}
		>
			{children}
		</FileUploadContext.Provider>
	);
}

export interface FileUploadProps extends FileUploadProviderProps {
	className?: string;
}

export default function FileUpload({
	className,
	children,
	disabled,
	...providerProps
}: FileUploadProps) {
	return (
		<FileUploadProvider {...providerProps} disabled={disabled}>
			<div
				className={cn(
					"flex flex-1 flex-col space-y-4",
					className,
					disabled && "cursor-not-allowed opacity-50",
				)}
			>
				{children}
			</div>
		</FileUploadProvider>
	);
}

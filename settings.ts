export interface LineCleanerSettings {
	removalStrings: string[];
	rangeStartStrings: string[];
	rangeEndStrings: string[];
	cleanLinksStrings: string[];
	commentCleanerStrings: string[];
	createBackup: boolean;
	backupFileNameFormat: string;
	maxConsecutiveEmptyLines: number;
	removeEmptyListItems: boolean;
	removeFinishedTasks: boolean;
	// Feature toggles
	enableRangeRemoval: boolean;
	enableCommentCleaning: boolean;
	enableLinkCleaning: boolean;
	enableSingleLineRemoval: boolean;
	enableEmptyLineLimiting: boolean;
}

export const DEFAULT_SETTINGS: LineCleanerSettings = {
	removalStrings: ["%% remove line %%", "rem-ln"],
	rangeStartStrings: ["%% remove from here %%", "rm-from-here"],
	rangeEndStrings: ["%% remove till here %%", "rm-till-here"],
	cleanLinksStrings: ["%% clean me %%", "clean-ln"],
	commentCleanerStrings: ["remove this comment", "rm-cmt"],
	createBackup: true,
	backupFileNameFormat: "_YYYY-MM-DD HHmmss",
	maxConsecutiveEmptyLines: 1,
	removeEmptyListItems: false,
	removeFinishedTasks: false,
	// Feature toggles - all enabled by default
	enableRangeRemoval: true,
	enableCommentCleaning: true,
	enableLinkCleaning: true,
	enableSingleLineRemoval: true,
	enableEmptyLineLimiting: true
};

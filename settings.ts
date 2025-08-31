export interface LineCleanerSettings {
	removalString: string;
	rangeStartString: string;
	rangeEndString: string;
	cleanLinksString: string;
	commentCleanerString: string;
	createBackup: boolean;
	backupFileNameFormat: string;
	maxConsecutiveEmptyLines: number;
	removeEmptyListItems: boolean;
	// Feature toggles
	enableRangeRemoval: boolean;
	enableCommentCleaning: boolean;
	enableLinkCleaning: boolean;
	enableSingleLineRemoval: boolean;
	enableEmptyLineLimiting: boolean;
}

export const DEFAULT_SETTINGS: LineCleanerSettings = {
	removalString: "%% remove line %%",
	rangeStartString: "%% remove from here %%",
	rangeEndString: "%% remove till here %%",
	cleanLinksString: "%% clean me %%",
	commentCleanerString: "remove this comment",
	createBackup: true,
	backupFileNameFormat: "_YYYY-MM-DD HHmmss",
	maxConsecutiveEmptyLines: 1,
	removeEmptyListItems: false,
	// Feature toggles - all enabled by default
	enableRangeRemoval: true,
	enableCommentCleaning: true,
	enableLinkCleaning: true,
	enableSingleLineRemoval: true,
	enableEmptyLineLimiting: true
};

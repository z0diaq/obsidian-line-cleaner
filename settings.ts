export interface LineCleanerSettings {
	removalString: string;
	rangeStartString: string;
	rangeEndString: string;
	cleanLinksString: string;
	commentCleanerString: string;
	createBackup: boolean;
	backupFileNameFormat: string;
	maxConsecutiveEmptyLines: number;
}

export const DEFAULT_SETTINGS: LineCleanerSettings = {
	removalString: "%% remove line %%",
	rangeStartString: "%% remove from here %%",
	rangeEndString: "%% remove till here %%",
	cleanLinksString: "%% clean me %%",
	commentCleanerString: "remove this comment",
	createBackup: true,
	backupFileNameFormat: "_YYYY-MM-DD HHmmss",
	maxConsecutiveEmptyLines: 1
};

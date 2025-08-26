export interface LineCleanerSettings {
	removalString: string;
	rangeStartString: string;
	rangeEndString: string;
	cleanLinksString: string;
	createBackup: boolean;
	backupFileNameFormat: string;
}

export const DEFAULT_SETTINGS: LineCleanerSettings = {
	removalString: "%% remove me %%",
	rangeStartString: "%% remove from here %%",
	rangeEndString: "%% remove till here %%",
	cleanLinksString: "%% clean me %%",
	createBackup: true,
	backupFileNameFormat: "_YYYY-MM-DD HHmmss"
};

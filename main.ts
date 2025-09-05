import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, Menu, moment } from 'obsidian';
import { LineCleanerSettings, DEFAULT_SETTINGS } from './settings';

export default class LineCleanerPlugin extends Plugin {
	settings: LineCleanerSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('trash-2', 'Clean Lines', (evt: MouseEvent) => {
			this.cleanCurrentFile();
		});
		ribbonIconEl.addClass('line-cleaner-ribbon-class');

		// Add command
		this.addCommand({
			id: 'clean-lines',
			name: 'Clean lines, ranges, and links from current file',
			callback: () => {
				this.cleanCurrentFile();
			}
		});

		// Add context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
				// Only show context menu for files, not directories
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Clean lines')
							.setIcon('eraser')
							.onClick(async () => {
								await this.cleanFile(file);
							});
					});
				}
			})
		);

		// Add editor context menu
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const hasSelection = editor.somethingSelected();
				const menuTitle = hasSelection ? 'Clean lines in selection' : 'Clean lines in whole file';
				
				menu.addItem((item) => {
					item
						.setTitle(menuTitle)
						.setIcon('eraser')
						.onClick(async () => {
							if (hasSelection) {
								await this.cleanSelection(editor);
							} else {
								await this.cleanCurrentFile();
							}
						});
				});
			})
		);

		// Add settings tab
		this.addSettingTab(new LineCleanerSettingTab(this.app, this));
	}

	onunload() {
        // Event listeners are automatically cleaned up by registerEvent()
        // Ribbon icons are automatically cleaned up by addRibbonIcon()
        // Commands are automatically cleaned up by addCommand()
        // Settings tabs are automatically cleaned up by addSettingTab()
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		
		// Migration configuration: old property -> new property
		const migrations = [
			{ oldKey: 'removalString', newKey: 'removalStrings' },
			{ oldKey: 'rangeStartString', newKey: 'rangeStartStrings' },
			{ oldKey: 'rangeEndString', newKey: 'rangeEndStrings' },
			{ oldKey: 'cleanLinksString', newKey: 'cleanLinksStrings' },
			{ oldKey: 'commentCleanerString', newKey: 'commentCleanerStrings' }
		];

		// Apply migrations
		let needsSave = false;
		for (const { oldKey, newKey } of migrations) {
			if (loadedData && oldKey in loadedData && !(newKey in loadedData)) {
				(this.settings as any)[newKey] = [loadedData[oldKey] as string];
				needsSave = true;
			}
		}

		// Save settings once if any migrations were applied
		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async cleanCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file to clean');
            return;
        }
        
        if (activeFile.extension !== 'md') {
            new Notice('Lines Cleaner only works with Markdown files');
            return;
        }
        
        await this.cleanFile(activeFile);
	}

	processContent(content: string): { content: string, removals: number } {
		let processedContent = content;
		let totalRemovals = 0;

		// Apply the complete processing pipeline based on enabled features
		if (this.settings.enableRangeRemoval) {
			const rangeResult = this.processRangeRemovals(processedContent);
			processedContent = rangeResult.content;
			totalRemovals += rangeResult.removals;
		}

		if (this.settings.enableCommentCleaning) {
			const commentResult = this.processCommentCleaning(processedContent);
			processedContent = commentResult.content;
			totalRemovals += commentResult.removals;
		}

		if (this.settings.enableLinkCleaning) {
			const linkResult = this.processLinkCleaning(processedContent);
			processedContent = linkResult.content;
			totalRemovals += linkResult.removals;
		}

		if (this.settings.enableSingleLineRemoval) {
			const singleResult = this.processSingleLineRemovals(processedContent);
			processedContent = singleResult.content;
			totalRemovals += singleResult.removals;
		}

		if (this.settings.removeEmptyListItems) {
			const emptyListResult = this.processEmptyListItemRemoval(processedContent);
			processedContent = emptyListResult.content;
			totalRemovals += emptyListResult.removals;
		}

		if (this.settings.removeFinishedTasks) {
			const finishedTasksResult = this.processFinishedTasksRemoval(processedContent);
			processedContent = finishedTasksResult.content;
			totalRemovals += finishedTasksResult.removals;
		}

		if (this.settings.enableEmptyLineLimiting) {
			const emptyLineResult = this.processEmptyLineLimiting(processedContent);
			processedContent = emptyLineResult.content;
			totalRemovals += emptyLineResult.removals;
		}

		return { content: processedContent, removals: totalRemovals };
	}

	async cleanSelection(editor: Editor) {
		try {
			const selection = editor.getSelection();
			if (!selection) {
				new Notice('No text selected');
				return;
			}

			const result = this.processContent(selection);

			// Check if any changes were made
			if (result.content === selection) {
				new Notice('No lines found containing removal markers in selection');
				return;
			}

			// Replace the selection with the processed content
			editor.replaceSelection(result.content);

			new Notice(`Processed ${result.removals} removal operation(s) in selection`);
		} catch (error) {
			console.error('Error cleaning selection:', error);
			new Notice('Error cleaning selection: ' + error.message);
		}
	}

	async cleanFile(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const result = this.processContent(content);

			// Check if any changes were made
			if (result.content === content) {
				new Notice('No lines found containing removal markers');
				return;
			}

			// Create backup if enabled
			if (this.settings.createBackup) {
				await this.createBackup(file, content);
			}

			// Write cleaned content back to file
			await this.app.vault.modify(file, result.content);

			new Notice(`Processed ${result.removals} removal operation(s) in ${file.name}`);
		} catch (error) {
			console.error('Error cleaning file:', error);
			new Notice('Error cleaning file: ' + error.message);
		}
	}

	processRangeRemovals(content: string): { content: string, removals: number } {
		let processedContent = content;
		let removals = 0;

		// Continue processing until no more ranges are found
		while (true) {
			let foundRange = false;
			let earliestStartIndex = -1;
			let matchedStartMarker = '';
			let matchedEndMarker = '';

			// Find the earliest start marker among all possible start markers
			for (const startMarker of this.settings.rangeStartStrings) {
				if (!startMarker.trim()) continue; // Skip empty markers
				
				const startIndex = processedContent.indexOf(startMarker);
				if (startIndex !== -1 && (earliestStartIndex === -1 || startIndex < earliestStartIndex)) {
					earliestStartIndex = startIndex;
					matchedStartMarker = startMarker;
					foundRange = true;
				}
			}

			if (!foundRange) break;

			// Find the earliest end marker after the start marker
			let earliestEndIndex = -1;
			for (const endMarker of this.settings.rangeEndStrings) {
				if (!endMarker.trim()) continue; // Skip empty markers
				
				const endIndex = processedContent.indexOf(endMarker, earliestStartIndex + matchedStartMarker.length);
				if (endIndex !== -1 && (earliestEndIndex === -1 || endIndex < earliestEndIndex)) {
					earliestEndIndex = endIndex;
					matchedEndMarker = endMarker;
				}
			}

			if (earliestEndIndex === -1) {
				// Start marker found but no end marker - remove from start marker to end of content
				const beforeStart = processedContent.substring(0, earliestStartIndex);
				processedContent = beforeStart;
				removals++;
				break;
			}

			// Extract content before start marker and after end marker
			const beforeStart = processedContent.substring(0, earliestStartIndex);
			const afterEnd = processedContent.substring(earliestEndIndex + matchedEndMarker.length);
			
			// Combine the preserved parts
			processedContent = beforeStart + afterEnd;
			removals++;
		}

		return { content: processedContent, removals };
	}

	processSingleLineRemovals(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		let cleanedLines = [...lines];
		let totalRemovals = 0;
		
		// Process each removal string
		for (const removalString of this.settings.removalStrings) {
			if (!removalString.trim()) continue; // Skip empty strings
			
			// Count lines to be removed for this marker
			const linesToRemove = cleanedLines.filter(line => line.includes(removalString)).length;
			totalRemovals += linesToRemove;
			
			// Remove lines containing this removal string
			cleanedLines = cleanedLines.filter(line => !line.includes(removalString));
		}
		
		const cleanedContent = cleanedLines.join('\n');
		return { content: cleanedContent, removals: totalRemovals };
	}

	processCommentCleaning(content: string): { content: string, removals: number } {
		let processedContent = content;
		let removals = 0;
		let searchStart = 0;

		// Process content to find and remove comments containing any of the markers
		while (searchStart < processedContent.length) {
			const startIndex = processedContent.indexOf('%%', searchStart);
			if (startIndex === -1) break;

			const endIndex = processedContent.indexOf('%%', startIndex + 2);
			if (endIndex === -1) break; // No matching closing %%

			// Extract the comment content (between the %% markers)
			const commentContent = processedContent.substring(startIndex + 2, endIndex);
			
			// Check if this comment contains any of the clean markers
			let shouldRemoveComment = false;
			for (const cleanMarker of this.settings.commentCleanerStrings) {
				if (!cleanMarker.trim()) continue; // Skip empty markers
				if (commentContent.includes(cleanMarker)) {
					shouldRemoveComment = true;
					break;
				}
			}
			
			if (shouldRemoveComment) {
				// Remove this entire comment (including the %% markers)
				const beforeComment = processedContent.substring(0, startIndex);
				const afterComment = processedContent.substring(endIndex + 2);
				processedContent = beforeComment + afterComment;
				removals++;
				// Continue searching from the same position since content shifted
				searchStart = startIndex;
			} else {
				// Skip this comment and continue searching after it
				searchStart = endIndex + 2;
			}
		}

		return { content: processedContent, removals };
	}

	processLinkCleaning(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		let processedLines: string[] = [];
		let removals = 0;

		for (const line of lines) {
			let shouldCleanLine = false;
			
			// Check if line contains any of the clean link markers
			for (const cleanMarker of this.settings.cleanLinksStrings) {
				if (!cleanMarker.trim()) continue; // Skip empty markers
				if (line.includes(cleanMarker)) {
					shouldCleanLine = true;
					break;
				}
			}

			if (shouldCleanLine) {
				const cleanedLine = this.convertLinksInLine(line);
				processedLines.push(cleanedLine);
				if (cleanedLine !== line) {
					removals++;
				}
			} else {
				processedLines.push(line);
			}
		}

		return { content: processedLines.join('\n'), removals };
	}

	convertLinksInLine(line: string): string {
		let processedLine = line;

		// Convert internal links [[link]] or [[link|display text]]
		processedLine = processedLine.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, displayText) => {
			const linkName = displayText || link;
			return `\`${linkName}\``;
		});

		// Convert external links [text](url)
		processedLine = processedLine.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, linkText) => {
			return `\`${linkText}\``;
		});

		// Remove all clean link markers after processing links
		for (const cleanMarker of this.settings.cleanLinksStrings) {
			if (!cleanMarker.trim()) continue; // Skip empty markers
			processedLine = processedLine.replace(new RegExp(this.escapeRegExp(cleanMarker), 'g'), '');
		}

		return processedLine;
	}

	escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	processEmptyLineLimiting(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		const maxConsecutive = this.settings.maxConsecutiveEmptyLines;
		const processedLines: string[] = [];
		let consecutiveEmptyCount = 0;
		let removals = 0;

		for (const line of lines) {
			const isEmptyLine = line.trim() === '';
			
			if (isEmptyLine) {
				consecutiveEmptyCount++;
				if (consecutiveEmptyCount <= maxConsecutive) {
					processedLines.push(line);
				} else {
					removals++;
				}
			} else {
				consecutiveEmptyCount = 0;
				processedLines.push(line);
			}
		}

		return { content: processedLines.join('\n'), removals };
	}

	processEmptyListItemRemoval(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		const processedLines: string[] = [];
		let removals = 0;

		for (const line of lines) {
			const trimmedLine = line.trim();
			
			// Check if line contains only empty list item patterns
			const isEmptyListItem = /^-\s*(\[.*\])?$/.test(trimmedLine);
			
			if (isEmptyListItem) {
				removals++;
			} else {
				processedLines.push(line);
			}
		}

		return { content: processedLines.join('\n'), removals };
	}

	processFinishedTasksRemoval(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		const processedLines: string[] = [];
		let removals = 0;

		for (const line of lines) {
			const trimmedLine = line.trim();
			
			// Check if line contains a finished task (- [x] or - [X])
			const isFinishedTask = /^-\s*\[x\]/i.test(trimmedLine);
			
			if (isFinishedTask) {
				removals++;
			} else {
				processedLines.push(line);
			}
		}

		return { content: processedLines.join('\n'), removals };
	}

	async createBackup(file: TFile, content: string) {
		try {
			const processedFormat = moment().format(this.settings.backupFileNameFormat);
			
			const fileExtension = file.extension;
			const baseName = file.basename;
			const backupName = `${baseName}${processedFormat}.${fileExtension}`;
			const backupPath = file.parent ? `${file.parent.path}/${backupName}` : backupName;

			await this.app.vault.create(backupPath, content);
			new Notice(`Backup created: ${backupName}`);
		} catch (error) {
			console.error('Error creating backup:', error);
			new Notice('Warning: Could not create backup - ' + error.message);
		}
	}
}

class LineCleanerSettingTab extends PluginSettingTab {
	plugin: LineCleanerPlugin;
	private activeTab: 'settings' | 'usage' = 'settings';

	constructor(app: App, plugin: LineCleanerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Create header
		containerEl.createEl('h2', { text: 'Lines Cleaner' });

		// Create tab navigation
		const tabContainer = containerEl.createDiv({ cls: 'line-cleaner-tabs' });
		
		const settingsTab = tabContainer.createEl('button', {
			text: 'Settings',
			cls: this.activeTab === 'settings' ? 'line-cleaner-tab active' : 'line-cleaner-tab'
		});
		
		const usageTab = tabContainer.createEl('button', {
			text: 'Usage',
			cls: this.activeTab === 'usage' ? 'line-cleaner-tab active' : 'line-cleaner-tab'
		});

		// Tab click handlers
		settingsTab.addEventListener('click', () => {
			this.activeTab = 'settings';
			this.display();
		});

		usageTab.addEventListener('click', () => {
			this.activeTab = 'usage';
			this.display();
		});

		// Create content container
		const contentEl = containerEl.createDiv({ cls: 'line-cleaner-tab-content' });

		// Display appropriate tab content
		if (this.activeTab === 'settings') {
			this.displaySettingsTab(contentEl);
		} else {
			this.displayUsageTab(contentEl);
		}
	}

	private displaySettingsTab(containerEl: HTMLElement): void {
		// Feature Selection Section
		containerEl.createEl('h3', { text: 'Feature Selection' });
		containerEl.createEl('p', { text: 'Which features do you need?' });

		new Setting(containerEl)
			.setName('Enable Range Removal')
			.setDesc('Remove content between start and end markers')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableRangeRemoval)
				.onChange(async (value) => {
					this.plugin.settings.enableRangeRemoval = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Comment Cleaning')
			.setDesc('Remove specific %% comments %% containing markers')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCommentCleaning)
				.onChange(async (value) => {
					this.plugin.settings.enableCommentCleaning = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Link Cleaning')
			.setDesc('Convert links to plain text in backticks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableLinkCleaning)
				.onChange(async (value) => {
					this.plugin.settings.enableLinkCleaning = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Single Line Removal')
			.setDesc('Remove entire lines containing markers')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableSingleLineRemoval)
				.onChange(async (value) => {
					this.plugin.settings.enableSingleLineRemoval = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Empty Line Limiting')
			.setDesc('Control consecutive empty lines between content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableEmptyLineLimiting)
				.onChange(async (value) => {
					this.plugin.settings.enableEmptyLineLimiting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Remove empty list items')
			.setDesc('Remove lines containing only empty list items like "- ", "- [ ]", "- [x]", etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeEmptyListItems)
				.onChange(async (value) => {
					this.plugin.settings.removeEmptyListItems = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Remove finished tasks')
			.setDesc('Remove lines containing completed tasks like "- [x] Task completed" or "- [X] Another task"')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeFinishedTasks)
				.onChange(async (value) => {
					this.plugin.settings.removeFinishedTasks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Create backup')
			.setDesc('Create a backup file before making changes.\nBackup filename format is defined below.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createBackup)
				.onChange(async (value) => {
					this.plugin.settings.createBackup = value;
					await this.plugin.saveSettings();
				}));
	

		containerEl.createEl('h3', { text: 'Range Removal' });
		containerEl.createEl('p', { text: 'Remove content between start and end markers, preserving partial line content.' });

		new Setting(containerEl)
			.setName('Range start markers')
			.setDesc('Text markers that begin content to remove. Enter one marker per line.')
			.addTextArea(text => {
				text.setPlaceholder('%% remove from here %%\nrm-from-here')
					.setValue(this.plugin.settings.rangeStartStrings.join('\n'))
					.onChange(async (value) => {
						const markers = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						
						if (markers.length === 0) {
							new Notice('At least one range start marker is required');
							return;
						}
						
						this.plugin.settings.rangeStartStrings = markers;
						await this.plugin.saveSettings();
					});
				
				// Set textarea height for 3 lines with scrollbar
				text.inputEl.rows = 3;
				text.inputEl.style.resize = 'vertical';
				text.inputEl.style.minHeight = '60px';
			});

		new Setting(containerEl)
			.setName('Range end markers')
			.setDesc('Text markers that end content to remove. Enter one marker per line.')
			.addTextArea(text => {
				text.setPlaceholder('%% remove till here %%\nrm-till-here')
					.setValue(this.plugin.settings.rangeEndStrings.join('\n'))
					.onChange(async (value) => {
						const markers = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						
						if (markers.length === 0) {
							new Notice('At least one range end marker is required');
							return;
						}
						
						this.plugin.settings.rangeEndStrings = markers;
						await this.plugin.saveSettings();
					});
				
				// Set textarea height for 3 lines with scrollbar
				text.inputEl.rows = 3;
				text.inputEl.style.resize = 'vertical';
				text.inputEl.style.minHeight = '60px';
			});

		containerEl.createEl('h3', { text: 'Link Cleaning' });
		containerEl.createEl('p', { text: 'Convert links to plain text in backticks for lines containing any of these markers.' });

		new Setting(containerEl)
			.setName('Link cleaning markers')
			.setDesc('Lines containing any of these strings will have their links converted to backticked text. Enter one marker per line.')
			.addTextArea(text => {
				text.setPlaceholder('%% clean me %%\nclean-ln')
					.setValue(this.plugin.settings.cleanLinksStrings.join('\n'))
					.onChange(async (value) => {
						const markers = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						
						if (markers.length === 0) {
							new Notice('At least one link cleaning marker is required');
							return;
						}
						
						this.plugin.settings.cleanLinksStrings = markers;
						await this.plugin.saveSettings();
					});
				
				// Set textarea height for 3 lines with scrollbar
				text.inputEl.rows = 3;
				text.inputEl.style.resize = 'vertical';
				text.inputEl.style.minHeight = '60px';
			});

		containerEl.createEl('h3', { text: 'Comment Cleaning' });
		containerEl.createEl('p', { text: 'Remove specific %% comments %% that contain any of these markers. Only comments containing the markers are removed.' });

		new Setting(containerEl)
			.setName('Comment cleaning markers')
			.setDesc('Only comments containing any of these markers will be removed (markers must be inside the comments). Enter one marker per line.')
			.addTextArea(text => {
				text.setPlaceholder('remove this comment\nrm-cmt')
					.setValue(this.plugin.settings.commentCleanerStrings.join('\n'))
					.onChange(async (value) => {
						const markers = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						
						if (markers.length === 0) {
							new Notice('At least one comment cleaning marker is required');
							return;
						}
						
						this.plugin.settings.commentCleanerStrings = markers;
						await this.plugin.saveSettings();
					});
				
				// Set textarea height for 3 lines with scrollbar
				text.inputEl.rows = 3;
				text.inputEl.style.resize = 'vertical';
				text.inputEl.style.minHeight = '60px';
			});

		containerEl.createEl('h3', { text: 'Single Line Removal' });
		containerEl.createEl('p', { text: 'Remove entire lines containing any of these markers (processed after comment and link cleaning).' });

		new Setting(containerEl)
			.setName('Single line removal markers')
			.setDesc('Lines containing any of these strings will be completely removed. Enter one marker per line.')
			.addTextArea(text => {
				text.setPlaceholder('%% remove line %%\nrem-ln')
					.setValue(this.plugin.settings.removalStrings.join('\n'))
					.onChange(async (value) => {
						const markers = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						
						if (markers.length === 0) {
							new Notice('At least one removal marker is required');
							return;
						}
						
						this.plugin.settings.removalStrings = markers;
						await this.plugin.saveSettings();
					});
				
				// Set textarea height for 3 lines with scrollbar
				text.inputEl.rows = 3;
				text.inputEl.style.resize = 'vertical';
				text.inputEl.style.minHeight = '60px';
			});

		containerEl.createEl('h3', { text: 'Empty Line Limiting' });
		containerEl.createEl('p', { text: 'Control the maximum number of consecutive empty lines to keep between content lines.' });

		new Setting(containerEl)
			.setName('Keep at most X consecutive empty lines')
			.setDesc('Maximum number of consecutive empty lines to preserve (0-10). 0 = remove all empty lines, 1 = keep at most 1 empty line between content, etc.')
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(this.plugin.settings.maxConsecutiveEmptyLines)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxConsecutiveEmptyLines = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Backup Options' });

		// Helper function to generate example filename
		const generateExampleFilename = (format: string): string => {
			const processedFormat = moment().format(format);
			return `CoolNote${processedFormat}.md`;
		};

		new Setting(containerEl)
			.setName('Backup file name format')
			.setDesc(`Format for backup file names. Use YYYY, MM, DD, HH, mm, ss for date/time. Example: ${generateExampleFilename(this.plugin.settings.backupFileNameFormat)}
				For details visit https://momentjs.com/docs/?/displaying/format/#/displaying/`)
			.addText(text => text
				.setPlaceholder('_YYYY-MM-DD HHmmss')
				.setValue(this.plugin.settings.backupFileNameFormat)
				.onChange(async (value) => {
					if (value.trim() === '') {
						new Notice('Backup file name format cannot be empty');
						return;
					}
					this.plugin.settings.backupFileNameFormat = value;
					await this.plugin.saveSettings();
					// Update the description with new example
					text.inputEl.parentElement?.parentElement?.querySelector('.setting-item-description')?.setText(
						`Format for backup file names. Use YYYY, MM, DD, HH, mm, ss for date/time. Example: ${generateExampleFilename(value)}`
					);
				}));
	}

	private displayUsageTab(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Access Methods' });
		containerEl.createEl('p', { text: 'You can clean lines from files using:' });
		const usageList = containerEl.createEl('ul');
		usageList.createEl('li', { text: 'Ribbon button (trash icon) - cleans current active file' });
		usageList.createEl('li', { text: 'Right-click context menu on any file' });
		usageList.createEl('li', { text: 'Right-click context menu in editor' });
		usageList.createEl('li', { text: 'Command palette: "Clean lines, ranges, and links from current file"' });

		containerEl.createEl('h3', { text: 'Processing Order' });
		containerEl.createEl('p', { text: 'The plugin processes content in this order:' });
		const orderList = containerEl.createEl('ol');
		orderList.createEl('li', { text: 'Range Removal (removes content between start/end markers)' });
		orderList.createEl('li', { text: 'Comment Cleaning (removes %% comments %% from marked lines)' });
		orderList.createEl('li', { text: 'Link Cleaning (converts links to backticked text)' });
		orderList.createEl('li', { text: 'Single Line Removal (removes entire lines with markers)' });
		orderList.createEl('li', { text: 'Empty List Item Removal (removes empty list items)' });
		orderList.createEl('li', { text: 'Finished Tasks Removal (removes completed tasks)' });
		orderList.createEl('li', { text: 'Empty Line Limiting (reduces consecutive empty lines)' });
		orderList.createEl('li', { text: 'Backup Creation (if enabled) and file save' });
		const noticeBackupReason = orderList.createEl('ul');
		noticeBackupReason.createEl('li', { text: 'Notice: backup created from source data but as a last step to avoid creating unnecessary files if no cleaning is done' });

		containerEl.createEl('h3', { text: 'Examples' });
		
		// Range Removal Example
		const rangeExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		rangeExample.createEl('h4', { text: 'Range Removal' });
		rangeExample.createEl('p', { text: 'Input (with multiple start/end markers):' });
		rangeExample.createEl('pre', { text: 'some text %% remove from here %%\nline to remove\nanother line to remove\n%% remove till here %% remaining text\nmore text rm-from-here\ncontent to delete\nrm-till-here final text' });
		rangeExample.createEl('p', { text: 'Result:' });
		rangeExample.createEl('pre', { text: 'some text remaining text\nmore text final text' });

		// Comment Cleaning Example
		const commentExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		commentExample.createEl('h4', { text: 'Comment Cleaning' });
		commentExample.createEl('p', { text: 'Input (with multiple comment markers):' });
		commentExample.createEl('pre', { text: 'This text %% this comment stays %% has comments %% remove this comment %%\nAnother line %% inline comment %% with %% another comment rm-cmt %% text\nMore text %% keep this %% and %% rm-cmt delete this %% end' });
		commentExample.createEl('p', { text: 'Result:' });
		commentExample.createEl('pre', { text: 'This text %% this comment stays %% has comments\nAnother line %% inline comment %% with text\nMore text %% keep this %% and end' });

		// Link Cleaning Example
		const linkExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		linkExample.createEl('h4', { text: 'Link Cleaning' });
		linkExample.createEl('p', { text: 'Input (with multiple link markers):' });
		linkExample.createEl('pre', { text: 'Check [[My Note]] and [Google](https://google.com) %% clean me %%\nAnother line with [[Another Note|Display]] clean-ln here\nNormal line with [[Keep Link]] stays' });
		linkExample.createEl('p', { text: 'Result:' });
		linkExample.createEl('pre', { text: 'Check `My Note` and `Google`\nAnother line with `Display` here\nNormal line with [[Keep Link]] stays' });

		// Single Line Removal Example
		const singleExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		singleExample.createEl('h4', { text: 'Single Line Removal' });
		singleExample.createEl('p', { text: 'Input (with markers "%% remove line %%" and "rem-ln"):' });
		singleExample.createEl('pre', { text: 'This line stays\n%% remove line %% This entire line is removed\nThis line also stays\nrem-ln Another line to remove\nFinal line stays' });
		singleExample.createEl('p', { text: 'Result:' });
		singleExample.createEl('pre', { text: 'This line stays\nThis line also stays\nFinal line stays' });

		// Empty Line Limiting Example
		const emptyLineExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		emptyLineExample.createEl('h4', { text: 'Empty Line Limiting' });
		emptyLineExample.createEl('p', { text: 'Input (with setting "Keep at most 1 consecutive empty line"):' });
		emptyLineExample.createEl('pre', { text: 'First paragraph\n\n\n\n\nSecond paragraph\n\n\nThird paragraph' });
		emptyLineExample.createEl('p', { text: 'Result:' });
		emptyLineExample.createEl('pre', { text: 'First paragraph\n\nSecond paragraph\n\nThird paragraph' });

		// Empty List Item Removal Example
		const emptyListExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		emptyListExample.createEl('h4', { text: 'Empty List Item Removal' });
		emptyListExample.createEl('p', { text: 'Input (with "Remove empty list items" enabled):' });
		emptyListExample.createEl('pre', { text: 'Task list:\n- First task\n- \n- [ ]\n- [x]\n- Second task\n- [ ] Third task' });
		emptyListExample.createEl('p', { text: 'Result:' });
		emptyListExample.createEl('pre', { text: 'Task list:\n- First task\n- Second task\n- [ ] Third task' });

		// Finished Tasks Removal Example
		const finishedTasksExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		finishedTasksExample.createEl('h4', { text: 'Finished Tasks Removal' });
		finishedTasksExample.createEl('p', { text: 'Input (with "Remove finished tasks" enabled):' });
		finishedTasksExample.createEl('pre', { text: 'My tasks:\n- [ ] Todo item\n- [x] Completed task\n- [X] Another completed task\n- [ ] Still pending\n- [x] Done with this one' });
		finishedTasksExample.createEl('p', { text: 'Result:' });
		finishedTasksExample.createEl('pre', { text: 'My tasks:\n- [ ] Todo item\n- [ ] Still pending' });

		// Combined Example
		const combinedExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		combinedExample.createEl('h4', { text: 'Combined Processing' });
		combinedExample.createEl('p', { text: 'Input:' });
		combinedExample.createEl('pre', { text: 'Keep this [[Important Note|Note]] clean-ln\nSome text rm-from-here\nDelete this content\nrm-till-here keep this\nText with %% comment %% and %% comment rm-cmt %% more text\n%% remove line %% This line gets deleted\nrem-ln Another line to remove\nFinal line with [Google](https://google.com) %% clean me %%' });
		combinedExample.createEl('p', { text: 'Result:' });
		combinedExample.createEl('pre', { text: 'Keep this `Note`\nSome text keep this\nText with %% comment %% and more text\nFinal line with `Google`' });
	}
}

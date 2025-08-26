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
				menu.addItem((item) => {
					item
						.setTitle('Clean lines')
						.setIcon('trash-2')
						.onClick(async () => {
							await this.cleanFile(file);
						});
				});
			})
		);

		// Add editor context menu
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item
						.setTitle('Clean lines')
						.setIcon('trash-2')
						.onClick(async () => {
							await this.cleanCurrentFile();
						});
				});
			})
		);

		// Add settings tab
		this.addSettingTab(new LineCleanerSettingTab(this.app, this));
	}

	onunload() {
		// Clean up resources if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		await this.cleanFile(activeFile);
	}

	async cleanFile(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			let processedContent = content;
			let totalRemovals = 0;

			// First, process range-based removals
			const rangeResult = this.processRangeRemovals(processedContent);
			processedContent = rangeResult.content;
			totalRemovals += rangeResult.removals;

			// Then, process link cleaning
			const linkResult = this.processLinkCleaning(processedContent);
			processedContent = linkResult.content;
			totalRemovals += linkResult.removals;

			// Finally, process single-line removals
			const singleResult = this.processSingleLineRemovals(processedContent);
			processedContent = singleResult.content;
			totalRemovals += singleResult.removals;

			// Check if any changes were made
			if (processedContent === content) {
				new Notice('No lines found containing removal markers');
				return;
			}

			// Create backup if enabled
			if (this.settings.createBackup) {
				await this.createBackup(file, content);
			}

			// Write cleaned content back to file
			await this.app.vault.modify(file, processedContent);

			new Notice(`Processed ${totalRemovals} removal operation(s) in ${file.name}`);
		} catch (error) {
			console.error('Error cleaning file:', error);
			new Notice('Error cleaning file: ' + error.message);
		}
	}

	processRangeRemovals(content: string): { content: string, removals: number } {
		let processedContent = content;
		let removals = 0;
		const startMarker = this.settings.rangeStartString;
		const endMarker = this.settings.rangeEndString;

		while (true) {
			const startIndex = processedContent.indexOf(startMarker);
			if (startIndex === -1) break;

			const endIndex = processedContent.indexOf(endMarker, startIndex + startMarker.length);
			if (endIndex === -1) {
				// Start marker found but no end marker - remove from start marker to end of content
				const beforeStart = processedContent.substring(0, startIndex);
				processedContent = beforeStart;
				removals++;
				break;
			}

			// Extract content before start marker and after end marker
			const beforeStart = processedContent.substring(0, startIndex);
			const afterEnd = processedContent.substring(endIndex + endMarker.length);
			
			// Combine the preserved parts
			processedContent = beforeStart + afterEnd;
			removals++;
		}

		return { content: processedContent, removals };
	}

	processSingleLineRemovals(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		const removalString = this.settings.removalString;
		
		// Count lines to be removed
		const linesToRemove = lines.filter(line => line.includes(removalString)).length;
		
		// Remove lines containing the removal string
		const cleanedLines = lines.filter(line => !line.includes(removalString));
		const cleanedContent = cleanedLines.join('\n');

		return { content: cleanedContent, removals: linesToRemove };
	}

	processLinkCleaning(content: string): { content: string, removals: number } {
		const lines = content.split('\n');
		const cleanMarker = this.settings.cleanLinksString;
		let processedLines: string[] = [];
		let removals = 0;

		for (const line of lines) {
			if (line.includes(cleanMarker)) {
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

		// Remove the clean me marker after processing links
		processedLine = processedLine.replace(this.settings.cleanLinksString, '');

		return processedLine;
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
		containerEl.createEl('h2', { text: 'Line Cleaner' });

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
		containerEl.createEl('h3', { text: 'Range Removal' });
		containerEl.createEl('p', { text: 'Remove content between start and end markers, preserving partial line content.' });

		new Setting(containerEl)
			.setName('Range start marker')
			.setDesc('Text marking the beginning of content to remove')
			.addText(text => text
				.setPlaceholder('%% remove from here %%')
				.setValue(this.plugin.settings.rangeStartString)
				.onChange(async (value) => {
					this.plugin.settings.rangeStartString = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Range end marker')
			.setDesc('Text marking the end of content to remove')
			.addText(text => text
				.setPlaceholder('%% remove till here %%')
				.setValue(this.plugin.settings.rangeEndString)
				.onChange(async (value) => {
					this.plugin.settings.rangeEndString = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Link Cleaning' });
		containerEl.createEl('p', { text: 'Convert links to plain text in backticks for lines containing this marker.' });

		new Setting(containerEl)
			.setName('Link cleaning marker')
			.setDesc('Lines containing this string will have their links converted to backticked text')
			.addText(text => text
				.setPlaceholder('%% clean me %%')
				.setValue(this.plugin.settings.cleanLinksString)
				.onChange(async (value) => {
					this.plugin.settings.cleanLinksString = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Single Line Removal' });
		containerEl.createEl('p', { text: 'Remove entire lines containing this marker (processed after link cleaning).' });

		new Setting(containerEl)
			.setName('Single line removal marker')
			.setDesc('Lines containing this exact string will be completely removed')
			.addText(text => text
				.setPlaceholder('%% remove me %%')
				.setValue(this.plugin.settings.removalString)
				.onChange(async (value) => {
					this.plugin.settings.removalString = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Backup Options' });

		new Setting(containerEl)
			.setName('Create backup')
			.setDesc('Create a backup file before making changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createBackup)
				.onChange(async (value) => {
					this.plugin.settings.createBackup = value;
					await this.plugin.saveSettings();
				}));

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
		orderList.createEl('li', { text: 'Link Cleaning (converts links to backticked text)' });
		orderList.createEl('li', { text: 'Single Line Removal (removes entire lines with markers)' });
		orderList.createEl('li', { text: 'Backup Creation (if enabled) and file save' });

		containerEl.createEl('h3', { text: 'Examples' });
		
		// Range Removal Example
		const rangeExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		rangeExample.createEl('h4', { text: 'Range Removal' });
		rangeExample.createEl('p', { text: 'Input:' });
		rangeExample.createEl('pre', { text: 'some text %% remove from here %%\nline to remove\nanother line to remove\n%% remove till here %% remaining text' });
		rangeExample.createEl('p', { text: 'Result:' });
		rangeExample.createEl('pre', { text: 'some text remaining text' });

		// Link Cleaning Example
		const linkExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		linkExample.createEl('h4', { text: 'Link Cleaning' });
		linkExample.createEl('p', { text: 'Input:' });
		linkExample.createEl('pre', { text: 'Check [[My Note]] and [Google](https://google.com) %% clean me %%' });
		linkExample.createEl('p', { text: 'Result:' });
		linkExample.createEl('pre', { text: 'Check `My Note` and `Google`' });

		// Single Line Removal Example
		const singleExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		singleExample.createEl('h4', { text: 'Single Line Removal' });
		singleExample.createEl('p', { text: 'Input:' });
		singleExample.createEl('pre', { text: 'This line stays\n%% remove me %% This entire line is removed\nThis line also stays' });
		singleExample.createEl('p', { text: 'Result:' });
		singleExample.createEl('pre', { text: 'This line stays\nThis line also stays' });

		// Combined Example
		const combinedExample = containerEl.createDiv({ cls: 'line-cleaner-example' });
		combinedExample.createEl('h4', { text: 'Combined Processing' });
		combinedExample.createEl('p', { text: 'Input:' });
		combinedExample.createEl('pre', { text: 'Keep this [[Important Note|Note]] %% clean me %%\nSome text %% remove from here %%\nDelete this content\n%% remove till here %% keep this\n%% remove me %% This line gets deleted\nFinal line with [Google](https://google.com) %% clean me %%' });
		combinedExample.createEl('p', { text: 'Result:' });
		combinedExample.createEl('pre', { text: 'Keep this `Note`\nSome text keep this\nFinal line with `Google`' });
	}
}

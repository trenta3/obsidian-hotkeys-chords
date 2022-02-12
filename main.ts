import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

class HotKey {
    public meta: boolean;
    public shift: boolean;
    public ctrl: boolean;
    public alt: boolean;
    public key: string;

    public constructor (dict) {
	this.meta = dict.meta;
	this.shift = dict.shift;
	this.ctrl = dict.ctrl;
	this.alt = dict.alt;
	this.key = dict.key.toLowerCase();
    }
    
    public toString(): string {
	var name = "";
	if (this.alt == true) {
	    name += "A-";
	}
	if (this.ctrl == true) {
	    name += "C-";
	}
	if (this.meta == true) {
	    name += "M-";
	}
	if (this.shift == true) {
	    name += "S-";
	}
	return name + this.key;
    }
}

class Chord {
    public sequence: HotKey[];
    public command: string;

    public constructor (dict) {
	this.sequence = dict.sequence;
	this.command = dict.command;
    }
    
    // Check if other is a prefix of the current Chord
    // Returns: "NO", "YES", "FULL" when it is a complete match
    public checkPrefix(other: HotKey[]): string {
	for (const [index, hotkey] of this.sequence.entries()) {
	    let otherkey = other[index];
	    if (otherkey === undefined) {
		return "YES";
	    }
	    if ((hotkey.meta != otherkey.meta) ||
		(hotkey.shift != otherkey.shift) ||
		(hotkey.ctrl != otherkey.ctrl) ||
		(hotkey.alt != otherkey.alt) ||
		(hotkey.key != otherkey.key)) {
		return "NO";
	    }
	}
	return "FULL";
    }
}

interface Settings {
    hotkeys: Chord[];
}

const DEFAULT_SETTINGS: Settings = {
    hotkeys: [
	new Chord({ sequence: [
	    new HotKey({ key: 'h', meta: false, shift: false, ctrl: false, alt: true }),
	], command: "editor:focus-left" }),
	new Chord({ sequence: [
	    new HotKey({ key: 'x', meta: false, shift: false, ctrl: true, alt: false }),
	    new HotKey({ key: 'h', meta: false, shift: false, ctrl: false, alt: false }),
	], command: "command-palette:open" }),
    ]
}

export default class HotkeysChordPlugin extends Plugin {
    public settings: Settings;

    private statusbar; // Points to our custom status bar
    private currentseq: HotKey[]; // List of currently pressed chords

    async onload() {
	this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	this.statusbar = this.addStatusBarItem();
	this.currentseq = [];

	this.updateStatusBar();
	this.registerEditorExtension(
	    Prec.highest(
		EditorView.domEventHandlers({
		    "keydown": this.handleKeyDown,
		})
	    )
	);

	// TODO: Add the settings tab!
	// this.addSettingsTab is not a function!!
	// this.addSettingsTab(new HotkeysChordPluginSettingsTab(this.app, this));
    }

    async saveSettings() {
	await this.saveData(this.settings);
    }

    private updateStatusBar(): void {
	var chord = "None";
	if (this.currentseq.length > 0) {
	    chord = this.currentseq.map(hk => hk.toString()).join(" ");
	}
	this.statusbar.setText("Chord: " + chord);
    }
    
    private readonly handleKeyDown = (
	event: KeyboardEvent,
	cm: CodeMirror.Editor,
    ) => {
	if (event.key === 'Shift' || event.key === 'Meta' || event.key === 'Control' || event.key == 'Alt') {
	    console.debug("Skipping meta key: " + event.key);
	    return;
	}
	// Add the pressed keys to the current sequence and update on-screen
	let hotkey = new HotKey ({
	    key: event.key,
	    shift: event.shiftKey,
	    meta: event.metaKey,
	    ctrl: event.ctrlKey,
	    alt: event.altKey,
	});
	this.currentseq.push(hotkey);
	// We check whether the current sequence can be found in the hotkey database
	var partialMatch = false;
	for (let chord of this.settings.hotkeys) {
	    let result = chord.checkPrefix(this.currentseq);
	    if (result == "FULL") {
		(this.app as any).commands.executeCommandById(chord.command);
		event.preventDefault();
		event.stopPropagation();
		// TODO: Maybe put this as an option
		new Notice(`Chord triggered ${chord.command}`);
		partialMatch = false;
		break;
	    } else if (result == "YES") {
		partialMatch = true;
	    }
	}
	// We also want to prevent default if this is a key inside a previous sequence or a partial match
	if ((this.currentseq.length > 1) || partialMatch) {
	    event.preventDefault();
	    event.stopPropagation();
	}
	if (!partialMatch) {
	    // No patial match, we get back to zero sequence
	    this.currentseq = [];
	}
	this.updateStatusBar();
    }
}

class HotkeysChordPluginSettingsTab extends PluginSettingTab {
    plugin: HotkeysChordPlugin;

    constructor(app: App, plugin: HotkeysChordPlugin) {
	super(app, plugin);
	this.plugin = plugin;
    }
    
    public display(): void {
	const {containerEl} = this;
	containerEl.empty();
	containerEl.createEl('h2', {text: 'Hotkeys Chord Plugin - Settings'});

	// TODO: Show currently defined hotkeys and allow to add others!
	new Setting(containerEl)
	    .setName('Setting #1')
	    .setDesc('It\'s a secret')
	    .addText(text => text
	    .setPlaceholder('Enter your secret')
	    .setValue(this.plugin.settings.mySetting)
	    .onChange(async (value) => {
		console.log('Secret: ' + value);
		this.plugin.settings.mySetting = value;
		await this.plugin.saveSettings();
	    }));
    }
}

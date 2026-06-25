import { App, Plugin, PluginSettingTab, Setting } from 'obsidian'
import type { AcornySettings } from './types.js'

export const DEFAULT_SETTINGS: AcornySettings = {
  serverUrl: 'https://api.acorny.io',
  exportToken: '',
  folderPath: 'Acorny',
  syncOnStartup: true,
  pollIntervalMinutes: 60,
}

/** The plugin exposes exactly what the settings tab needs. `main.ts`'s plugin class implements this. */
export interface SettingsHost extends Plugin {
  settings: AcornySettings
  saveSettings(): Promise<void>
  triggerSync(): Promise<void>
}

export class AcornySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly host: SettingsHost) {
    super(app, host) // standard Obsidian signature: super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('Your Acorny API base URL.')
      .addText((t) =>
        t.setPlaceholder('https://api.acorny.io')
          .setValue(this.host.settings.serverUrl)
          .onChange(async (v) => { this.host.settings.serverUrl = v.trim(); await this.host.saveSettings() }))

    new Setting(containerEl)
      .setName('Export token')
      .setDesc('Read-only token from Acorny Settings → Export tokens. Keep it secret; do not sync your plugin data folder publicly.')
      .addText((t) => {
        t.inputEl.type = 'password'
        t.setPlaceholder('acornyexp_…')
          .setValue(this.host.settings.exportToken)
          .onChange(async (v) => { this.host.settings.exportToken = v.trim(); await this.host.saveSettings() })
      })

    new Setting(containerEl)
      .setName('Folder')
      .setDesc('Vault folder where synced notes are written.')
      .addText((t) =>
        t.setValue(this.host.settings.folderPath)
          .onChange(async (v) => { this.host.settings.folderPath = v.trim() || 'Acorny'; await this.host.saveSettings() }))

    new Setting(containerEl)
      .setName('Sync on startup')
      .addToggle((tg) =>
        tg.setValue(this.host.settings.syncOnStartup)
          .onChange(async (v) => { this.host.settings.syncOnStartup = v; await this.host.saveSettings() }))

    new Setting(containerEl)
      .setName('Auto-sync interval (minutes)')
      .setDesc('0 disables interval polling.')
      .addText((t) =>
        t.setValue(String(this.host.settings.pollIntervalMinutes))
          .onChange(async (v) => {
            const n = Number(v)
            this.host.settings.pollIntervalMinutes = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
            await this.host.saveSettings()
          }))

    new Setting(containerEl)
      .setName('Sync now')
      .addButton((b) =>
        b.setButtonText('Sync now').setCta().onClick(async () => {
          // Give the click visible feedback: disable + relabel while the sync runs,
          // then restore. Also prevents double-clicks during an in-flight sync.
          b.setDisabled(true)
          b.setButtonText('Syncing…')
          try {
            await this.host.triggerSync()
          } finally {
            b.setButtonText('Sync now')
            b.setDisabled(false)
          }
        }))
  }
}

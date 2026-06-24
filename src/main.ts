import { Plugin, Notice, requestUrl } from 'obsidian'
import type { AcornySettings, PluginState, SyncStatus } from './types.js'
import { DEFAULT_SETTINGS, AcornySettingTab } from './settings.js'
import { createObsidianVaultGateway } from './obsidianVaultGateway.js'
import { fetchFeedPage, type HttpRequest } from './apiClient.js'
import { writeSourceNote } from './vaultWriter.js'
import { SyncEngine } from './syncEngine.js'
import { nextAutoDelayMs } from './scheduler.js'

const DEFAULT_STATE: PluginState = { lastCursor: null, sourceIndex: {} }

interface PersistShape {
  settings?: Partial<AcornySettings>
  state?: PluginState
}

export default class AcornyPlugin extends Plugin {
  settings: AcornySettings = { ...DEFAULT_SETTINGS }
  private state: PluginState = { ...DEFAULT_STATE }
  private statusEl!: HTMLElement
  private engine!: SyncEngine
  private autoTimer: number | null = null

  async onload(): Promise<void> {
    await this.loadPersisted()

    const gateway = createObsidianVaultGateway(this.app)
    const http: HttpRequest = async ({ url, headers }) => {
      const res = await requestUrl({ url, method: 'GET', headers, throw: false })
      return { status: res.status, json: res.json, headers: res.headers }
    }

    this.engine = new SyncEngine({
      getSettings: () => this.settings,
      loadState: async () => this.state,
      saveState: async (s) => { this.state = s; await this.persist() },
      fetchPage: (cursor) =>
        fetchFeedPage(http, { serverUrl: this.settings.serverUrl, token: this.settings.exportToken, cursor }),
      writeSource: (source, highlights, index) =>
        writeSourceNote(gateway, this.settings.folderPath, source, highlights, index),
      onStatus: (status, detail) => this.setStatus(status, detail),
    })

    this.statusEl = this.addStatusBarItem()
    this.setStatus('idle')

    this.addRibbonIcon('refresh-cw', 'Acorny: Sync now', () => void this.runSync())
    this.addCommand({ id: 'acorny-sync-now', name: 'Sync now', callback: () => void this.runSync() })
    this.addSettingTab(new AcornySettingTab(this.app, this))

    if (this.settings.syncOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.runSync())
    }
    // Kick off the self-rescheduling auto-sync timer (no-op if interval disabled).
    this.scheduleAuto(this.settings.pollIntervalMinutes > 0 ? this.settings.pollIntervalMinutes * 60_000 : null)
    // Safety net: tie the pending timeout to the plugin lifecycle so it is cleared on
    // unload even if onunload is bypassed. clearAuto is idempotent (guards null).
    this.register(() => this.clearAuto())
  }

  onunload(): void {
    this.clearAuto()
  }

  triggerSync(): void {
    void this.runSync()
  }

  /** Apply a scheduler decision: clear the current timer, then set a new one (or pause if null). */
  private scheduleAuto(delayMs: number | null): void {
    this.clearAuto()
    if (delayMs === null || delayMs <= 0) return
    this.autoTimer = window.setTimeout(() => { void this.runSync() }, delayMs)
  }

  private clearAuto(): void {
    if (this.autoTimer !== null) {
      window.clearTimeout(this.autoTimer)
      this.autoTimer = null
    }
  }

  private async runSync(): Promise<void> {
    if (!this.settings.exportToken) {
      new Notice('Acorny: set your export token in Settings first.')
      return
    }
    const res = await this.engine.sync()
    if (res.status === 'completed') {
      new Notice(`Acorny: synced ${res.added} new highlight(s).`)
    } else if (res.status === 'auth_failed') {
      new Notice('Acorny: export token rejected — update it in Settings.')
    } else if (res.status === 'backoff') {
      new Notice(`Acorny: sync deferred (${res.retryAfterSeconds}s).`)
    }
    // Decide the next automatic run: pause on auth_failed, near-retry on backoff,
    // normal cadence otherwise. A subsequent manual sync that succeeds resumes auto.
    if (res.status !== 'skipped') {
      this.scheduleAuto(nextAutoDelayMs(res, this.settings.pollIntervalMinutes))
    }
  }

  private setStatus(status: SyncStatus, detail?: string): void {
    const label: Record<SyncStatus, string> = {
      idle: 'Acorny: idle',
      syncing: 'Acorny: syncing…',
      backoff: 'Acorny: retry pending',
      auth_failed: 'Acorny: auth failed',
    }
    this.statusEl.setText(label[status])
    this.statusEl.title = detail ?? ''
  }

  private async loadPersisted(): Promise<void> {
    const data = ((await this.loadData()) as PersistShape | null) ?? {}
    this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }
    this.state = { ...DEFAULT_STATE, ...(data.state ?? {}) }
  }

  private async persist(): Promise<void> {
    const payload: PersistShape = { settings: this.settings, state: this.state }
    await this.saveData(payload)
  }

  async saveSettings(): Promise<void> {
    await this.persist()
  }
}

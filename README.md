# Acorny Sync

Sync your [Acorny](https://acorny.io) highlights into your Obsidian vault as Markdown notes — one note per source, appended idempotently so your edits are never overwritten.

## What it does

- Pulls highlights from Acorny's read-only export feed (`/api/v1/exports/highlights/feed`).
- Writes **one Markdown note per source** into a folder you choose. Each note has frontmatter (`title`, `source`, `acorny-source-id`, optional `author`/`tags`) and a `## Highlights` list.
- **Append-only and idempotent.** Every highlight ends with a block id `^acorny-<id>`; re-syncing only adds highlights that aren't already in the note. Your manual edits and added lines are preserved.
- **Source-identity anchored on `acorny-source-id`**, not the filename — renaming a note (or the source title in Acorny) reuses the same note instead of creating a duplicate.
- Triggers: manual (command **Acorny: Sync now** + ribbon icon), on startup, and an optional interval. A single sync runs at a time (new triggers while one is running are skipped, not queued).

## Setup

1. You need an Acorny account. In Acorny, go to **Settings → Export tokens** and create a read-only export token (it looks like `acornyexp_…`).
2. Install this plugin (see below), enable it, and open its settings.
3. Set:
   - **Server URL** — your Acorny API base URL (default `https://api.acorny.io`).
   - **Export token** — paste the token from step 1.
   - **Folder** — the vault folder to write notes into (default `Acorny`).
   - **Sync on startup** / **Auto-sync interval** — optional automatic triggers (`0` disables interval polling).
4. Run **Acorny: Sync now** (command palette or ribbon).

## Security

- The export token is **read-only** and lives only in this plugin's data file inside your vault (`.obsidian/plugins/acorny-sync/data.json`). It is never logged, never shown in notifications, and never embedded in error messages.
- **Do not publicly sync or share your plugin data folder** — it contains your token.
- This plugin talks only to the documented Acorny export feed endpoint. It makes no other network calls and never writes data back to Acorny.

## Install

### BRAT (beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. In BRAT, choose **Add beta plugin** and enter `acornyio/acorny-obsidian`.
3. Enable **Acorny Sync** in **Settings → Community plugins**.

### Manual

Copy `manifest.json` and `main.js` into `<vault>/.obsidian/plugins/acorny-sync/`, then enable the plugin in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev        # esbuild watch -> main.js
npm run build      # typecheck + production bundle
npm test           # vitest unit tests
npm run typecheck  # tsc --noEmit
```

All Obsidian-coupled code lives in `main.ts`, `settings.ts`, and `obsidianVaultGateway.ts`; everything else is pure, dependency-injected logic with unit tests.

## License

[MIT](./LICENSE)

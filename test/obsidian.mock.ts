export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Notice { constructor(_msg: string) {} }
export class TFile {}
export class TFolder {}
export function normalizePath(p: string): string { return p }
export async function requestUrl(): Promise<unknown> { throw new Error('not in tests') }
// Real YAML in tests: the runtime uses Obsidian's stringifyYaml; here we back it
// with js-yaml (a dev-only dependency) so renderer tests exercise real serialization.
import { dump } from 'js-yaml'
export function stringifyYaml(obj: unknown): string { return dump(obj, { lineWidth: -1 }) }

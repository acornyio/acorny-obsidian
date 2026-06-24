export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Notice { constructor(_msg: string) {} }
export class TFile {}
export class TFolder {}
export function normalizePath(p: string): string { return p }
export async function requestUrl(): Promise<unknown> { throw new Error('not in tests') }
export function stringifyYaml(): string { return '' }

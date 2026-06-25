import { readFileSync, writeFileSync } from 'fs'

// Run via the npm "version" lifecycle: `npm version patch|minor|major` sets
// package.json version, then this script syncs manifest.json + versions.json.
const targetVersion = process.env.npm_package_version

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
const { minAppVersion } = manifest
manifest.version = targetVersion
writeFileSync('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)

const versions = JSON.parse(readFileSync('versions.json', 'utf8'))
if (!(targetVersion in versions)) {
  versions[targetVersion] = minAppVersion
  writeFileSync('versions.json', `${JSON.stringify(versions, null, 2)}\n`)
}

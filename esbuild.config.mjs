import esbuild from 'esbuild'
import { builtinModules } from 'node:module'

const prod = process.argv.includes('production')

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
  format: 'cjs',
  target: 'es2020',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  outfile: 'main.js',
})

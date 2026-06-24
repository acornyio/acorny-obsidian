import esbuild from 'esbuild'
import builtins from 'builtin-modules'

const prod = process.argv.includes('production')

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2020',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  outfile: 'main.js',
})

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  analyzeGraph,
  buildGraph,
  createCompiler,
  formatGraphInspect,
  isError,
  loadConfig,
  weappAdapter,
} from '@mpbuild/core'

/** inspect graph：cwd 下有 src/app.js 则建图打印。build：loadConfig → createCompiler.run。 */
export async function run(argv: string[] = process.argv): Promise<void> {
  if (argv[2] === 'inspect' && argv[3] === 'graph') {
    const cwd = process.cwd()
    const appJs = join(cwd, 'src', 'app.js')
    if (!existsSync(appJs)) {
      console.log('no src/app.js')
      return
    }
    const { graph } = await buildGraph({
      rootDir: cwd,
      srcDir: join(cwd, 'src'),
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })
    analyzeGraph(graph, [{ root: '' }], weappAdapter)
    console.log(formatGraphInspect(graph))
    return
  }
  if (argv[2] === 'build') {
    const cwd = process.cwd()
    let config
    try {
      config = await loadConfig(cwd)
    } catch (err) {
      const code = thrownCode(err)
      const message = err instanceof Error ? err.message : String(err)
      console.error(code && !message.startsWith(code) ? `${code} ${message}` : message)
      process.exitCode = code === 'CONFIG_NOT_FOUND' || code === 'LEGACY_CONFIG' ? 2 : 1
      return
    }
    const { diagnostics } = await createCompiler(config).run()
    for (const d of diagnostics) {
      const parts = [d.code, d.message]
      if (d.file) {
        parts.push(d.file)
      }
      console.error(parts.join(' '))
    }
    if (diagnostics.some(isError)) {
      process.exitCode = 1
    }
    return
  }
  console.log('usage: mpb <inspect graph|build>')
}

function thrownCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code
  }
  return undefined
}

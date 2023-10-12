import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  createCompiler,
  formatAnalyzeJson,
  formatGraphInspect,
  isError,
  loadConfig,
} from '@mpbuild/core'

/** inspect graph：loadConfig + analyze。build：run 一次，`--minify` 覆盖 compile.minify。 */
export async function run(argv: string[] = process.argv): Promise<void> {
  if (argv[2] === 'inspect' && argv[3] === 'graph') {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    const { graph, diagnostics } = await createCompiler(config).analyze()
    printDiagnostics(diagnostics)
    console.log(formatGraphInspect(graph))
    if (diagnostics.some(isError)) {
      process.exitCode = 1
    }
    return
  }
  if (argv[2] === 'dev' || argv[2] === '--watch' || (argv[2] === 'build' && argv.includes('--watch'))) {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    await createCompiler(config).watch()
    await new Promise<void>(() => {})
    return
  }
  if (argv[2] === 'analyze') {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    const { graph, plan, diagnostics } = await createCompiler(config).analyze()
    printDiagnostics(diagnostics)
    const outputDir = resolve(config.rootDir, config.output.dir)
    await mkdir(outputDir, { recursive: true })
    await writeFile(
      join(outputDir, 'mpbuild-analyze.json'),
      `${JSON.stringify(formatAnalyzeJson(graph, plan), null, 2)}\n`,
    )
    if (diagnostics.some(isError)) {
      process.exitCode = 1
    }
    return
  }
  if (argv[2] === 'build') {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    if (argv.includes('--minify')) {
      config.compile = { ...config.compile, minify: true }
    }
    const { diagnostics } = await createCompiler(config, {
      cache: !argv.includes('--no-cache'),
    }).run()
    printDiagnostics(diagnostics)
    if (diagnostics.some(isError)) {
      process.exitCode = 1
    }
    return
  }
  console.log('usage: mpb <inspect graph|build|dev|analyze>')
}

async function loadOrReport(cwd: string) {
  try {
    return await loadConfig(cwd)
  } catch (err) {
    const code = thrownCode(err)
    const message = err instanceof Error ? err.message : String(err)
    console.error(code && !message.startsWith(code) ? `${code} ${message}` : message)
    process.exitCode = code === 'CONFIG_NOT_FOUND' || code === 'LEGACY_CONFIG' ? 2 : 1
    return undefined
  }
}

function printDiagnostics(diagnostics: { code: string; message: string; file?: string }[]) {
  for (const d of diagnostics) {
    const parts = [d.code, d.message]
    if (d.file) {
      parts.push(d.file)
    }
    console.error(parts.join(' '))
  }
}

function thrownCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code
  }
  return undefined
}

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  analyzeGraph,
  buildGraph,
  formatGraphInspect,
  weappAdapter,
} from '@mpbuild/core'

/** P0：只认 inspect graph；有 src/app.js 则建图打印，否则 no src/app.js。不读配置、不解析 entry router。 */
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
  console.log('usage: mpb5 inspect graph')
}

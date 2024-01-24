import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeGraph, buildGraph, weappAdapter } from '../index'

describe('src-relative ids', () => {
  it('keeps subpackage prefix so analyze can own pkgA pages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mpb-ids-'))
    const src = join(root, 'src')
    await mkdir(join(src, 'pkgA', 'pages'), { recursive: true })
    await writeFile(join(src, 'app.js'), `module.exports = 1\n`)
    await writeFile(join(src, 'pkgA', 'pages', 'x.js'), `module.exports = 1\n`)
    const { graph } = await buildGraph({
      rootDir: root,
      srcDir: src,
      adapter: weappAdapter,
      entryScripts: ['src/app.js', 'src/pkgA/pages/x.js'],
    })
    expect([...graph.nodes.keys()].sort()).toEqual(['app.js', 'pkgA/pages/x.js'])
    expect(graph.nodes.get('pkgA/pages/x.js')?.sourcePath).toBe(join(src, 'pkgA', 'pages', 'x.js'))
    analyzeGraph(graph, [{ root: '' }, { root: 'pkgA' }], weappAdapter)
    expect(graph.nodes.get('app.js')?.owner).toBe('main')
    expect(graph.nodes.get('pkgA/pages/x.js')?.owner).toBe('pkgA')
  })
})

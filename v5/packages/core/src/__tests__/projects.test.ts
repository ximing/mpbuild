import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildGraph, weappAdapter } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-projects-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return { rootDir, srcDir: join(rootDir, 'src') }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('subprojects', () => {
  it('interns a file under project.src as name/relative', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `require('@one/utils/b')\n`,
      'projects/one/utils/b.js': `module.exports = 1\n`,
    })
    const projectSrc = join(rootDir, 'projects', 'one')
    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js')],
      alias: { '@one': projectSrc },
      projects: [{ name: '@one', src: projectSrc, alias: {} }],
    })

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('@one/utils/b.js')).toBe(true)
    expect(graph.nodes.get('@one/utils/b.js')?.sourcePath).toBe(join(projectSrc, 'utils', 'b.js'))
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'app.js', to: '@one/utils/b.js', raw: '@one/utils/b' }),
      ]),
    )
  })

  it('resolves function @/ from a project page and interns @one/utils/b.js', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `App({})\n`,
      'projects/one/pages/x.js': `require('@/utils/b')\n`,
      'projects/one/utils/b.js': `module.exports = 1\n`,
    })
    const projectSrc = join(rootDir, 'projects', 'one')
    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join(projectSrc, 'pages', 'x.js')],
      alias: {
        '@/': ({ importer }) => (importer.startsWith(projectSrc) ? projectSrc : undefined),
      },
      projects: [{ name: '@one', src: projectSrc, alias: {} }],
    })

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('@one/pages/x.js')).toBe(true)
    expect(graph.nodes.has('@one/utils/b.js')).toBe(true)
    expect(graph.nodes.get('@one/utils/b.js')?.sourcePath).toBe(join(projectSrc, 'utils', 'b.js'))
  })

  it('uses project.alias before global alias for importers under that project', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `require('@utils/util')\n`,
      'src/utils/util.js': `module.exports = 'main'\n`,
      'projects/one/pages/x.js': `require('@utils/b')\n`,
      'projects/one/utils/b.js': `module.exports = 'one'\n`,
    })
    const projectSrc = join(rootDir, 'projects', 'one')
    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js'), join(projectSrc, 'pages', 'x.js')],
      alias: { '@utils': join(srcDir, 'utils') },
      projects: [
        { name: '@one', src: projectSrc, alias: { '@utils': join(projectSrc, 'utils') } },
      ],
    })

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('utils/util.js')).toBe(true)
    expect(graph.nodes.has('@one/utils/b.js')).toBe(true)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'app.js', to: 'utils/util.js' }),
        expect.objectContaining({ from: '@one/pages/x.js', to: '@one/utils/b.js' }),
      ]),
    )
  })

  it('diagnoses ABS_PATH_IN_SUBPROJECT when a subproject file imports /', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `require('@one/pages/x')\n`,
      'src/abs.js': `module.exports = 1\n`,
      'projects/one/pages/x.js': `require('/abs')\n`,
    })
    const projectSrc = join(rootDir, 'projects', 'one')
    const { diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js')],
      alias: { '@one': projectSrc },
      projects: [{ name: '@one', src: projectSrc, alias: {} }],
    })
    expect(diagnostics.some((d) => d.code === 'ABS_PATH_IN_SUBPROJECT')).toBe(true)
  })
})

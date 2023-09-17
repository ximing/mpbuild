/**
 * 对比 dist-v5 与金样 dist：相对路径前缀 + app.json pages/subPackages。
 * 忽略 .map 与 mpbuild-analyze.json。不比字节。
 */
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GOLD_PREFIXES = [
  'app.js',
  'app.json',
  'pages/',
  'components/',
  'utils/',
  'wxs/',
  'subpkg1/',
  '@one/',
  '@two/',
  'project.config.json',
]

const IGNORE_EXACT = new Set(['mpbuild-analyze.json'])

export async function listRel(dir) {
  if (!existsSync(dir)) {
    return []
  }
  const out = []
  async function walk(abs, rel) {
    const names = await readdir(abs, { withFileTypes: true })
    for (const ent of names) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name
      const childAbs = join(abs, ent.name)
      if (ent.isDirectory()) {
        await walk(childAbs, childRel)
        continue
      }
      if (childRel.endsWith('.map') || IGNORE_EXACT.has(ent.name)) {
        continue
      }
      out.push(childRel.split('\\').join('/'))
    }
  }
  await walk(dir, '')
  out.sort()
  return out
}

export function hasPrefix(files, prefix) {
  if (prefix.endsWith('/')) {
    return files.some((file) => file.startsWith(prefix))
  }
  return files.some((file) => file === prefix || file.startsWith(`${prefix}/`))
}

export async function compareGold(goldDir, destDir) {
  const destFiles = await listRel(destDir)
  const missingPrefixes = GOLD_PREFIXES.filter((prefix) => !hasPrefix(destFiles, prefix))
  const npmQuerystring = destFiles.some((file) => file === 'npm/querystring' || file.startsWith('npm/querystring/'))
  const npmUtil = destFiles.some((file) => file === 'npm/util' || file.startsWith('npm/util/'))

  let goldPages
  let destPages
  let goldSubPackages
  let destSubPackages
  const goldAppPath = join(goldDir, 'app.json')
  const destAppPath = join(destDir, 'app.json')
  if (existsSync(goldAppPath) && existsSync(destAppPath)) {
    const goldApp = JSON.parse(await readFile(goldAppPath, 'utf8'))
    const destApp = JSON.parse(await readFile(destAppPath, 'utf8'))
    goldPages = goldApp.pages
    destPages = destApp.pages
    goldSubPackages = goldApp.subPackages
    destSubPackages = destApp.subPackages
  }

  return {
    destFiles,
    missingPrefixes,
    npmQuerystring,
    npmUtil,
    goldPages,
    destPages,
    goldSubPackages,
    destSubPackages,
  }
}

const thisFile = fileURLToPath(import.meta.url)
const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked && thisFile === invoked) {
  const demoRoot = dirname(dirname(thisFile))
  const goldDir = join(demoRoot, 'dist')
  const destDir = join(demoRoot, process.argv[2] ?? 'dist-v5')
  const result = await compareGold(goldDir, destDir)
  if (result.missingPrefixes.length || !result.npmQuerystring || !result.npmUtil) {
    console.error(JSON.stringify(result, null, 2))
    process.exitCode = 1
  } else if (JSON.stringify(result.goldPages) !== JSON.stringify(result.destPages)) {
    console.error('pages mismatch', result.goldPages, result.destPages)
    process.exitCode = 1
  } else if (JSON.stringify(result.goldSubPackages) !== JSON.stringify(result.destSubPackages)) {
    console.error('subPackages mismatch', result.goldSubPackages, result.destSubPackages)
    process.exitCode = 1
  } else {
    console.log('gold prefixes ok')
  }
}

import { copyFile, rm } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const loaded = new Set<string>()
let seq = 0

function isTsPath(file: string): boolean {
  return file.endsWith('.ts') || file.endsWith('.mts')
}

/** ESM import 带 cache-bust，供 loadConfig / loadAppEntry / reloadConfig。 */
export async function importFresh(absPath: string): Promise<unknown> {
  const href = `${pathToFileURL(absPath).href}?t=${Date.now()}`
  // vitest/vite-node 剥掉 ?t= 并按绝对路径缓存；同目录唯一副本只在测试二次加载时用。
  const useCopy = Boolean(process.env.VITEST) && !isTsPath(absPath) && loaded.has(absPath)
  loaded.add(absPath)
  if (!useCopy) {
    return import(href)
  }
  seq += 1
  const dest = join(
    dirname(absPath),
    `.mpbuild-fresh-${process.pid}-${seq}${extname(absPath) || '.js'}`,
  )
  await copyFile(absPath, dest)
  try {
    return await import(`${pathToFileURL(dest).href}?t=${Date.now()}`)
  } finally {
    await rm(dest, { force: true })
  }
}

import { basename, dirname, sep } from 'node:path'
import chokidar from 'chokidar'
import { CONFIG_NAMES } from '../config/load.js'
import { posixRelative } from '../graph/walk.js'
import type { ModuleGraph } from '../types.js'

const NODE_MODULES_SEG = `${sep}node_modules${sep}`
const CONFIG_NAME_SET = new Set<string>(CONFIG_NAMES) // includes mpbuild.config.mjs
const DEBOUNCE_MS = 80

/** 已入图 sourcePath + 每个 script 的 dirname + srcDir；去掉含 node_modules 段的路径。 */
export function watchPaths(graph: ModuleGraph, srcDir: string): string[] {
  const paths = new Set<string>()
  if (!hasNodeModules(srcDir)) {
    paths.add(srcDir)
  }
  for (const node of graph.nodes.values()) {
    if (!node.sourcePath || hasNodeModules(node.sourcePath)) {
      continue
    }
    paths.add(node.sourcePath)
    if (node.kind === 'script') {
      paths.add(dirname(node.sourcePath))
    }
  }
  return [...paths]
}

function hasNodeModules(filePath: string): boolean {
  return filePath.includes(NODE_MODULES_SEG)
}

function isConfigFile(filePath: string): boolean {
  return CONFIG_NAME_SET.has(basename(filePath))
}

/** chokidar 监听 paths，80ms debounce 后按事件类型回调。 */
export async function startWatch(input: {
  paths: string[]
  srcDir: string
  onTick: (batch: { changedIds: string[]; deletedIds: string[]; addedRelPaths: string[] }) => Promise<void>
  onConfigChange: () => Promise<void>
}): Promise<{ close(): Promise<void> }> {
  const watcher = chokidar.watch(input.paths, {
    ignoreInitial: true,
    ignored: /node_modules/,
  })

  const addedRelPaths = new Set<string>()
  const deletedIds = new Set<string>()
  const changedIds = new Set<string>()
  let configChanged = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let closed = false

  const toSrcRel = (absPath: string): string => posixRelative(input.srcDir, absPath)

  const flush = async (): Promise<void> => {
    if (closed || running) {
      return
    }
    running = true
    try {
      while (!closed) {
        const reload = configChanged
        const batch = {
          addedRelPaths: [...addedRelPaths],
          deletedIds: [...deletedIds],
          changedIds: [...changedIds],
        }
        addedRelPaths.clear()
        deletedIds.clear()
        changedIds.clear()
        configChanged = false
        if (reload) {
          await input.onConfigChange()
        } else if (batch.addedRelPaths.length || batch.deletedIds.length || batch.changedIds.length) {
          await input.onTick(batch)
        }
        if (closed || configChanged || addedRelPaths.size || deletedIds.size || changedIds.size) {
          continue
        }
        break
      }
    } finally {
      running = false
    }
  }

  const schedule = (): void => {
    if (closed) {
      return
    }
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, DEBOUNCE_MS)
  }

  watcher.on('add', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      const rel = toSrcRel(filePath)
      deletedIds.delete(rel)
      addedRelPaths.add(rel)
    }
    schedule()
  })
  watcher.on('unlink', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      const rel = toSrcRel(filePath)
      addedRelPaths.delete(rel)
      changedIds.delete(rel)
      deletedIds.add(rel)
    }
    schedule()
  })
  watcher.on('change', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      const rel = toSrcRel(filePath)
      changedIds.add(rel)
    }
    schedule()
  })

  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', () => resolve())
    watcher.once('error', reject)
  })

  return {
    async close() {
      closed = true
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      await watcher.close()
    },
  }
}

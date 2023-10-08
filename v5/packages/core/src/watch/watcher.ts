import { basename, dirname, resolve, sep } from 'node:path'
import chokidar from 'chokidar'
import type { SubProject } from '../config/schema.js'
import { posixJoin, posixRelative } from '../graph/walk.js'
import { projectForPath } from '../resolve/resolver.js'
import type { ModuleGraph } from '../types.js'
import { CONFIG_NAMES } from '../config/load.js'

const NODE_MODULES_SEG = `${sep}node_modules${sep}`
const CONFIG_NAME_SET = new Set<string>(CONFIG_NAMES) // includes mpbuild.config.mjs
const DEBOUNCE_MS = 80

/** 已入图 sourcePath + 每个 script 的 dirname + srcDir + projects[].src；去掉含 node_modules 段的路径。 */
export function watchPaths(
  graph: ModuleGraph,
  srcDir: string,
  projects?: SubProject[],
): string[] {
  const paths = new Set<string>()
  if (!hasNodeModules(srcDir)) {
    paths.add(srcDir)
  }
  for (const project of projects ?? []) {
    if (project.src && !hasNodeModules(project.src)) {
      paths.add(project.src)
    }
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

function shouldReload(filePath: string, reloadFiles: string[] | undefined): boolean {
  if (CONFIG_NAME_SET.has(basename(filePath))) {
    return true
  }
  if (!reloadFiles?.length) {
    return false
  }
  const abs = resolve(filePath)
  return reloadFiles.some((file) => resolve(file) === abs)
}

/** 先按 sourcePath 精确匹配节点 id；否则 intern 子仓库公式，否则相对 srcDir。 */
export function graphIdFromAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): string {
  const abs = resolve(absPath)
  for (const node of graph.nodes.values()) {
    if (node.sourcePath && resolve(node.sourcePath) === abs) {
      return node.id
    }
  }
  const project = projectForPath(abs, projects)
  if (project) {
    return posixJoin(project.name, posixRelative(project.src, abs))
  }
  return posixRelative(srcDir, abs)
}

/** chokidar 监听 paths，80ms debounce 后按事件类型回调。id 走 graphIdFromAbs。 */
export async function startWatch(input: {
  paths: string[]
  srcDir: string
  graph: ModuleGraph
  projects?: SubProject[]
  reloadFiles?: string[]
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

  const toId = (absPath: string): string =>
    graphIdFromAbs(input.graph, absPath, input.srcDir, input.projects)

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
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      const id = toId(filePath)
      deletedIds.delete(id)
      addedRelPaths.add(id)
    }
    schedule()
  })
  watcher.on('unlink', (filePath) => {
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      const id = toId(filePath)
      addedRelPaths.delete(id)
      changedIds.delete(id)
      deletedIds.add(id)
    }
    schedule()
  })
  watcher.on('change', (filePath) => {
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      changedIds.add(toId(filePath))
    }
    schedule()
  })

  await new Promise<void>((resolveReady, reject) => {
    watcher.once('ready', () => resolveReady())
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

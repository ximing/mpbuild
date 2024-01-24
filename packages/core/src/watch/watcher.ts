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

/** 已入图 sourcePath + extraWatchFiles + 每个 script 的 dirname + srcDir + projects[].src；入图 npm 只加该文件，不加 dirname / extraWatchFiles 下的 node_modules。 */
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
    if (!node.sourcePath) {
      continue
    }
    if (hasNodeModules(node.sourcePath)) {
      paths.add(node.sourcePath)
      continue
    }
    paths.add(node.sourcePath)
    if (node.kind === 'script') {
      paths.add(dirname(node.sourcePath))
    }
    for (const extra of node.extraWatchFiles ?? []) {
      if (extra && !hasNodeModules(extra)) {
        paths.add(extra)
      }
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

/** 先按 sourcePath 精确匹配节点 id；再 extraWatchFiles 回所属节点；否则 intern 子仓库公式，否则相对 srcDir。 */
export function graphIdFromAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): string {
  return classifyAbs(graph, absPath, srcDir, projects).id
}

/** extra: 命中 extraWatchFiles 且不是任何节点的 sourcePath。 */
function classifyAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): { id: string; extra: boolean } {
  const abs = resolve(absPath)
  let extraOwner: string | undefined
  for (const node of graph.nodes.values()) {
    if (node.sourcePath && resolve(node.sourcePath) === abs) {
      return { id: node.id, extra: false }
    }
    if (extraOwner === undefined) {
      for (const extra of node.extraWatchFiles ?? []) {
        if (extra && resolve(extra) === abs) {
          extraOwner = node.id
          break
        }
      }
    }
  }
  if (extraOwner !== undefined) {
    return { id: extraOwner, extra: true }
  }
  const project = projectForPath(abs, projects)
  if (project) {
    return { id: posixJoin(project.name, posixRelative(project.src, abs)), extra: false }
  }
  return { id: posixRelative(srcDir, abs), extra: false }
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
  const keepNpm = new Set(
    input.paths.filter((p) => p.includes(NODE_MODULES_SEG) || p.includes('/node_modules/')).map((p) => resolve(p)),
  )
  const watcher = chokidar.watch(input.paths, {
    ignoreInitial: true,
    ignored: (filePath: string) => {
      const abs = resolve(filePath)
      if (keepNpm.has(abs)) {
        return false
      }
      for (const keep of keepNpm) {
        if (keep === abs || keep.startsWith(`${abs}${sep}`)) {
          return false
        }
      }
      return /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filePath)
    },
  })

  const addedRelPaths = new Set<string>()
  const deletedIds = new Set<string>()
  const changedIds = new Set<string>()
  let configChanged = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let closed = false

  const classify = (absPath: string) =>
    classifyAbs(input.graph, absPath, input.srcDir, input.projects)

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
      const { id, extra } = classify(filePath)
      if (extra) {
        changedIds.add(id)
      } else if (input.graph.nodes.has(id)) {
        deletedIds.delete(id)
        changedIds.add(id)
      } else {
        deletedIds.delete(id)
        addedRelPaths.add(id)
      }
    }
    schedule()
  })
  watcher.on('unlink', (filePath) => {
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      const { id, extra } = classify(filePath)
      if (extra) {
        changedIds.add(id)
      } else {
        addedRelPaths.delete(id)
        changedIds.delete(id)
        deletedIds.add(id)
      }
    }
    schedule()
  })
  watcher.on('change', (filePath) => {
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      changedIds.add(classify(filePath).id)
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

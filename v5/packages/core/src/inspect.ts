import { isAbsolute, relative, sep } from 'node:path'
import type { ModuleGraph } from './types.js'

/** 每节点一行：id、owner、出边 raw→to。绝对路径打成相对 cwd 的 posix 形式。 */
export function formatGraphInspect(graph: ModuleGraph): string {
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const dep = `${edge.raw}→${displayId(edge.to)}`
    const list = outgoing.get(edge.from)
    if (list) {
      list.push(dep)
    } else {
      outgoing.set(edge.from, [dep])
    }
  }
  for (const list of outgoing.values()) {
    list.sort()
  }

  const ids = [...graph.nodes.keys()].sort()
  return ids
    .map((id) => {
      const owner = graph.nodes.get(id)?.owner ?? ''
      const deps = outgoing.get(id) ?? []
      return `${displayId(id)}\towner=${owner}\tdeps=${deps.join(',')}`
    })
    .join('\n')
}

function displayId(id: string): string {
  if (!isAbsolute(id)) {
    return id
  }
  return relative(process.cwd(), id).split(sep).join('/')
}

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Diagnostic } from '../diagnostic/index.js'
import type { ModuleGraph, OutputPlan } from '../types.js'
import { rewriteCode } from './rewrite.js'
import { transformModule } from './transform.js'

/** 按 placement 写出；clean 时整目录重建。不改 graph/plan。 */
export async function emitPlan(input: {
  graph: ModuleGraph
  plan: OutputPlan
  outputDir: string
  clean: boolean
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
}): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = []
  if (input.clean) {
    await rm(input.outputDir, { recursive: true, force: true })
  }
  await mkdir(input.outputDir, { recursive: true })

  for (const placement of input.plan.placements) {
    const node = input.graph.nodes.get(placement.moduleId)
    if (!node || node.virtual || node.sourcePath === '') {
      continue
    }
    const source = await readFile(node.sourcePath, 'utf8')
    const { code } = transformModule({
      kind: node.kind,
      sourcePath: node.sourcePath,
      code: source,
      js: input.js,
    })
    const rewritten = rewriteCode({
      moduleId: node.id,
      kind: node.kind,
      code,
      placement,
      plan: input.plan,
    })
    await mkdir(dirname(placement.destPath), { recursive: true })
    await writeFile(placement.destPath, rewritten)
  }

  return diagnostics
}

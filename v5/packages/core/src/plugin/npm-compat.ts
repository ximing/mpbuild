import { transformModule } from '../compile/transform.js'
import type { Diagnostic } from '../diagnostic/index.js'
import type { AbstractKind } from '../types.js'

export function isNodeModulesPath(filePath: string): boolean {
  return /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filePath)
}

/** weapp：对 node_modules 内 script 做一次与 compile.js 相同的 SWC。不处理 require('fs')。 */
export function npmCompat(input: {
  kind: AbstractKind
  sourcePath: string
  code: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
}): { code: string; diagnostics?: Diagnostic[] } {
  if (input.kind !== 'script' || !isNodeModulesPath(input.sourcePath)) {
    return { code: input.code }
  }
  return transformModule(input)
}

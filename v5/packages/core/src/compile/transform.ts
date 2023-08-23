import { transformSync } from '@swc/core'
import { transform as transformCss } from 'lightningcss'
import { extname } from 'node:path'
import type { AbstractKind } from '../types.js'

/** 按 kind 变换源码。不写入 destPath / owner。 */
export function transformModule(input: {
  kind: AbstractKind
  sourcePath: string
  code: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  minify?: boolean
}): { code: string } {
  const minify = input.minify ?? false
  switch (input.kind) {
    case 'script':
    case 'script-module': {
      const { kind, sourcePath, code, js } = input
      return { code: transformScript({ kind, sourcePath, code, js }, minify) }
    }
    case 'style':
      return { code: transformStyle(input, minify) }
    case 'json':
      return { code: transformJson(input.code, minify) }
    case 'template':
    case 'asset':
      return { code: input.code }
  }
}

/** SWC：.ts/.tsx 走 typescript，script-module 固定 es2015 且不开 JSX。 */
function transformScript(
  input: {
    kind: 'script' | 'script-module'
    sourcePath: string
    code: string
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  },
  minify: boolean,
): string {
  const ext = extname(input.sourcePath).toLowerCase()
  const isTs = ext === '.ts' || ext === '.tsx'
  const jsx = input.kind === 'script' && (ext === '.tsx' || ext === '.jsx')
  const result = transformSync(input.code, {
    filename: input.sourcePath,
    jsc: {
      parser: isTs
        ? { syntax: 'typescript', tsx: jsx }
        : { syntax: 'ecmascript', jsx },
      target: input.kind === 'script-module' ? 'es2015' : input.js.target,
    },
    module: {
      type: input.js.module === 'es6' ? 'es6' : 'commonjs',
    },
    minify,
  })
  return result.code
}

function transformStyle(
  input: { sourcePath: string; code: string },
  minify: boolean,
): string {
  const result = transformCss({
    filename: input.sourcePath,
    code: Buffer.from(input.code),
    minify,
  })
  return Buffer.from(result.code).toString('utf8')
}

function transformJson(code: string, minify: boolean): string {
  const data: unknown = JSON.parse(code)
  return minify ? JSON.stringify(data) : JSON.stringify(data, null, 2)
}

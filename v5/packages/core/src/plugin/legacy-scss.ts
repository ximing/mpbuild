import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import postcss from 'postcss'
import advancedVariables from '@yeanzhi/postcss-advanced-variables'
import postcssNested from 'postcss-nested'
import postcssScss from 'postcss-scss'
import { diagnostic } from '../diagnostic/index.js'
import type { Plugin, PluginLoadContext } from '../types.js'

/** 金样类 SCSS：postcss-scss + advanced-variables(mixin) + nested。 */
export function legacyScss(): Plugin {
  return {
    name: 'legacy-scss',
    async load(id, ctx) {
      if (!isStyleModule(id, ctx)) {
        return
      }
      try {
        const from = ctx.sourcePath || id
        const result = await postcss([
          advancedVariables({
            variables: {},
            importFilter: (importId: string) => importId.includes('mixin'),
            importResolve: async (importId: string, cwd: string) => {
              const file = resolve(cwd || dirname(from), importId)
              if (!file.includes('mixin') || !existsSync(file)) {
                return
              }
              ctx.addWatchFile(file)
              return { file, contents: readFileSync(file, 'utf8') }
            },
          }),
          postcssNested({ bubble: ['keyframes'] }),
        ]).process(ctx.code, {
          parser: postcssScss,
          from,
        })
        return result.css
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.error(
          diagnostic({
            code: 'UNSUPPORTED_PREPROCESSOR',
            severity: 'error',
            message: `UNSUPPORTED_PREPROCESSOR: ${message}`,
            file: ctx.sourcePath || id,
          }),
        )
      }
    },
  }
}

function isStyleModule(id: string, ctx: PluginLoadContext): boolean {
  if (ctx.kind === 'style') {
    return true
  }
  const exts = ctx.adapter.sourceExts.style ?? []
  return exts.some((ext) => id.endsWith(ext) || ctx.sourcePath.endsWith(ext))
}

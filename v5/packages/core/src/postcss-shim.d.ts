declare module '@yeanzhi/postcss-advanced-variables' {
  import type { PluginCreator } from 'postcss'
  const plugin: PluginCreator<{
    variables?: Record<string, unknown>
    importFilter?: (id: string) => boolean
    importResolve?: (
      id: string,
      cwd: string,
    ) => Promise<{ file: string; contents: string } | undefined>
  }>
  export default plugin
}

declare module 'postcss-scss' {
  import type { Parser } from 'postcss'
  const parser: Parser
  export default parser
}

declare module 'postcss-nested' {
  import type { PluginCreator } from 'postcss'
  const plugin: PluginCreator<{ bubble?: string[] }>
  export default plugin
}

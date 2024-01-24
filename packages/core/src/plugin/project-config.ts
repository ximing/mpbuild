import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { Plugin } from '../types.js'

/** 若 dest 已有 adapter.projectConfigFile 则不覆盖。 */
export function projectConfig(opts: {
  projectname: string
  appId: string
  setting?: Record<string, unknown>
}): Plugin {
  return {
    name: 'project-config',
    generate(file, ctx) {
      const destPath = file.destPath
      if (basename(destPath) !== ctx.adapter.projectConfigFile) {
        return
      }
      if (existsSync(destPath)) {
        return
      }
      const json = {
        description: '项目配置文件',
        packOptions: { ignore: [] as unknown[] },
        setting: {
          urlCheck: false,
          es6: false,
          postcss: true,
          minified: false,
          ...opts.setting,
        },
        compileType: 'miniprogram',
        appid: opts.appId,
        projectname: opts.projectname,
      }
      return { destPath, content: `${JSON.stringify(json, null, 2)}\n` }
    },
  }
}

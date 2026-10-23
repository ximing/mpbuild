// in-repo 相对 dist；生产用户 `import { defineConfig, legacyScss, projectConfig, copy } from '@mpbuild/core'`
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, legacyScss, projectConfig, copy } from '../../packages/core/dist/index.js'

const root = dirname(fileURLToPath(import.meta.url))
const extra = join(root, 'projects/extra')

export default defineConfig({
  entry: './entry.js',
  src: join(root, 'src'),
  platform: 'wx',
  output: { dir: 'dist' },
  resolve: {
    alias: {
      // router 从主包 app.js 解析，只命中全局 alias
      '@extra': extra,
      '@utils': join(root, 'src/utils'),
    },
  },
  projects: [
    {
      name: '@extra',
      src: extra,
      alias: { '@extra': extra },
    },
  ],
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'coverage', appId: 'touristappid' }),
    copy(['src/assets/icon.png']),
  ],
})

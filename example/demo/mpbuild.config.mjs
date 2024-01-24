// in-repo 相对 dist；生产用户 `import { defineConfig, legacyScss, projectConfig } from '@mpbuild/core'`
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, legacyScss, projectConfig } from '../../packages/core/dist/index.js'

const root = dirname(fileURLToPath(import.meta.url))
const one = join(root, '../projects/one')
const two = join(root, '../projects/two')

export default defineConfig({
  entry: './entry.js',
  src: join(root, 'src'),
  platform: 'wx',
  output: { dir: 'dist-v5', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {
      '@one': one,
      '@two': two,
      '@utils': join(root, 'src/utils'),
      '@root': join(root, 'src'),
      '@components': join(root, 'src/components'),
      '@/': ({ importer }) => {
        if (importer.startsWith(one)) {
          return one
        }
        if (importer.startsWith(two)) {
          return two
        }
      },
    },
  },
  projects: [
    {
      name: '@one',
      src: one,
      alias: {
        '@one': one,
        '@two-b': join(two, 'utils/b.js'),
      },
    },
    { name: '@two', src: two, alias: { '@two': two } },
  ],
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'test', appId: 'test', setting: { minified: true } }),
  ],
})

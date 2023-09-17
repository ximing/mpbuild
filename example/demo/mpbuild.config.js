/**
 * CJS。不 require core 的 TS 入口；gold 测试直接构造 ResolvedConfig，
 * 并挂 legacyScss / projectConfig。CLI 用 tsx 加载本文件。
 */
const path = require('path')

const one = path.join(__dirname, '../projects/one')
const two = path.join(__dirname, '../projects/two')

module.exports = {
  entry: './entry.js',
  src: path.join(__dirname, 'src'),
  platform: 'wx',
  output: { dir: 'dist-v5', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {
      '@one': one,
      '@two': two,
      '@utils': path.join(__dirname, 'src/utils'),
      '@root': path.join(__dirname, 'src'),
      '@components': path.join(__dirname, 'src/components'),
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
        '@two-b': path.join(two, 'utils/b.js'),
      },
    },
    { name: '@two', src: two, alias: { '@two': two } },
  ],
}

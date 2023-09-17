import { EdgeKinds, type TargetAdapter } from '../types.js'

export const weappAdapter: TargetAdapter = {
  id: 'weapp',
  ifdefToken: 'wx',
  suite: {
    script: 'script',
    json: 'json',
    template: 'template',
    style: 'style',
    scriptModule: 'script-module',
  },
  sourceExts: {
    script: ['.ts', '.js', '.tsx', '.jsx'],
    json: ['.config.js', '.json'],
    template: ['.wxml'],
    style: ['.wxss', '.css'],
    'script-module': ['.wxs'],
    asset: [],
  },
  emitExt: {
    script: '.js',
    json: '.json',
    template: '.wxml',
    style: '.wxss',
    'script-module': '.wxs',
    asset: '',
  },
  templateTags: [
    { tag: 'import', attr: 'src', edge: EdgeKinds.templateImport },
    { tag: 'include', attr: 'src', edge: EdgeKinds.templateInclude },
    { tag: 'wxs', attr: 'src', edge: EdgeKinds.scriptModule },
  ],
  jsonPathFields: [
    { path: 'usingComponents.*', edge: EdgeKinds.usingComponent, value: 'path' },
    { path: 'componentGenerics.*', edge: EdgeKinds.usingComponent, value: 'name-or-path' },
  ],
  projectConfigFile: 'project.config.json',
  appJson: { pages: 'pages', subPackages: 'subPackages' },
  npmPackageFields: ['miniprogram', 'browser', 'main', 'module'],
  sizeLimits: { mainKb: 2048, subKb: 2048, totalKb: 30720 },
  npmCompat: 'weapp',
  externalSpecifiers: /^(plugin:|https?:|data:|wxfile:|\/\/)/,
  independentEdge: 'error',
}

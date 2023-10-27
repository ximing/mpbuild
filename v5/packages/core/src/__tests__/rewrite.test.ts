import { describe, expect, it } from 'vitest'
import { rewriteCode } from '../index'
import type { OutputPlan, Placement, Rewrite } from '../index'

function planOf(placements: Placement[], rewrites: Rewrite[]): OutputPlan {
  return { placements, rewrites }
}

const pageJs: Placement = {
  moduleId: 'pages/index/index.js',
  destPath: 'dist/pages/index/index.js',
  package: 'main',
}

const libJs: Placement = {
  moduleId: 'lib.js',
  destPath: 'dist/pages/index/lib.js',
  package: 'main',
}

describe('rewriteCode', () => {
  it('rewrites require("./lib") to a dest-relative ./lib.js', () => {
    const plan = planOf(
      [pageJs, libJs],
      [
        {
          from: 'pages/index/index.js',
          raw: './lib',
          destSpecifier: 'lib.js',
          placementPackage: 'main',
        },
      ],
    )
    const code = rewriteCode({
      moduleId: 'pages/index/index.js',
      kind: 'script',
      code: `require('./lib');\n`,
      placement: pageJs,
      plan,
    })
    expect(code).toBe(`require('./lib.js');\n`)
  })

  it('keeps plugin:// in script require', () => {
    const plan = planOf([pageJs], [
      {
        from: 'pages/index/index.js',
        raw: 'plugin://x/y',
        destSpecifier: 'plugin://x/y',
        placementPackage: 'main',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.js',
      kind: 'script',
      code: `require('plugin://x/y');\n`,
      placement: pageJs,
      plan,
    })
    expect(code).toContain('plugin://x/y')
    expect(code).toBe(`require('plugin://x/y');\n`)
  })

  it('keeps plugin:// at json rewritePath /usingComponents/x', () => {
    const jsonPlacement: Placement = {
      moduleId: 'pages/index/index.json',
      destPath: 'dist/pages/index/index.json',
      package: 'main',
    }
    const plan = planOf([jsonPlacement], [
      {
        from: 'pages/index/index.json',
        raw: 'plugin://x/y',
        destSpecifier: 'plugin://x/y',
        placementPackage: 'main',
        rewritePath: '/usingComponents/x',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.json',
      kind: 'json',
      code: `{"usingComponents":{"x":"plugin://x/y"}}`,
      placement: jsonPlacement,
      plan,
    })
    expect(JSON.parse(code).usingComponents.x).toBe('plugin://x/y')
    expect(code).toContain('plugin://x/y')
  })

  it('writes dest-relative specifier at json rewritePath when componentRelative', () => {
    const jsonPlacement: Placement = {
      moduleId: 'pages/index/index.json',
      destPath: 'dist/pages/index/index.json',
      package: 'main',
    }
    const comp: Placement = {
      moduleId: 'components/comp.js',
      destPath: 'dist/components/comp.js',
      package: 'main',
    }
    const plan = planOf([jsonPlacement, comp], [
      {
        from: 'pages/index/index.json',
        raw: '/components/comp',
        destSpecifier: 'components/comp.js',
        placementPackage: 'main',
        rewritePath: '/usingComponents/x',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.json',
      kind: 'json',
      code: `{"usingComponents":{"x":"/components/comp"}}`,
      placement: jsonPlacement,
      plan,
    })
    const value = JSON.parse(code).usingComponents.x as string
    expect(value.startsWith('./') || value.startsWith('../')).toBe(true)
    expect(value).toBe('../../components/comp.js')
  })

  it('rewrites json paths from outputDir with a leading slash when componentRelative is false', () => {
    const jsonPlacement: Placement = {
      moduleId: 'pages/index/index.json',
      destPath: 'dist/pages/index/index.json',
      package: 'main',
    }
    const comp: Placement = {
      moduleId: 'components/comp.js',
      destPath: 'dist/components/comp.js',
      package: 'main',
    }
    const plan = planOf([jsonPlacement, comp], [
      {
        from: 'pages/index/index.json',
        raw: '/components/comp',
        destSpecifier: 'components/comp.js',
        placementPackage: 'main',
        rewritePath: '/usingComponents/x',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.json',
      kind: 'json',
      code: `{"usingComponents":{"x":"/components/comp"}}`,
      placement: jsonPlacement,
      plan,
      componentRelative: false,
      outputDir: 'dist',
    })
    expect(JSON.parse(code).usingComponents.x).toBe('/components/comp.js')
  })

  it('replaces template quoted attribute values without serializing the tree', () => {
    const tpl: Placement = {
      moduleId: 'pages/index/index.wxml',
      destPath: 'dist/pages/index/index.wxml',
      package: 'main',
    }
    const part: Placement = {
      moduleId: 'tpl/a.wxml',
      destPath: 'dist/tpl/a.wxml',
      package: 'main',
    }
    const plan = planOf([tpl, part], [
      {
        from: 'pages/index/index.wxml',
        raw: './a.wxml',
        destSpecifier: 'tpl/a.wxml',
        placementPackage: 'main',
      },
    ])
    const src = `<view>\n  <import src="./a.wxml"/>\n</view>\n`
    const code = rewriteCode({
      moduleId: 'pages/index/index.wxml',
      kind: 'template',
      code: src,
      placement: tpl,
      plan,
    })
    expect(code).toBe(`<view>\n  <import src="../../tpl/a.wxml"/>\n</view>\n`)
  })

  it('rewrites quoted specifier inside style @import', () => {
    const style: Placement = {
      moduleId: 'pages/index/index.wxss',
      destPath: 'dist/pages/index/index.wxss',
      package: 'main',
    }
    const mix: Placement = {
      moduleId: 'wxss/mix.wxss',
      destPath: 'dist/wxss/mix.wxss',
      package: 'main',
    }
    const plan = planOf([style, mix], [
      {
        from: 'pages/index/index.wxss',
        raw: './mix.wxss',
        destSpecifier: 'wxss/mix.wxss',
        placementPackage: 'main',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.wxss',
      kind: 'style',
      code: `@import "./mix.wxss";\n`,
      placement: style,
      plan,
    })
    expect(code).toBe(`@import "../../wxss/mix.wxss";\n`)
  })

  it('returns original code when the module has no rewrite', () => {
    const src = `require('./lib');\n`
    const code = rewriteCode({
      moduleId: 'pages/index/index.js',
      kind: 'script',
      code: src,
      placement: pageJs,
      plan: planOf([pageJs, libJs], []),
    })
    expect(code).toBe(src)
  })

  it('picks the same-package dest when a module is duplicated', () => {
    const fromA: Placement = {
      moduleId: 'pkgA/a.js',
      destPath: 'dist/pkgA/a.js',
      package: 'pkgA',
    }
    const libA: Placement = {
      moduleId: 'lib.js',
      destPath: 'dist/pkgA/lib.js',
      package: 'pkgA',
    }
    const libB: Placement = {
      moduleId: 'lib.js',
      destPath: 'dist/pkgB/lib.js',
      package: 'pkgB',
    }
    const plan = planOf([fromA, libA, libB], [
      {
        from: 'pkgA/a.js',
        raw: './lib',
        destSpecifier: 'lib.js',
        placementPackage: 'pkgA',
      },
      {
        from: 'pkgA/a.js',
        raw: './lib',
        destSpecifier: 'lib.js',
        placementPackage: 'pkgB',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pkgA/a.js',
      kind: 'script',
      code: `require('./lib');\n`,
      placement: fromA,
      plan,
    })
    expect(code).toBe(`require('./lib.js');\n`)
  })

  it('does not replace a longer quoted specifier that only starts with raw', () => {
    const plan = planOf(
      [pageJs, libJs],
      [
        {
          from: 'pages/index/index.js',
          raw: './lib',
          destSpecifier: 'lib.js',
          placementPackage: 'main',
        },
      ],
    )
    const src = `require('./lib/extra');\n`
    const code = rewriteCode({
      moduleId: 'pages/index/index.js',
      kind: 'script',
      code: src,
      placement: pageJs,
      plan,
    })
    expect(code).toBe(src)
  })

  it('rewrites script-module quoted specifiers the same way', () => {
    const wxs: Placement = {
      moduleId: 'pages/index/index.wxs',
      destPath: 'dist/pages/index/index.wxs',
      package: 'main',
    }
    const helper: Placement = {
      moduleId: 'pages/index/help.wxs',
      destPath: 'dist/pages/index/help.wxs',
      package: 'main',
    }
    const plan = planOf([wxs, helper], [
      {
        from: 'pages/index/index.wxs',
        raw: './help',
        destSpecifier: 'pages/index/help.wxs',
        placementPackage: 'main',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.wxs',
      kind: 'script-module',
      code: `require('./help');\n`,
      placement: wxs,
      plan,
    })
    expect(code).toBe(`require('./help.wxs');\n`)
  })
})

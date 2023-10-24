import { describe, expect, it } from 'vitest'
import { transformModule } from '../index'

const js = { target: 'es2018', module: 'commonjs' } as const

describe('transformModule', () => {
  it('strips typescript types via swc', () => {
    const { code } = transformModule({
      kind: 'script',
      sourcePath: '/x.ts',
      code: 'export const n: number = 1\n',
      js: { target: 'es2018', module: 'commonjs' },
    })
    expect(code).not.toContain('number')
    expect(code).toContain('exports')
  })

  it('minifies neither style nor json in P1 default', () => {
    const { code } = transformModule({
      kind: 'style',
      sourcePath: '/a.wxss',
      code: '.a { color: red; }\n',
      js: { target: 'es2018', module: 'commonjs' },
    })
    expect(code).toContain('color')

    const json = transformModule({
      kind: 'json',
      sourcePath: '/a.json',
      code: '{"a":1}',
      js,
    })
    expect(json.code).toBe(JSON.stringify({ a: 1 }, null, 2))
  })

  it('emits es6 when js.module is es6', () => {
    const { code } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'export const n = 1\n',
      js: { target: 'es2018', module: 'es6' },
    })
    expect(code).toContain('export')
    expect(code).not.toContain('exports')
  })

  it('keeps script-module at es2015 even if js.target is es5', () => {
    const { code } = transformModule({
      kind: 'script-module',
      sourcePath: '/a.wxs',
      code: 'var x = () => 1\n',
      js: { target: 'es5', module: 'commonjs' },
    })
    expect(code).toContain('=>')
  })

  it('pretty-prints json by default and strips whitespace when minify', () => {
    const src = '{"a":1}'
    const pretty = transformModule({
      kind: 'json',
      sourcePath: '/a.json',
      code: src,
      js,
    })
    expect(pretty.code).toBe('{\n  "a": 1\n}')

    const min = transformModule({
      kind: 'json',
      sourcePath: '/a.json',
      code: src,
      js,
      minify: true,
    })
    expect(min.code).toBe('{"a":1}')
  })

  it('returns template and asset code unchanged', () => {
    const tpl = '<view>{{n}}</view>\n'
    expect(
      transformModule({
        kind: 'template',
        sourcePath: '/a.wxml',
        code: tpl,
        js,
      }).code,
    ).toBe(tpl)

    const bytes = 'not-a-real-png'
    expect(
      transformModule({
        kind: 'asset',
        sourcePath: '/a.png',
        code: bytes,
        js,
      }).code,
    ).toBe(bytes)
  })

  it('does not write destPath or owner into transformed code', () => {
    const { code } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'var a = 1\n',
      js,
    })
    expect(code).not.toContain('destPath')
    expect(code).not.toContain('owner')
  })

  it('records TRANSFORM_FAIL warning when lightningcss rejects style', () => {
    const result = transformModule({
      kind: 'style',
      sourcePath: '/a.wxss',
      code: '.a { color: }',
      js,
    })
    expect(result.code).toContain('.a')
    expect(result.diagnostics?.some((d) => d.code === 'TRANSFORM_FAIL' && d.severity === 'warning')).toBe(
      true,
    )
  })

  it('throws or returns TRANSFORM_FAIL error diagnostics for invalid js', () => {
    expect(() =>
      transformModule({
        kind: 'script',
        sourcePath: '/a.js',
        code: 'const x = {',
        js,
      }),
    ).toThrow()
  })

  it('returns a source map for script when not minifying', () => {
    const { code, map } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'export const n = 1\n',
      js: { target: 'es2018', module: 'commonjs' },
      minify: false,
    })
    expect(code).toContain('exports')
    expect(typeof map).toBe('string')
    expect(map).toContain('"version"')
  })

  it('does not return a source map when minify is true', () => {
    const { map } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'export const n = 1\n',
      js: { target: 'es2018', module: 'commonjs' },
      minify: true,
    })
    expect(map).toBeUndefined()
  })
})

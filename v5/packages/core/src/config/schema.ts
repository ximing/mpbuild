import { z } from 'zod'
import type { TargetAdapter } from '../types.js'

function isTargetAdapter(value: unknown): value is TargetAdapter {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
}

const outputSchema = z
  .object({
    dir: z.string().default('dist'),
    npm: z.string().default('npm'),
    clean: z.boolean().default(true),
    componentRelative: z.boolean().default(true),
  })
  .default({ dir: 'dist', npm: 'npm', clean: true, componentRelative: true })

const resolveSchema = z
  .object({
    alias: z.record(z.string(), z.string()).default({}),
    extensions: z.record(z.string(), z.array(z.string())).optional(),
  })
  .default({ alias: {} })

const compileSchema = z
  .object({
    js: z
      .object({
        target: z.enum(['es5', 'es2018', 'es2020']).default('es2018'),
        module: z.enum(['commonjs', 'es6']).default('commonjs'),
      })
      .default({ target: 'es2018', module: 'commonjs' }),
    css: z
      .object({
        lightningcss: z.boolean().default(true),
      })
      .default({ lightningcss: true }),
    minify: z.union([z.boolean(), z.record(z.string(), z.boolean())]).default(false),
  })
  .default({
    js: { target: 'es2018', module: 'commonjs' },
    css: { lightningcss: true },
    minify: false,
  })

const subPackageSchema = z
  .object({
    shared: z.enum(['duplicate', 'main']).default('duplicate'),
  })
  .default({ shared: 'duplicate' })

export const userConfigSchema = z.object({
  src: z.string().default('src'),
  entry: z.union([z.string(), z.record(z.string(), z.unknown())]),
  target: z.union([z.string(), z.custom<TargetAdapter>(isTargetAdapter)]).default('weapp'),
  platform: z.string().optional(),
  output: outputSchema,
  resolve: resolveSchema,
  compile: compileSchema,
  subPackage: subPackageSchema,
})

export interface ResolvedConfig {
  rootDir: string
  src: string
  target: TargetAdapter
  platform?: string
  entry: string | Record<string, unknown>
  output: { dir: string; npm: string; clean: boolean; componentRelative: boolean }
  resolve: { alias: Record<string, string>; extensions: TargetAdapter['sourceExts'] }
  compile: {
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
    css: { lightningcss: boolean }
    minify: boolean | Record<string, boolean>
  }
  subPackage: { shared: 'duplicate' | 'main' }
  configPath: string
}

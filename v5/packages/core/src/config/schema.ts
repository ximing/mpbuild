import { z } from 'zod'
import type { Plugin, TargetAdapter } from '../types.js'

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

export type AliasValue = string | ((ctx: { importer: string; request: string }) => string | undefined)

export interface SubProject {
  name: string
  src: string
  alias: Record<string, string>
}

export interface AppEntry {
  router?: Array<{ root: string; pages: Record<string, string>; independent?: boolean; [k: string]: unknown }>
  pages?: string[]
  subPackages?: Array<{ root: string; pages: string[]; independent?: boolean; [k: string]: unknown }>
  usingComponents?: Record<string, string>
  [k: string]: unknown
}

const aliasValueSchema = z.union([z.string(), z.function()])

const resolveSchema = z
  .object({
    alias: z.record(z.string(), aliasValueSchema).default({}),
    extensions: z.record(z.string(), z.array(z.string())).optional(),
  })
  .default({ alias: {} })

const subProjectSchema = z.object({
  name: z.string(),
  src: z.string(),
  alias: z.record(z.string(), z.string()).default({}),
})

const ifdefSchema = z
  .object({
    tokens: z.record(z.string(), z.union([z.boolean(), z.string()])).default({}),
    blockcode: z.boolean().default(true),
  })
  .default({ tokens: {}, blockcode: true })

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
  projects: z.array(subProjectSchema).default([]),
  ifdef: ifdefSchema,
  plugins: z.array(z.any()).optional(),
})

export interface ResolvedConfig {
  rootDir: string
  src: string
  target: TargetAdapter
  platform?: string
  entry: string | Record<string, unknown>
  output: { dir: string; npm: string; clean: boolean; componentRelative: boolean }
  resolve: { alias: Record<string, AliasValue>; extensions: TargetAdapter['sourceExts'] }
  compile: {
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
    css: { lightningcss: boolean }
    minify: boolean | Record<string, boolean>
  }
  subPackage: { shared: 'duplicate' | 'main' }
  projects: SubProject[]
  ifdef: { tokens: Record<string, boolean | string>; blockcode: boolean }
  appEntry: AppEntry
  configPath: string
  plugins?: Plugin[]
}

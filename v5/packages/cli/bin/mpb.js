#!/usr/bin/env node
import { register } from 'tsx/esm/api'

register()
const { run } = await import('../src/index.ts')
await run()

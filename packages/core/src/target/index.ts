import type { TargetAdapter } from '../types.js'
import { weappAdapter } from './weapp.js'

export { weappAdapter }

export function getTargetAdapter(id: string): TargetAdapter {
  if (id === 'weapp') {
    return weappAdapter
  }
  const error = Object.assign(new Error(`UNKNOWN_TARGET: ${id}`), {
    code: 'UNKNOWN_TARGET',
  })
  throw error
}

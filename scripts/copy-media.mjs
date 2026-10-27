import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const name of ['img', 'gif']) {
  const source = resolve(root, 'media', name)
  const target = resolve(root, 'frontend', 'public', name)
  if (!existsSync(source)) throw new Error(`Missing media directory: ${source}`)
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
}

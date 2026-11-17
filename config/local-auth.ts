import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function readLocalTestToken() {
  if (process.env.MARKET_API_TEST_TOKEN) return process.env.MARKET_API_TEST_TOKEN.trim()
  try {
    const content = readFileSync(resolve('.env.local'), 'utf8')
    const value = content.match(/^MARKET_API_TEST_TOKEN=(.*)$/m)?.[1]?.trim() || ''
    return value.replace(/^(['"])(.*)\1$/, '$2')
  } catch { return '' }
}

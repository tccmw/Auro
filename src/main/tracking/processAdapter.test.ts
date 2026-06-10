import { describe, expect, it } from 'vitest'
import { EmptyProcessAdapter, parseActiveProcessName } from './processAdapter'

describe('processAdapter', () => {
  it('parses the first non-empty foreground process name from stdout', () => {
    expect(parseActiveProcessName('\r\nCode\r\n')).toBe('Code')
    expect(parseActiveProcessName('   chrome   \nexplorer\n')).toBe('chrome')
  })

  it('returns null when foreground process output is empty', () => {
    expect(parseActiveProcessName(' \r\n')).toBeNull()
  })

  it('uses a no-op provider on unsupported platforms', async () => {
    await expect(new EmptyProcessAdapter().getActiveProcessName()).resolves.toBeNull()
  })
})

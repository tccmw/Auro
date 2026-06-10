import { describe, expect, it } from 'vitest'
import {
  assertSafeWindowsProcessName,
  createWindowsTerminateProcessArguments,
  EmptyProcessAdapter,
  parseActiveProcessName
} from './processAdapter'

describe('processAdapter', () => {
  it('parses the first non-empty foreground process name from stdout', () => {
    expect(parseActiveProcessName('\r\nCode\r\n')).toBe('Code')
    expect(parseActiveProcessName('   chrome   \nexplorer\n')).toBe('chrome')
  })

  it('returns null when foreground process output is empty', () => {
    expect(parseActiveProcessName(' \r\n')).toBeNull()
  })

  it('uses a no-op foreground provider on unsupported platforms', async () => {
    await expect(new EmptyProcessAdapter().getActiveProcessName()).resolves.toBeNull()
  })

  it('passes process names as arguments instead of interpolating them into PowerShell scripts', () => {
    const args = createWindowsTerminateProcessArguments('chrome')

    expect(args).toContain('-NonInteractive')
    expect(args[args.length - 1]).toBe('chrome')
    expect(args.slice(0, -1).join(' ')).not.toContain('chrome')
    expect(args.join(' ')).toContain('taskkill.exe /PID')
  })

  it('rejects wildcard process names for termination', () => {
    expect(() => assertSafeWindowsProcessName('chrome')).not.toThrow()
    expect(() => assertSafeWindowsProcessName('chrome*')).toThrow('Invalid process name')
    expect(() => assertSafeWindowsProcessName('')).toThrow('Invalid process name')
  })
})

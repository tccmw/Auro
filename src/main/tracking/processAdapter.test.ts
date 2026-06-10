import { describe, expect, it } from 'vitest'
import {
  assertSafeWindowsProcessName,
  createWindowsTerminateProcessArguments
} from './processAdapter'

describe('processAdapter', () => {
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

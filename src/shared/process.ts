export function normalizeProcessName(processName: string): string {
  const basename = processName.trim().split(/[\\/]/).pop() ?? ''
  return basename.toLowerCase().replace(/\.exe$/i, '')
}

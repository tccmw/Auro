import { normalizeProcessName } from '../../shared/process'
import type { InstalledAppCandidate, TrackedApp } from '../../shared/types'
import type { TrackedAppInput } from '../stores/usageStore'

export type CandidateIconPresentation =
  | {
      type: 'image'
      src: string
      alt: string
    }
  | {
      type: 'fallback'
      label: string
    }

export function filterInstalledAppCandidates(
  candidates: InstalledAppCandidate[],
  query: string
): InstalledAppCandidate[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return candidates
  }

  return candidates.filter((candidate) => {
    return [
      candidate.name,
      candidate.processName ?? '',
      candidate.publisher ?? '',
      candidate.executablePath ?? '',
      candidate.source,
      candidate.reason ?? ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
    })
}

export function getRegisteredAppForCandidate(
  candidate: InstalledAppCandidate,
  trackedApps: TrackedApp[]
): TrackedApp | undefined {
  if (!candidate.processName) {
    return undefined
  }

  const candidateProcessName = normalizeProcessName(candidate.processName)

  return trackedApps.find((app) => normalizeProcessName(app.processName) === candidateProcessName)
}

export function isCandidateRegistered(
  candidate: InstalledAppCandidate,
  trackedApps: TrackedApp[]
): boolean {
  return getRegisteredAppForCandidate(candidate, trackedApps) !== undefined
}

export function sortInstalledAppCandidates(
  candidates: InstalledAppCandidate[],
  trackedApps: TrackedApp[],
  selectedIds: Set<string>
): InstalledAppCandidate[] {
  const rankCandidate = (candidate: InstalledAppCandidate): number => {
    if (isCandidateRegistered(candidate, trackedApps)) {
      return 0
    }

    if (selectedIds.has(candidate.id)) {
      return 1
    }

    return candidate.trackable ? 2 : 3
  }

  return [...candidates].sort((left, right) => {
    const rankDelta = rankCandidate(left) - rankCandidate(right)

    if (rankDelta !== 0) {
      return rankDelta
    }

    return left.name.localeCompare(right.name, 'ko-KR', { sensitivity: 'base' })
  })
}

export function toTrackedAppInputs(
  candidates: InstalledAppCandidate[],
  trackedApps: TrackedApp[],
  dailyLimitMinutes: number,
  notificationEnabled: boolean
): TrackedAppInput[] {
  return candidates
    .filter((candidate) => candidate.trackable && candidate.processName && !isCandidateRegistered(candidate, trackedApps))
    .map((candidate) => {
      const input: TrackedAppInput = {
        name: candidate.name,
        processName: candidate.processName!,
        dailyLimitMinutes,
        notificationEnabled
      }

      if (candidate.iconDataUrl) {
        input.iconDataUrl = candidate.iconDataUrl
      }

      return input
    })
}

export function getCandidateIconPresentation(
  candidate: InstalledAppCandidate
): CandidateIconPresentation {
  if (candidate.iconDataUrl) {
    return {
      type: 'image',
      src: candidate.iconDataUrl,
      alt: `${candidate.name} 아이콘`
    }
  }

  return {
    type: 'fallback',
    label: candidate.name.slice(0, 1).toUpperCase()
  }
}

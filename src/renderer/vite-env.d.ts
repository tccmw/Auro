/// <reference types="vite/client" />

import type { AuroApi } from '../shared/types'

declare global {
  interface Window {
    auroApi?: AuroApi
    limitoApi?: AuroApi
  }
}

export {}

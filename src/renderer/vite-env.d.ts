/// <reference types="vite/client" />

import type { LimitoApi } from '../shared/types'

declare global {
  interface Window {
    limitoApi?: LimitoApi
  }
}

export {}

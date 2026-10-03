/** One plan window as the engine reports it (SessionRateLimit), kept as received. */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'pace-meter': {
      /** The 5-hour and weekly windows from the latest measurement, 5-hour first. */
      limits: Limit[]
      /** Epoch milliseconds the band draws against; a timer moves it every minute. */
      now: number
      /** The Mac's offset from UTC in seconds (+19800 in India), read once at start. */
      offset: number
    }
  }
}

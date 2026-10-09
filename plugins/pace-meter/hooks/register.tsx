// pace-meter: a band above the Claude Code prompt with a pace bar and a forecast
// for the plan's 5-hour and weekly limits.
//
//   5-hour  ██████┃██▋░░░░░░  60%  runs dry at 1:20pm, 1h 40m before the 3:00pm refill
//   weekly  ████▊░░░┃░░░░░░░  30%  on track for about 54% by Mon 2:00pm
//
// The bar fills with the share used; the white post is the clock, how far through
// the window it is. The engine pushes the figures through `session.measure`; a
// one-minute timer moves the clock so the post and the sentence advance while idle.
// Nothing shows until the first reading (a fresh session, or an API key).

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'
import { paceRows, parseOffset } from './pace'

const limitsAtom = atom({ plugin: 'pace-meter', key: 'limits' } as const, [] as Limit[])
const nowAtom = atom({ plugin: 'pace-meter', key: 'now' } as const, 0)
const offsetAtom = atom({ plugin: 'pace-meter', key: 'offset' } as const, 0)

const KINDS = new Set(['five_hour', 'seven_day'])
const keep = (limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): Limit[] =>
  limits.filter(l => KINDS.has(l.kind)).map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    // The sandbox has no time zone; ask the Mac once.
    const zone = await $.process.run(['date', '+%z']).catch(() => undefined)
    const offset = (zone && zone.exitCode === 0 && parseOffset(zone.stdout)) || 0
    await update($, offsetAtom, () => offset)

    // A reload mid-session still has the last reading.
    const usage = await $.session.usage()
    await update($, limitsAtom, () => keep(usage.rateLimits))
    const now = await $.clock.now()
    await update($, nowAtom, () => now)

    $.clock.every(60_000, () => {
      void $.clock.now().then(t => update($, nowAtom, () => t))
    })
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limitsAtom, () => keep(e.rateLimits))
      const now = await $.clock.now()
      await update($, nowAtom, () => now)
    }
    return next(e)
  })

  // The band holds one tree: these rows come first, then whatever the mods beneath drew
  // (a mod that adds a row of its own puts it after what lies beneath it), so the order
  // holds whichever mod loads first.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const rows = paceRows(await read($, limitsAtom), await read($, nowAtom), await read($, offsetAtom))
    const below = await next(e)
    if (rows.length === 0) return below

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Box flexDirection="row">
            {row.runs.map((run, i) => (
              <Text color={run.color} bold={run.bold} wrap={i === row.runs.length - 1 ? 'truncate-end' : 'truncate'}>
                {run.text}
              </Text>
            ))}
          </Box>
        ))}
        {below ? [below] : []}
      </Box>
    )
  })
}

// The arithmetic, pinned row by row. Each expected tail was worked out by hand
// from the two formulas in hooks/pace.ts; the clock is IST (+0530).
import { describe, expect, test } from 'claude-code/testing'

import { paceRow, paceRows, parseOffset, plain } from '../hooks/pace'

const IST = 19800
const NOW = 1790922600      // Fri 02-Oct-2026 12:00 IST
const MON_2PM = 1791189000  // Mon 05-Oct-2026 14:00 IST
const H = 3600
const iso = (sec: number) => new Date(sec * 1000).toISOString()
const row = (kind: string, used: number, resetsAt: number, now = NOW) => {
  const r = paceRow({ kind, percentUsed: used, resetsAt: iso(resetsAt) }, now, IST)
  return r ? plain(r) : null
}

describe('the rows match the status line script', () => {
  test('running dry: the 5-hour row says when, how early, and when it refills', () => {
    expect(row('five_hour', 60, NOW + 3 * H))
      .toBe('5-hour  ██████┃██▋░░░░░░  60%  runs dry at 1:20pm, 1h 40m before the 3:00pm refill')
  })
  test('on track: the weekly row says where it lands and the reset day', () => {
    expect(row('seven_day', 30, MON_2PM))
      .toBe('weekly  ████▊░░░┃░░░░░░░  30%  on track for about 54% by Mon 2:00pm')
  })
  test('exactly 100% at the refill is on track, not dry', () => {
    expect(row('five_hour', 40, NOW + 3 * H))
      .toBe('5-hour  ██████┃░░░░░░░░░  40%  on track for about 100% by 3:00pm')
  })
  test('a run-dry time after midnight carries its day; a same-date refill does not', () => {
    expect(row('five_hour', 30, NOW + 14 * H, NOW + 10 * H))
      .toBe('5-hour  ███┃▊░░░░░░░░░░░  30%  runs dry at Sat 12:20am, 1h 40m before the 2:00am refill')
  })
  test('the widest row there can be is 93 columns (a weekly gap under a day)', () => {
    const at = NOW - 12 * H + 180  // Fri 12:03am
    const r = row('seven_day', 70, at + 60 * H, at)
    expect(r).toBe('weekly  ██████████┃▎░░░░  70%  runs dry at Sat 10:20pm, 13h 42m before the Sun 12:03pm refill')
    expect([...(r ?? '')].length).toBe(93)
  })
  test('under a tenth of the window: too early to tell', () => {
    expect(row('five_hour', 3, NOW + 17400)).toBe('5-hour  ┃░░░░░░░░░░░░░░░   3%  too early to tell · refills 4:50pm')
  })
  test('at the cap', () => {
    expect(row('five_hour', 100, NOW + 3 * H)).toBe('5-hour  ██████┃█████████ 100%  at the cap · refills 3:00pm')
  })
  test('a window already reset shows no stale percentage and no forecast', () => {
    expect(row('five_hour', 64, NOW - 60)).toBe('5-hour  ░░░░░░░░░░░░░░░░   --  refilled · updates after the next reply')
  })
})

describe('colour follows the forecast', () => {
  test('dry is coral, near the cap amber, room to spare mint', () => {
    const word = (used: number, reset: number) => {
      const r = paceRow({ kind: 'five_hour', percentUsed: used, resetsAt: iso(reset) }, NOW, IST)
      return r?.runs[r.runs.length - 1]?.color
    }
    expect(word(60, NOW + 3 * H)).toBe('#FF8A8A')
    expect(word(40, NOW + 3 * H)).toBe('#FFC799')
    expect(word(20, NOW + 3 * H)).toBe('#99FFE4')
  })
})

describe('inputs', () => {
  test('the UTC offset reads from date +%z', () => {
    expect(parseOffset('+0530\n')).toBe(19800)
    expect(parseOffset('-0700')).toBe(-25200)
    expect(parseOffset('garbage')).toBeUndefined()
  })
  test('rows come 5-hour first and skip windows the band does not draw', () => {
    const rows = paceRows([
      { kind: 'seven_day', percentUsed: 30, resetsAt: iso(MON_2PM) },
      { kind: 'spend_limit', percentUsed: 10, resetsAt: iso(NOW + H) },
      { kind: 'five_hour', percentUsed: 60, resetsAt: iso(NOW + 3 * H) },
    ], NOW * 1000, IST)
    expect(rows.map(r => r.kind)).toEqual(['five_hour', 'seven_day'])
  })
  test('no reading yet means no rows', () => {
    expect(paceRows([], NOW * 1000, IST)).toEqual([])
  })
})

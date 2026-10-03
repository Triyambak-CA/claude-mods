// The pace bar and forecast, as plain data. It began as a jq status line script and
// was ported line for line, so both draw the same rows for the same figures
// (tests/pace.test.ts pins those rows).
//
//   at refill = used x window / elapsed      above 100% it runs dry, and when:
//   runs dry  = (100 - used) x elapsed / used  seconds from now
//
// Times are local: the sandbox has no time zone, so callers pass the Mac's UTC
// offset in seconds and every clock is read with UTC getters after adding it.

import type { Limit } from '../types'

export type Run = { text: string; color: string; bold?: boolean }
export type State = 'reset' | 'cap' | 'early' | 'dry' | 'tight' | 'easy'
export type Row = { kind: string; state: State; runs: Run[]; words: string }

export const COLOR = {
  fg: '#E6E6E6', dim: '#707070', track: '#3E3E3E',
  mint: '#99FFE4', amber: '#FFC799', coral: '#FF8A8A', post: '#FFFFFF',
} as const

const WINDOW: Record<string, number> = { five_hour: 18000, seven_day: 604800 }
const LABEL: Record<string, string> = { five_hour: '5-hour', seven_day: 'weekly' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

function wall(sec: number, offset: number) {
  const d = new Date((sec + offset) * 1000)
  return { day: d.getUTCDay(), date: d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(),
           h: d.getUTCHours(), m: d.getUTCMinutes() }
}
function clock(sec: number, offset: number) {
  const w = wall(sec, offset)
  return `${w.h % 12 || 12}:${String(w.m).padStart(2, '0')}${w.h >= 12 ? 'pm' : 'am'}`
}
const dayClock = (sec: number, offset: number) => `${DAYS[wall(sec, offset).day]} ${clock(sec, offset)}`
/** A moment told after another: the day only when its date differs from that one. */
const after = (sec: number, ref: number, offset: number) =>
  wall(sec, offset).date === wall(ref, offset).date ? clock(sec, offset) : dayClock(sec, offset)

function span(seconds: number) {
  const s = Math.floor(seconds)
  if (s < 60) return '<1m'
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 60)}m`
}

/** Green under half, amber to 80, coral from there: how close the share used is to the cap. */
const tone = (pct: number) => (pct >= 80 ? COLOR.coral : pct >= 50 ? COLOR.amber : COLOR.mint)

/** "+0530" (from `date +%z`) as seconds east of UTC; undefined when it does not parse. */
export function parseOffset(text: string): number | undefined {
  const m = /^([+-])(\d{2})(\d{2})/.exec(text.trim())
  if (!m) return undefined
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60)
}

/** One window's row, or null for a window this band does not draw (a gateway spend limit). */
export function paceRow(limit: Limit, nowSec: number, offset: number): Row | null {
  const len = WINDOW[limit.kind]
  const label = LABEL[limit.kind]
  const resetsAt = limit.resetsAt === undefined ? NaN : Math.floor(Date.parse(limit.resetsAt) / 1000)
  if (len === undefined || label === undefined || !Number.isFinite(resetsAt)) return null

  const u = limit.percentUsed
  const t = Math.floor(nowSec)
  const left = resetsAt - t
  const elapsed = len - left
  const ef = elapsed / len
  const fill = clamp(Math.floor((u * 128) / 100 + 0.5), 0, 128)
  const post = clamp(Math.floor(ef * 16), 0, 15)
  const refill = limit.kind === 'seven_day' ? dayClock(resetsAt, offset) : after(resetsAt, t, offset)

  let state: State
  let words: string
  if (left <= 0) {
    state = 'reset'; words = 'refilled · updates after the next reply'
  } else if (u >= 100) {
    state = 'cap'; words = `at the cap · refills ${refill}`
  } else if (ef < 0.1) {
    state = 'early'; words = `too early to tell · refills ${refill}`
  } else {
    const atRefill = (u * len) / elapsed
    if (atRefill > 100) {
      const dry = ((100 - u) * elapsed) / u
      state = 'dry'
      words = `runs dry at ${after(t + dry, t, offset)}, ${span(left - dry)} before the ${after(resetsAt, t + dry, offset)} refill`
    } else {
      state = atRefill >= 85 ? 'tight' : 'easy'
      words = `on track for about ${Math.round(atRefill)}% by ${refill}`
    }
  }

  const fillColor = { dry: COLOR.coral, cap: COLOR.coral, tight: COLOR.amber, easy: COLOR.mint,
                      early: tone(Math.round(u)), reset: COLOR.track }[state]
  const pct = state === 'reset' ? '--' : state === 'cap' ? '100%' : `${Math.round(u)}%`
  const full = fill >> 3
  const part = fill & 7

  const cells: Run[] = [{ text: label.padEnd(8), color: COLOR.fg }]
  for (let i = 0; i < 16; i++) {
    if (state !== 'reset' && i === post) cells.push({ text: '┃', color: COLOR.post, bold: true })
    else if (state !== 'reset' && i < full) cells.push({ text: '█', color: fillColor })
    else if (state !== 'reset' && i === full && part > 0) cells.push({ text: EIGHTHS[part] ?? '', color: fillColor })
    else cells.push({ text: '░', color: COLOR.track })
  }
  cells.push({ text: ' ' + pct.padStart(4), color: state === 'reset' ? COLOR.dim : tone(Math.round(u)) })
  cells.push({ text: '  ', color: COLOR.fg })
  cells.push({ text: words, color: state === 'early' || state === 'reset' ? COLOR.dim : fillColor })

  // merge neighbours of one look, so a row is a handful of Text runs, not 20
  const runs: Run[] = []
  for (const c of cells) {
    const last = runs[runs.length - 1]
    if (last && last.color === c.color && !!last.bold === !!c.bold) last.text += c.text
    else runs.push({ ...c })
  }
  return { kind: limit.kind, state, runs, words }
}

/** The rows to draw, 5-hour first; empty when there is nothing to show yet. */
export function paceRows(limits: readonly Limit[], nowMs: number, offset: number): Row[] {
  const order = ['five_hour', 'seven_day']
  return order
    .map(kind => limits.find(l => l.kind === kind))
    .filter((l): l is Limit => l !== undefined)
    .map(l => paceRow(l, nowMs / 1000, offset))
    .filter((r): r is Row => r !== null)
}

/** A row's text with the colours removed, for tests and for logs. */
export const plain = (row: Row) => row.runs.map(r => r.text).join('')

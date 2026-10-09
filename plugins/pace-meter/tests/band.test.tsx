// The band through the engine: a session starts (the time zone is read, the clock
// starts), the engine pushes a measurement, and the band draws the rows above the
// prompt on every surface that has one; before any reading it draws nothing.
import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const NOW_MS = 1790922600_000  // Fri 02-Oct-2026 12:00 IST
const H = 3600
const iso = (sec: number) => new Date(sec * 1000).toISOString()
const LIMITS = [
  { kind: 'five_hour', percentUsed: 60, resetsAt: iso(NOW_MS / 1000 + 3 * H) },
  { kind: 'seven_day', percentUsed: 30, resetsAt: iso(1791189000) },
]
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120,
           scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

/** The engine beneath the plugin: the Mac's zone, its usage figures, and its own drawing
 *  (or, given `below`, another mod's row beneath this one). */
function engine(on: On, rateLimits: typeof LIMITS | [], below?: string) {
  on('process.run', () => ({ value: { exitCode: 0, stdout: '+0530\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.usage', () => ({ value: { startedAt: NOW_MS, context: { window: 200000 }, rateLimits } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return below === undefined ? <Box key="engine" /> : <Box key="engine"><Text>{below}</Text></Box>
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: draws the forecast rows once the engine measures`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW_MS })
    engine(on, [])
    await $.session.start({ cwd: '/tmp', surface, isInteractive: true })

    const ui = await $.ui.mount({ plugin: 'pace-meter', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()

    await $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })
    expect(await ui.find({ type: 'Text', text: 'runs dry at 1:20pm, 1h 40m before the 3:00pm refill' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'on track for about 54% by Mon 2:00pm' })).toBeDefined()

    // A minute on with no new reading: the same 60% over a longer stretch is a slower
    // average, so the dry time moves later. At 12:01pm, 7260 s gone: dry in
    // 40 x 7260 / 60 = 4840 s (1:21pm), 10740 - 4840 = 5900 s (1h 38m) before the refill.
    await clock.advance(60_000)
    expect(await ui.find({ type: 'Text', text: 'runs dry at 1:21pm, 1h 38m before the 3:00pm refill' })).toBeDefined()
    await ui.unmount()
  })
}

test('a survey keeps the band to itself', async ($, on) => {
  mock.clock(on, { now: NOW_MS })
  engine(on, LIMITS)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'pace-meter', surface: 'terminal', ...BAND,
                                props: { ...BAND.props, hasSurvey: true } })
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  await ui.unmount()
})

// The band holds one tree, so a mod that answers without next(e) silences every mod
// beneath it. pace-meter draws its rows first and what lies beneath after them.
test('shares the band: its rows sit above what the mods beneath draw', async ($, on) => {
  mock.clock(on, { now: NOW_MS })
  engine(on, [], 'market row from below')
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'pace-meter', surface: 'terminal', ...BAND })

  // no reading yet: the row beneath still shows
  expect(await ui.find({ type: 'Text', text: 'market row from below' })).toBeDefined()

  await $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })
  expect(await ui.find({ type: 'Text', text: 'market row from below' })).toBeDefined()
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn.indexOf('5-hour')).toBeGreaterThan(-1)
  expect(drawn.indexOf('5-hour')).toBeLessThan(drawn.indexOf('market row from below'))
  await ui.unmount()
})

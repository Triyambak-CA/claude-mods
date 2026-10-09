# pace-meter

A Claude Code mod that draws your plan's usage limits just above the prompt, as a pace bar and a
forecast: will the limit last until it refills, and if not, when does it run dry?

![pace-meter above the Claude Code prompt, with example figures](example.png)

## What it shows

One row per limit: the 5-hour window and the weekly one.

- The bar fills with the share of the limit you have used.
- The white post `┃` is the clock: how far through the window you are. Fill past the post means
  you are spending faster than the limit refills.
- The sentence says it in words: `on track for about 54% by Mon 2:00pm`, or
  `runs dry at 1:20pm, 1h 40m before the 3:00pm refill`.
- Mint means room to spare, amber that you would end at 85% or more, coral that it runs dry first.

The forecast assumes you keep going at your average pace so far in the window. In the first tenth
of a window it says `too early to tell` instead.

## Install

Inside Claude Code:

```
/plugin marketplace add Triyambak-CA/claude-mods
/plugin install pace-meter@triyambak-mods
```

Then start a new session. The band appears once Claude Code has a usage reading, usually straight
away, otherwise after your first reply.

## Needs and caveats

- **A Claude subscription.** The figures are your plan's rate limits. On an API key there are none,
  and the band stays hidden.
- **Mods are early access.** It was built and tested on Claude Code 2.1.287; a later update may
  change the API it uses.
- **macOS or Linux for local times.** The mod sandbox has no time zone, so it asks the system once
  with `date +%z`. Where that command is missing (Windows), times show in UTC.

## How it works

Claude Code pushes the usage figures to the mod after each reply (`session.measure`); the mod keeps
them in its state and draws the rows in the band above the prompt (`ui.render` on `AbovePrompt`).
A one-minute timer moves the clock, so the post and the forecast keep moving while you are idle.
The band holds one tree, so the mod draws its rows first and then whatever other mods beneath it
drew there; it never takes the band for itself.

- `hooks/register.tsx`: the hooks.
- `hooks/pace.ts`: the arithmetic, as plain data. At the refill you will have used
  `used x window / elapsed`; above 100% it runs dry `(100 - used) x elapsed / used` seconds from now.

## Tests

```
claude plugin validate .
claude plugin test .
```

15 checks: the rows for running dry, on track, landing exactly on 100%, a run-dry time after
midnight, the widest row (93 columns), too early, at the cap and already reset; plus the band itself
through Claude Code's engine on terminal and desktop, the one-minute clock, and stepping aside for a
survey.

## Licence

MIT, see the repository's `LICENSE`.

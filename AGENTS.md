# Notes for agents working on this repo

This is a Claude Code plugin catalogue ("marketplace") named `triyambak-mods`. People add it with
`/plugin marketplace add Triyambak-CA/claude-mods` and install with `<mod>@triyambak-mods`.

- **Do not edit `plugins/` or `.claude-plugin/marketplace.json` by hand.** Each mod is built and
  recorded in the author's private setup repo, and a publish script there copies it here and
  rebuilds the catalogue. A change made here is overwritten on the next publish. Make the change in
  the source, publish, and open a pull request here.
- **Never rename the catalogue.** `triyambak-mods` is in every install command people have used.
- **Every mod carries** a README (what it shows, install, needs and caveats, tests), its own tests,
  and passes `claude plugin validate plugins/<mod>` and `claude plugin test plugins/<mod>`.
  `claude plugin validate .` checks the catalogue.
- **Public repo.** Nothing private goes in: no personal paths, no names of private files or repos,
  and no screenshots with real account figures (use example figures, labelled as such).
- **Style.** Plain words, sentence-case headings, no em or en dashes (use a hyphen).

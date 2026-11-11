# Browser tests (logged-in Chrome)

Click-through tests of the embedded screens. They attach to a Chrome you start and sign in yourself, so no credentials are stored.

1. Quit Chrome, then: `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=$HOME/chocotrack-chrome`
2. Sign in to the `creeklakeconfections` admin in that window.
3. Run `shopify app dev` and open the app once.
4. `npm run test:e2e`

They run against the dev store and are net-zero on stock (assemble, then disassemble). Not run in CI.

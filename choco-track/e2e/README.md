# Browser tests (logged-in Chrome)

Click-through tests of the embedded screens. They attach to a Chrome you start and sign in yourself, so no credentials are stored.

1. Quit Chrome, then: `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=$HOME/chocotrack-chrome`
2. Sign in to the `creeklakeconfections` admin in that window.
3. Open the app once. To test the deployed build, open ChocoTrack Production and run with `APP_HANDLE=chocotrack-production`; to test local changes, run `shopify app dev` and use the default handle.
4. `APP_HANDLE=chocotrack-production npm run test:e2e`

They run against the dev store and are net-zero on stock (assemble, then disassemble). Not run in CI.

The run also records the browser's uncaught exceptions and console errors and prints them grouped at the end. A JavaScript error (uncaught, TypeError, ReferenceError, RangeError) fails the run; network noise (the admin's old dev-tunnel WebSocket, and the connection resets the "Dropped connection" tests cause on purpose) is only reported.

# Browser tests (logged-in Chrome)

Click-through tests of the embedded screens. They attach to a Chrome you start and sign in yourself, so no credentials are stored.

1. Quit Chrome, then: `open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=$HOME/chocotrack-chrome`
2. Sign in to the `creeklakeconfections` admin in that window.
3. Open the app once. To test the deployed build, open ChocoTrack Production and run with `APP_HANDLE=chocotrack-production`. To test local changes, start the **dev app** with `./start.sh` from the repo root (it runs `shopify app dev --config shopify.app.toml --store creeklakeconfections.myshopify.com` with safety checks and cleans up on Ctrl+C), then use the default handle (`chocotrack`).

   **Always pass `--config shopify.app.toml`.** The CLI remembers the last config it used, and without the flag it can attach to **ChocoTrack Production** and point the store's production app at a temporary tunnel (the admin then shows "refused to connect" until it is undone). If that happens, stop the dev server and run `shopify app dev clean --config chocotrack-production --store creeklakeconfections.myshopify.com`. When you finish a local session, run `shopify app dev clean --config shopify.app.toml --store creeklakeconfections.myshopify.com`. In dev builds React logs a "tree hydrated" console warning about the admin's `<html>` class on every page; production builds do not, and the run only fails on real JavaScript errors.
4. `APP_HANDLE=chocotrack-production npm run test:e2e`

They run against the dev store and are net-zero on stock (assemble, then disassemble). Not run in CI.

The run also records the browser's uncaught exceptions and console errors and prints them grouped at the end. A JavaScript error (uncaught, TypeError, ReferenceError, RangeError) fails the run; network noise (the admin's old dev-tunnel WebSocket, and the connection resets the "Dropped connection" tests cause on purpose) is only reported.

**After a reset:** the Settings page has a **Reset all settings** button (inside "Setup guide and reset") that clears every flag, target, Untracked switch, transfer source and pack size and restarts the setup guide, for testing onboarding with new users. Most of this suite (Inventory edits, Add products, untracked variants, the setup guide test) needs tracked products with targets, so those tests fail on a reset store until products are flagged again. The "reset all settings" test only opens the confirmation and cancels.


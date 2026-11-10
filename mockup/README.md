# ChocoTrack kits - clickable mockup

A fake-data, no-backend prototype of the sampler-kit workflow, built with React and Shopify's Polaris web components (the same UI library the real app will use) so the store team can try it and give feedback **before** the real Shopify app is built.

## Run it (Docker)

```sh
docker compose up --build
# open http://localhost:8080
```

The page loads Polaris from Shopify's CDN (`cdn.shopify.com/shopifycloud/polaris-2.js`), so the laptop needs internet access.

Stop with `Ctrl+C` (or `docker compose down`).

## Run it (development)

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # domain unit tests (Vitest)
npm run test:coverage
npm run test:e2e   # Playwright UI flows in a real browser (CHROME_CHANNEL=chrome uses installed Chrome)
```

## What's in the mockup

- **Assemble kits** - pick a location, a kit (4-, 5-, 6- or 12-pack) and a number of kits, then choose which mini bars go in each kit. The mix must add up to exactly the kit size. Live "max buildable" and shortage warnings.
- **Disassemble kits** - break kits back into mini bars; enter the mini bars in one kit (they must add up to the kit size) and the app multiplies by the number of kits.
- **Box preview** - a picture of the finished box (1x4, 1x6 or 2x6) that fills in as you choose mini bars. The mockup uses generated name-only images in `public/images/mini` (regenerate with `node scripts/gen-flavor-images.mjs`); the real app uses the product images from Shopify.
- **Print pick list** - optional. Prints what to pull (per kit and total), stock on hand, shortages, and the box layout. Never changes inventory.
- **Create a new kit** - from the Assemble tab.
- **Mockup controls** (bottom) - reset the fake data, or simulate stock changing just before you submit.

Everything resets when the page reloads. See `WALKTHROUGH.md` for a guided feedback session.

## Layout

- `src/domain` - pure, tested business rules (carried over into the real app)
- `src/data` - fake catalog: 23 mini flavors named after the River Sea Chocolates bars, 2 kits, 3 locations
- `src/components` - UI built from `s-*` Polaris web components
- `e2e` - Playwright tests of the full flows

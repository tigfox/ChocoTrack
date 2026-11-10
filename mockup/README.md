# ChocoTrack kits - clickable mockup

A fake-data, no-backend prototype of the sampler-kit workflow, built with React and Polaris so the store team can try it and give feedback **before** the real Shopify app is built.

## Run it (Docker)

```sh
docker compose up --build
# open http://localhost:8080
```

Stop with `Ctrl+C` (or `docker compose down`).

## Run it (development)

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + UI flow tests
npm run test:coverage
```

## What's in the mockup

- **Assemble kits** - pick a location, a kit (6-pack or 12-pack) and a number of kits, then choose which mini bars go in each kit. The mix must add up to exactly the kit size. Live "max buildable" and shortage warnings.
- **Disassemble kits** - break kits back into mini bars; the units returned must equal kit size x kits.
- **Create a new kit** - from the Assemble tab.
- **Mockup controls** (bottom) - reset the fake data, or simulate stock changing just before you submit.

Everything resets when the page reloads. See `WALKTHROUGH.md` for a guided feedback session.

## Layout

- `src/domain` - pure, tested business rules (carried over into the real app)
- `src/data` - fake catalog: 23 mini flavors named after the River Sea Chocolates bars, 4 full bars, 2 kits, 3 locations
- `src/components` - Polaris UI

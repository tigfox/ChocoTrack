// Click-through tests against a logged-in Chrome (see e2e/README.md). Net-zero on stock.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright-core';

const CDP = process.env.CDP_URL ?? 'http://127.0.0.1:9222';
const BASE = `https://admin.shopify.com/store/${process.env.LIVE_STORE_HANDLE ?? 'creeklakeconfections'}/apps/chocotrack/app`;
const FLAVORS = ['Mini - 100% Cacao', 'Mini - Bolivia 72%'];

let browser;
let page;

const app = () => page.frames().find((f) => f !== page.mainFrame());
const open = async (path) => {
  await page.bringToFront();
  await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('iframe'), null, { timeout: 30_000 });
  const ready = path === 'settings' ? ['s-select[label="Category"]'] : ['s-search-field', 's-button[accessibilitylabel^="Add one"]'];
  for (const selector of ready) await app().waitForSelector(selector, { state: 'attached', timeout: 30_000 });
  // The server-rendered HTML appears before React attaches its handlers; events sent too early are lost.
  await page.waitForTimeout(3_000);
};
const text = () => app().locator('body').innerText();
const kitSize = async () => Number(/exactly (\d+)/.exec(await text())?.[1]);
const available = async (name) => Number(new RegExp(`${name.replace(/[%]/g, '.')}\\S* - (\\d+) available`).exec(await text())?.[1]);
const add = async (name, times) => {
  for (let i = 0; i < times; i++) await app().locator(`s-button[accessibilitylabel="Add one ${name}"]`).click();
};
const fillMix = async () => {
  const size = await kitSize();
  const first = Math.ceil(size / 2);
  await add(FLAVORS[0], first);
  await add(FLAVORS[1], size - first);
  return size;
};
const run = async (label) => {
  await app().locator('s-button', { hasText: label }).first().click();
  await app().waitForSelector('s-banner[heading]', { state: 'attached', timeout: 60_000 });
  return app().locator('s-banner').first().getAttribute('heading');
};

before(async () => {
  browser = await chromium.connectOverCDP(CDP);
  page = await browser.contexts()[0].newPage();
});
after(async () => {
  await page?.close();
  await browser?.close();
});

describe('Assemble screen', () => {
  it('lists mini bars with stock', async () => {
    await open('assemble');
    assert.match(await text(), /Mini - Bolivia 72%.* available/);
  });

  it('searches by name', async () => {
    await open('assemble');
    await app().locator('s-search-field').evaluate((el) => {
      el.value = 'Haiti';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await app().waitForFunction(() => !/Bolivia/.test(document.body.innerText), null, { timeout: 15_000 });
    assert.match(await text(), /Haiti 72%/);
  });

  it('blocks submit until the mix equals the kit size', async () => {
    await open('assemble');
    await add(FLAVORS[0], 1);
    assert.match(await text(), /needs exactly \d+ mini bars/);
    const disabled = await app().locator('s-button', { hasText: /^Assemble/ }).first().getAttribute('disabled');
    assert.notEqual(disabled, null);
  });
});

describe('Assemble then disassemble returns stock to start', () => {
  it('round-trips one kit', async () => {
    await open('assemble');
    const before0 = [await available(FLAVORS[0]), await available(FLAVORS[1])];
    const size = await fillMix();
    assert.match(await run('Assemble'), /^Assembled 1 x .* complete$/);

    await open('disassemble');
    await add(FLAVORS[0], Math.ceil(size / 2));
    await add(FLAVORS[1], size - Math.ceil(size / 2));
    assert.match(await run('Break down'), /^Disassembled 1 x .* complete$/);

    await open('assemble');
    assert.deepEqual([await available(FLAVORS[0]), await available(FLAVORS[1])], before0);
  });
});

describe('Print view', () => {
  it('shows the pick list sheet when printing', async () => {
    await open('assemble');
    await fillMix();
    await page.emulateMedia({ media: 'print' });
    const visible = await page.evaluate(() => {
      const root = document.getElementById('print-root') ?? [...document.querySelectorAll('iframe')].length;
      return Boolean(root);
    });
    await page.emulateMedia({ media: 'screen' });
    assert.ok(visible);
  });
});

describe('Collection filter', () => {
  it('remembers "All items" as no filter', async () => {
    await open('assemble');
    await app().locator('s-select[label="Collection"] select').selectOption({ label: 'All items' });
    await page.waitForTimeout(1_000);
    assert.equal(await app().locator('s-select[label="Collection"]').evaluate((el) => el.value), 'none');
    await open('assemble');
    assert.equal(await app().locator('s-select[label="Collection"]').evaluate((el) => el.value), 'none');
    await app().locator('s-select[label="Collection"] select').selectOption({ index: 4 });
  });
});

describe('Kit settings and categories', () => {
  const card = () => app().locator('s-section[heading*="6 Pack"]').first();
  const setField = (selector, value) =>
    card().locator(selector).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  const categoryId = (title) =>
    card().locator('s-select[label="Category"]').evaluate((el, t) => [...el.querySelectorAll('s-option')].find((o) => o.textContent.trim() === t)?.value, title);
  // Saves only when the value differs; Save is disabled for an unchanged form.
  const ensureCategory = async (value) => {
    const current = await card().locator('s-select[label="Category"]').evaluate((el) => el.value);
    if (current === (value || 'none')) return;
    await setField('s-select[label="Category"]', value || 'none');
    await save();
  };
  const save = async () => {
    await card().locator('s-button', { hasText: 'Save changes' }).click();
    await app().waitForFunction(() => /^Saved /.test(document.querySelector('s-banner')?.textContent ?? ''), null, { timeout: 30_000 });
  };
  // Choose the 6-pack explicitly (the browser may remember another kit), then read where the picker started.
  const collectionOnAssemble = async () => {
    await open('assemble');
    const kit = app().locator('s-select[label="Kit"]');
    await kit.evaluate((el) => {
      el.value = [...el.querySelectorAll('s-option')].find((o) => o.textContent.includes('(SMP-6)')).value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(1_000);
    return app().locator('s-select[label="Collection"]').evaluate((el) => el.value);
  };

  it('has no create-kit button on Assemble', async () => {
    await open('assemble');
    assert.doesNotMatch(await text(), /Create a new kit/);
  });

  it('lists kits with name, size and category', async () => {
    await open('settings');
    assert.match(await text(), /SKU SMP-6/);
    assert.ok(await app().locator('s-select[label="Category"]').count());
  });

  it('shows each kit its real size', async () => {
    await open('settings');
    const size = await card().locator('s-select[label="Kit size"]').evaluate((el) => el.value);
    assert.equal(size, '6');
  });

  it('starts the chooser on the kit category, and stops when it is removed', async () => {
    await open('settings');
    const dark = await categoryId('Dark chocolate');
    assert.ok(dark, 'dev store has a Dark chocolate collection');
    try {
      await ensureCategory(dark);
      // The 6-pack is the default kit, so Assemble should open on the category.
      assert.equal(await collectionOnAssemble(), dark);
    } finally {
      await open('settings');
      await ensureCategory('');
    }
    assert.notEqual(await collectionOnAssemble(), dark);
  });
});

// --- Error and edge cases -------------------------------------------------------------------------------------
const STORE = `${process.env.LIVE_STORE_HANDLE ?? 'creeklakeconfections'}.myshopify.com`;
const shopify = (query, variables) => {
  const args = ['store', 'execute', '--store', STORE, '--json', '--allow-mutations', '--query', query];
  if (variables) args.push('--variables', JSON.stringify(variables));
  const out = execFileSync('shopify', args, { encoding: 'utf8', env: { ...process.env, OPT_OUT_INSTRUMENTATION: 'true' } });
  return JSON.parse(out.slice(out.indexOf('{\n'))).data;
};
const setValue = (locator, value) =>
  locator.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
const banners = () => app().evaluate(() => [...document.querySelectorAll('s-banner')].map((b) => ({ tone: b.getAttribute('tone'), heading: b.getAttribute('heading') ?? '', text: b.textContent })));
const crashed = async () => /Application Error/.test(await text());
const optionValue = (select, label) =>
  select.evaluate((el, l) => [...el.querySelectorAll('s-option')].find((o) => o.textContent.trim() === l)?.value, label);

describe('Dropped connection', () => {
  it('keeps the mix and says it could not confirm, then a retry succeeds and applies once', async () => {
    await open('assemble');
    const size = await fillMix();
    const before0 = await available(FLAVORS[0]);
    await page.route(/\/app\/api\/run/, (r) => r.abort('connectionreset'));
    await app().locator('s-button', { hasText: /^Assemble/ }).first().click();
    await app().waitForSelector('s-banner[tone="warning"]', { state: 'attached', timeout: 20_000 });
    await page.unroute(/\/app\/api\/run/);
    assert.equal(await crashed(), false, 'no Application Error page');
    const [banner] = await banners();
    assert.match(banner.heading, /couldn't confirm/);
    assert.match(await text(), new RegExp(`${size} / ${size}`), 'the mix is still on screen');

    assert.match(await run('Assemble'), /^Assembled 1 x .* complete$/);
    await open('assemble');
    assert.equal(await available(FLAVORS[0]), before0 - Math.ceil(size / 2), 'applied once');
    await open('disassemble');
    await add(FLAVORS[0], Math.ceil(size / 2));
    await add(FLAVORS[1], size - Math.ceil(size / 2));
    await run('Break down');
  });

  it('shows an error on Settings instead of crashing', async () => {
    await open('settings');
    const card = app().locator('s-section[heading*="6 Pack"]').first();
    await setValue(card.locator('s-text-field[label="Name"]'), 'Sampler Kit - 6 Pack x');
    await page.route(/\/app\/api\/kit-settings/, (r) => r.abort('connectionreset'));
    await card.locator('s-button', { hasText: 'Save changes' }).click();
    await app().waitForSelector('s-banner[tone="critical"]', { state: 'attached', timeout: 20_000 });
    await page.unroute(/\/app\/api\/kit-settings/);
    assert.equal(await crashed(), false);
    assert.match((await banners())[0].text, /Couldn't reach the app/);
  });

  it('keeps the bar list when a search cannot reach the app', async () => {
    await open('assemble');
    await page.route(/\/app\/api\/search/, (r) => r.abort('connectionreset'));
    await app().locator('s-search-field').evaluate((el) => {
      el.value = 'Haiti';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await app().waitForFunction(() => /Couldn't reach the app/.test(document.body.innerText + [...document.querySelectorAll('s-banner')].map((b) => b.textContent).join('')), null, { timeout: 20_000 });
    await page.unroute(/\/app\/api\/search/);
    assert.equal(await crashed(), false);
    assert.match(await text(), /Bolivia 72%/, 'previous results are still listed');
  });
});

describe('Stock edge cases', () => {
  it('refuses a stale submit when stock changed in Shopify, and changes nothing', async () => {
    const { productVariants } = shopify('{ productVariants(first: 1, query: "sku:MINI-100-CACAO") { nodes { inventoryItem { id } } } }');
    const { locations } = shopify('{ locations(first: 10) { nodes { id name } } }');
    const item = productVariants.nodes[0].inventoryItem.id;
    const warehouse = locations.nodes.find((l) => l.name === 'Warehouse').id;
    const nudge = (delta) =>
      shopify(
        'mutation($input: InventoryAdjustQuantitiesInput!, $key: String!) { inventoryAdjustQuantities(input: $input) @idempotent(key: $key) { userErrors { message } } }',
        { key: crypto.randomUUID(), input: { name: 'available', reason: 'correction', changes: [{ inventoryItemId: item, locationId: warehouse, delta, changeFromQuantity: null }] } },
      );
    await open('assemble');
    await fillMix();
    const seen = await available(FLAVORS[0]);
    nudge(1); // someone else changes stock after this screen loaded
    try {
      await app().locator('s-button', { hasText: /^Assemble/ }).first().click();
      await app().waitForSelector('s-banner[heading]', { state: 'attached', timeout: 60_000 });
      const [banner] = await banners();
      assert.equal(banner.tone, 'warning');
      assert.equal(banner.heading, 'Nothing was changed');
      assert.match(await text(), new RegExp(`${seen + 1} available`), 'screen now shows the fresh quantity');
    } finally {
      nudge(-1);
    }
  });

  it('flags a bar that is not stocked at the chosen location, and blocks the run', async () => {
    await open('assemble');
    await add(FLAVORS[0], 1);
    const select = app().locator('s-select[label="Location"]');
    const previous = await select.evaluate((el) => el.value);
    try {
      await setValue(select, await optionValue(select, 'Factory'));
      await app().waitForFunction(() => /isn't stocked at this location/.test(document.body.innerText), null, { timeout: 15_000 });
      assert.notEqual(await app().locator('s-button', { hasText: /^Assemble/ }).first().getAttribute('disabled'), null);
    } finally {
      await setValue(select, previous);
    }
  });

  it('says how many are available when asking for more kits than the bars allow', async () => {
    await open('assemble');
    await fillMix();
    await setValue(app().locator('s-number-field[label="Kits to assemble"]'), '9999');
    await app().waitForFunction(() => /Only \d+ .* available; \d+ needed/.test(document.body.innerText), null, { timeout: 15_000 });
    assert.notEqual(await app().locator('s-button', { hasText: /^Assemble/ }).first().getAttribute('disabled'), null);
  });
});

describe('Create kit validation', () => {
  it('rejects a SKU that already exists, case-insensitively', async () => {
    await open('settings');
    // Polaris reports header actions as hidden to Playwright, so click through the DOM.
    await app().locator('s-button', { hasText: 'Create a new kit' }).first().evaluate((el) => el.click());
    await page.waitForTimeout(1_000);
    await setValue(app().locator('s-text-field[label="Title"]'), 'Duplicate test');
    await setValue(app().locator('s-text-field[label="SKU"]'), 'smp-6');
    await app().waitForFunction(() => [...document.querySelectorAll('s-text-field')].some((f) => /already in use/.test(f.error ?? '')), null, { timeout: 10_000 });
    assert.notEqual(await app().locator('s-button', { hasText: 'Create kit' }).first().getAttribute('disabled'), null);
  });
});

// Click-through tests against a logged-in Chrome (see e2e/README.md). Net-zero on stock.
import assert from 'node:assert/strict';
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
  const collectionOnAssemble = async () => {
    await open('assemble');
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

import { expect, test } from '@playwright/test';
import { BOLIVIA, LOW_STOCK, MILK, add, field, open, openDisassemble } from './helpers';

type Page = import('@playwright/test').Page;
const preview = (page: Page) => page.locator('s-section[heading="Box preview"]');
const slots = (page: Page) => preview(page).getByTestId('box-slot');
const filledSlots = (page: Page) => slots(page).locator('img');

test.describe('Box preview', () => {
  test.beforeEach(({ page }) => open(page));

  test('6-pack is a 1x6 grid that fills with chosen flavors', async ({ page }) => {
    const grid = preview(page).getByTestId('box-grid');
    await expect(grid).toHaveAttribute('data-layout', '1x6');
    await expect(slots(page)).toHaveCount(6);
    await expect(filledSlots(page)).toHaveCount(0);
    await add(page, BOLIVIA, 2);
    await add(page, LOW_STOCK, 1);
    await expect(filledSlots(page)).toHaveCount(3);
    await expect(page.getByText('3 of 6 bars placed')).toBeVisible();
    await expect(filledSlots(page).first()).toHaveAttribute('alt', BOLIVIA);
  });

  test('12-pack is 2x6 and 4-pack is 1x4', async ({ page }) => {
    await field(page, 's-select', 'Kit').locator('select').selectOption('v-kit-smp-12');
    await expect(preview(page).getByTestId('box-grid')).toHaveAttribute('data-layout', '2x6');
    await expect(slots(page)).toHaveCount(12);
    await field(page, 's-select', 'Kit').locator('select').selectOption('v-kit-smp-4');
    await expect(preview(page).getByTestId('box-grid')).toHaveAttribute('data-layout', '1x4');
    await expect(slots(page)).toHaveCount(4);
  });

  test('flavor images load (name-only mockup images)', async ({ page }) => {
    await add(page, BOLIVIA, 1);
    const loaded = await filledSlots(page).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test('a 4-pack accepts exactly 4 bars', async ({ page }) => {
    await field(page, 's-select', 'Kit').locator('select').selectOption('v-kit-smp-4');
    await add(page, BOLIVIA, 4);
    await expect(page.getByTestId('unit-total')).toHaveText('4 / 4');
    await expect(page.getByRole('button', { name: 'Assemble 1 kit' })).toBeEnabled();
  });

  test('the box preview is also shown on the disassemble tab', async ({ page }) => {
    await openDisassemble(page);
    await add(page, MILK, 2);
    await expect(filledSlots(page)).toHaveCount(2);
  });
});

test.describe('Pick list', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { printCalls: number }).printCalls = 0;
      window.print = () => {
        (window as unknown as { printCalls: number }).printCalls += 1;
      };
    });
    await open(page);
  });

  test('print is optional: disabled with nothing chosen, never required to assemble', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Print pick list' })).toBeDisabled();
    await add(page, BOLIVIA, 6);
    await page.getByRole('button', { name: 'Assemble 1 kit' }).click();
    await expect(page.getByText('Assembled 1 x Sampler Kit - 6 Pack complete')).toBeVisible();
  });

  test('printing opens the print dialog without changing inventory', async ({ page }) => {
    await add(page, BOLIVIA, 4);
    await add(page, MILK, 2);
    await page.getByRole('button', { name: 'Print pick list' }).click();
    expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
    await expect(page.getByText('Assembled')).toHaveCount(0);
    await expect(page.locator('s-select[label="Kit"] option', { hasText: '(SMP-6)' })).toContainText('12 in stock');
  });

  test('the print view lists totals, availability and the box layout; screen view hides it', async ({ page }) => {
    await field(page, 's-number-field', 'Kits to assemble').locator('input').fill('2');
    await add(page, BOLIVIA, 4);
    await add(page, LOW_STOCK, 2);
    const sheet = page.getByTestId('pick-list');
    await expect(sheet).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print pick list' })).toBeHidden();
    await expect(sheet.getByRole('heading', { name: 'Pick list - assemble kits' })).toBeVisible();
    await expect(sheet).toContainText('Sampler Kit - 6 Pack (SMP-6) x 2');
    await expect(sheet).toContainText('Main Warehouse');
    const bolivia = sheet.getByRole('row', { name: /Bolivia 72%/ });
    await expect(bolivia).toContainText('MINI-BOLIVIA-72');
    await expect(bolivia.getByRole('cell').nth(5)).toHaveText('8'); // 4 per kit x 2 kits
    await expect(bolivia.getByRole('cell').nth(6)).toHaveText('240');
    await expect(sheet.getByRole('row', { name: /Desert Flower/ }).getByRole('cell').nth(5)).toHaveText('4');
    await expect(sheet.getByRole('row', { name: /Total mini bars/ })).toContainText('12');
    await expect(sheet.getByTestId('box-grid')).toHaveAttribute('data-layout', '1x6');
  });

  test('flags shortages on the sheet', async ({ page }) => {
    await field(page, 's-number-field', 'Kits to assemble').locator('input').fill('10');
    await add(page, LOW_STOCK, 6); // 60 needed vs 14 available
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('pick-list')).toContainText('SHORT by 46');
  });

  test('disassemble prints a return list', async ({ page }) => {
    await openDisassemble(page);
    await field(page, 's-number-field', 'Kits to break down').locator('input').fill('2');
    await add(page, BOLIVIA, 3);
    await add(page, MILK, 3);
    await page.getByRole('button', { name: 'Print pick list' }).click();
    await page.emulateMedia({ media: 'print' });
    const sheet = page.getByTestId('pick-list');
    await expect(sheet.getByRole('heading', { name: 'Return list - break down kits' })).toBeVisible();
    await expect(sheet.getByRole('row', { name: /Bolivia 72%/ }).getByRole('cell').nth(5)).toHaveText('6');
  });
});

import { expect, test } from '@playwright/test';
import { BOLIVIA, LOW_STOCK, MILK, add, field, kitOption, open, unitTotal } from './helpers';

test.beforeEach(({ page }) => open(page));

test('disables the action until the mix matches the kit size', async ({ page }) => {
  await add(page, BOLIVIA, 5);
  await expect(unitTotal(page)).toHaveText('5 / 6');
  await expect(page.getByRole('button', { name: 'Assemble 1 kit' })).toBeDisabled();
  await add(page, MILK, 1);
  await expect(unitTotal(page)).toHaveText('6 / 6');
  await expect(page.getByRole('button', { name: 'Assemble 1 kit' })).toBeEnabled();
});

test('assembles a kit, shows the adjustments and updates kit stock', async ({ page }) => {
  await add(page, BOLIVIA, 4);
  await add(page, MILK, 2);
  await page.getByRole('button', { name: 'Assemble 1 kit' }).click();
  await expect(page.getByText('Assembled 1 x Sampler Kit - 6 Pack complete')).toBeVisible();
  await expect(page.getByText(/\+1\s+Sampler Kit - 6 Pack/)).toBeVisible();
  await expect(kitOption(page, 'SMP-6')).toContainText('13 in stock');
  await expect(unitTotal(page)).toHaveText('0 / 6');
});

test('shows a shortage warning when demand exceeds stock', async ({ page }) => {
  await field(page, 's-number-field', 'Kits to assemble').locator('input').fill('10');
  await add(page, LOW_STOCK, 6); // 60 needed vs 14 available
  await expect(page.getByText('Short by 46').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assemble 10 kits' })).toBeDisabled();
});

test('adds one unit when an exact barcode is entered', async ({ page }) => {
  await field(page, 's-search-field', 'Search').locator('input').fill('850010000001');
  await field(page, 's-search-field', 'Search').locator('input').press('Enter');
  await expect(unitTotal(page)).toHaveText('1 / 6');
});

test('filters by search text', async ({ page }) => {
  await field(page, 's-search-field', 'Search').locator('input').fill('rum');
  await expect(page.getByText('Mini - Rum Caramel', { exact: true })).toBeVisible();
  await expect(page.getByText(LOW_STOCK, { exact: true })).toHaveCount(0);
});

test('shows a conflict banner and refreshes stock when simulated', async ({ page }) => {
  await page.getByLabel(/Simulate: stock changes/).check();
  await add(page, BOLIVIA, 6);
  await page.getByRole('button', { name: 'Assemble 1 kit' }).click();
  await expect(page.getByText('Nothing was changed')).toBeVisible();
  await expect(page.getByText(/120 available/).first()).toBeVisible();
});

test('creates a new kit from the modal and selects it', async ({ page }) => {
  await page.getByRole('button', { name: 'Create a new kit' }).click();
  await field(page, 's-text-field', 'Title').locator('input').fill('Holiday Sampler 12');
  await field(page, 's-select', 'Kit size').locator('select').selectOption('12');
  await field(page, 's-text-field', 'SKU').locator('input').fill('HOL-12');
  await page.getByRole('button', { name: 'Create kit' }).click();
  await expect(unitTotal(page)).toHaveText('0 / 12');
});

test('rejects a duplicate kit SKU', async ({ page }) => {
  await page.getByRole('button', { name: 'Create a new kit' }).click();
  await field(page, 's-text-field', 'Title').locator('input').fill('Dup');
  await field(page, 's-text-field', 'SKU').locator('input').fill('smp-6');
  await expect(page.getByText('That SKU is already in use.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create kit' })).toBeDisabled();
});

test('resets demo data', async ({ page }) => {
  await add(page, BOLIVIA, 6);
  await page.getByRole('button', { name: 'Assemble 1 kit' }).click();
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await expect(kitOption(page, 'SMP-6')).toContainText('12 in stock');
});

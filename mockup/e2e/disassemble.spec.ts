import { expect, test } from '@playwright/test';
import { BOLIVIA, MILK, add, field, open, openDisassemble } from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
  await openDisassemble(page);
});

test('returns mini bars to stock', async ({ page }) => {
  await add(page, BOLIVIA, 3);
  await add(page, MILK, 3);
  await page.getByRole('button', { name: 'Break down 1 kit' }).click();
  await expect(page.getByText('Disassembled 1 x Sampler Kit - 6 Pack complete')).toBeVisible();
  await expect(field(page, 's-select', 'Kit').locator('option').first()).toContainText('11 in stock');
});

test('multiplies the per-kit mix by the number of kits', async ({ page }) => {
  await field(page, 's-number-field', 'Kits to break down').locator('input').fill('2');
  await add(page, BOLIVIA, 3);
  await add(page, MILK, 3);
  await expect(page.getByText('Returns 12 mini bars to stock at Main Warehouse')).toBeVisible();
  await page.getByRole('button', { name: 'Break down 2 kits' }).click();
  await expect(page.getByText('Disassembled 2 x Sampler Kit - 6 Pack complete')).toBeVisible();
  await expect(page.getByText(/\+6\s+Mini - Bolivia 72%/)).toBeVisible();
  await expect(field(page, 's-select', 'Kit').locator('option').first()).toContainText('10 in stock');
});

test('blocks when the per-kit total is wrong', async ({ page }) => {
  await add(page, BOLIVIA, 2);
  await expect(page.getByRole('button', { name: 'Break down 1 kit' })).toBeDisabled();
});

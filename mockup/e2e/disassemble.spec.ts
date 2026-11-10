import { expect, test } from '@playwright/test';
import { BOLIVIA, MILK, add, field, open, openDisassemble } from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
  await openDisassemble(page);
});

test('returns mini bars to stock', async ({ page }) => {
  await add(page, BOLIVIA, 3);
  await add(page, MILK, 3);
  await page.getByRole('button', { name: 'Break down kits' }).click();
  await expect(page.getByText('Disassembled 1 x Sampler Kit - 6 Pack complete')).toBeVisible();
  await expect(field(page, 's-select', 'Kit').locator('option').first()).toContainText('11 in stock');
});

test('blocks when the returned total is wrong', async ({ page }) => {
  await add(page, BOLIVIA, 2);
  await expect(page.getByRole('button', { name: 'Break down kits' })).toBeDisabled();
});

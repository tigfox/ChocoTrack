import { expect, type Page } from '@playwright/test';

export const BOLIVIA = 'Mini - Bolivia 72%';
export const MILK = 'Mini - Organic Milk Chocolate';
export const LOW_STOCK = 'Mini - Desert Flower';

export const open = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create a new kit' })).toBeVisible();
};

export const add = async (page: Page, flavor: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole('button', { name: `Add one ${flavor}` }).click();
  }
};

export const unitTotal = (page: Page) => page.getByTestId('unit-total');

export const field = (page: Page, tag: string, label: string) => page.locator(`${tag}[label="${label}"]`);

export const openDisassemble = async (page: Page) => {
  await page.getByRole('button', { name: 'Disassemble kits' }).click();
  await expect(page.getByRole('button', { name: 'Break down 1 kit' })).toBeVisible();
};

/** The option for a kit in the Kit select, found by SKU. */
export const kitOption = (page: Page, sku: string) =>
  field(page, 's-select', 'Kit').locator('option', { hasText: `(${sku})` });

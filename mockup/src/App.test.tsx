import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import { App } from './App';

const setup = () => {
  const user = userEvent.setup();
  render(
    <AppProvider i18n={en}>
      <App />
    </AppProvider>,
  );
  return user;
};

const openDisassemble = () =>
  fireEvent.click(screen.getAllByRole('tab', { name: 'Disassemble kits' }).at(-1) as HTMLElement);

const add = async (user: ReturnType<typeof userEvent.setup>, flavor: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    await user.click(screen.getByRole('button', { name: `Add one ${flavor}` }));
  }
};

describe('Assemble flow', () => {
  it('disables the action until the mix matches the kit size', async () => {
    const user = setup();
    await add(user, 'Mini - Bolivia 72%', 5);
    expect(screen.getByText('5 / 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assemble/i })).toHaveAttribute('aria-disabled', 'true');
    await add(user, 'Mini - Organic Milk Chocolate', 1);
    expect(screen.getByText('6 / 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assemble 1 kit/i })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('assembles a kit, shows the adjustments and updates kit stock', async () => {
    const user = setup();
    await add(user, 'Mini - Bolivia 72%', 4);
    await add(user, 'Mini - Organic Milk Chocolate', 2);
    await user.click(screen.getByRole('button', { name: /assemble 1 kit/i }));
    expect(await screen.findByText(/Assembled 1 x Sampler Kit - 6 Pack complete/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\s+Sampler Kit - 6 Pack/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Sampler Kit - 6 Pack \(SMP-6\) - 13 in stock/ })).toBeInTheDocument();
    expect(screen.getByText('0 / 6')).toBeInTheDocument();
  });

  it('shows a shortage warning when demand exceeds stock', async () => {
    const user = setup();
    await user.clear(screen.getByLabelText('Kits to assemble'));
    await user.type(screen.getByLabelText('Kits to assemble'), '10');
    await add(user, 'Mini - Desert Flower', 6); // 60 needed vs 14 available
    expect(screen.getAllByText(/Short by 46/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /assemble 10 kits/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('adds one unit when an exact barcode is entered', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Search'), '850010000001{Enter}');
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
  });

  it('filters by search text', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Search'), 'rum');
    expect(screen.getByText('Mini - Rum Caramel')).toBeInTheDocument();
    expect(screen.queryByText('Mini - Desert Flower')).not.toBeInTheDocument();
  });

  it('shows a conflict banner and refreshes stock when simulated', async () => {
    const user = setup();
    await user.click(screen.getByLabelText(/Simulate: stock changes/));
    await add(user, 'Mini - Bolivia 72%', 6);
    await user.click(screen.getByRole('button', { name: /assemble 1 kit/i }));
    expect(await screen.findByText('Nothing was changed')).toBeInTheDocument();
    expect(screen.getAllByText(/120 available/).length).toBeGreaterThan(0);
  });

  it('creates a new kit from the modal and selects it', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Create a new kit' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Holiday Sampler 12');
    await user.selectOptions(within(dialog).getByLabelText('Kit size'), '12');
    await user.type(within(dialog).getByLabelText('SKU'), 'HOL-12');
    await user.click(within(dialog).getByRole('button', { name: 'Create kit' }));
    expect(await screen.findByText(/0 \/ 12/)).toBeInTheDocument();
  });

  it('rejects a duplicate kit SKU', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Create a new kit' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Dup');
    await user.type(within(dialog).getByLabelText('SKU'), 'smp-6');
    expect(within(dialog).getByText('That SKU is already in use.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create kit' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Disassemble flow', () => {
  it('returns mini bars to stock', async () => {
    const user = setup();
    openDisassemble();
    await add(user, 'Mini - Bolivia 72%', 3);
    await add(user, 'Mini - Organic Milk Chocolate', 3);
    await user.click(screen.getByRole('button', { name: 'Break down kits' }));
    expect(await screen.findByText(/Disassembled 1 x Sampler Kit - 6 Pack complete/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SMP-6\) - 11 in stock/ })).toBeInTheDocument();
  });

  it('blocks when the returned total is wrong', async () => {
    const user = setup();
    openDisassemble();
    await add(user, 'Mini - Bolivia 72%', 2);
    expect(screen.getByRole('button', { name: 'Break down kits' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Mockup controls', () => {
  it('resets demo data', async () => {
    const user = setup();
    await add(user, 'Mini - Bolivia 72%', 6);
    await user.click(screen.getByRole('button', { name: /assemble 1 kit/i }));
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(screen.getByRole('option', { name: /SMP-6\) - 12 in stock/ })).toBeInTheDocument();
  });
});

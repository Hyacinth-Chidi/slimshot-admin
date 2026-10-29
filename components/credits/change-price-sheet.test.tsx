import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { ChangePriceSheet } from './change-price-sheet';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, createPricingRule: vi.fn(), activatePricingRule: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: 'p3',
    feature: 'auto_captions',
    version: 3,
    mode: 'per_second',
    perJobCredits: null,
    tiers: null,
    blockSeconds: 30,
    blockCredits: 2,
    minCredits: 4,
    isActive: true,
    note: 'Cheaper for short clips',
    createdById: 'a1',
    createdAt: '2026-10-23T09:00:00Z',
    activatedAt: '2026-10-23T09:00:00Z',
    ...overrides,
  };
}

const LIVE = rule({});
const V2 = rule({
  id: 'p2',
  version: 2,
  mode: 'duration_tiers',
  blockSeconds: null,
  blockCredits: null,
  minCredits: null,
  tiers: [
    { upToSeconds: 60, credits: 5 },
    { upToSeconds: 180, credits: 10 },
    { upToSeconds: null, credits: 20 },
  ],
  isActive: false,
});

function renderSheet(props: Partial<Parameters<typeof ChangePriceSheet>[0]> = {}) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChangePriceSheet open onOpenChange={onOpenChange} live={LIVE} startFrom={null} nextVersion={4} adRewardCredits={5} {...props} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

const sheet = () => screen.getByRole('dialog', { name: /Auto captions price/ });
const field = (name: string) => within(sheet()).getByLabelText(name) as HTMLInputElement;
const button = (name: string | RegExp) => within(sheet()).getByRole('button', { name });

async function retype(name: string, value: string) {
  await userEvent.clear(field(name));
  if (value) await userEvent.type(field(name), value);
}

function costCell(clip: string) {
  const table = within(sheet()).getByRole('table', { name: 'What clips will cost' });
  const row = within(table).getByRole('row', { name: new RegExp(`^${clip} `) });
  return row.querySelectorAll('td')[1].textContent;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('ChangePriceSheet', () => {
  it('starts from the live price', () => {
    renderSheet();
    expect(within(sheet()).getByRole('heading', { name: 'Change the Auto captions price' })).toBeInTheDocument();
    expect(
      within(sheet()).getByText('Filled in with the live price (v3). Saving creates v4; past charges never change.'),
    ).toBeInTheDocument();
    expect(button(/By time used/)).toHaveAttribute('aria-pressed', 'true');
    expect(field('Credits per block').value).toBe('2');
    expect(field('Block length in seconds').value).toBe('30');
    expect(field('Minimum credits per job').value).toBe('4');
    expect(field('Reason (shown in the price history)').value).toBe('');
  });

  it('explains each way of charging', () => {
    renderSheet();
    expect(button(/By time used/)).toHaveTextContent('A price for every block of seconds started.');
    expect(button(/By length band/)).toHaveTextContent('A set price for clips up to a length.');
    expect(button(/Flat per job/)).toHaveTextContent('The same price for any clip.');
  });

  it('starts empty, by time used, when nothing is live', () => {
    renderSheet({ live: null, nextVersion: 1 });
    expect(within(sheet()).getByRole('heading', { name: 'Set the Auto captions price' })).toBeInTheDocument();
    expect(within(sheet()).getByText('Saving creates v1.')).toBeInTheDocument();
    expect(button(/By time used/)).toHaveAttribute('aria-pressed', 'true');
    expect(field('Credits per block').value).toBe('');
  });

  it('starts from a history version when given one', () => {
    renderSheet({ startFrom: V2 });
    expect(
      within(sheet()).getByText('Filled in from v2. Saving creates v4; past charges never change.'),
    ).toBeInTheDocument();
    expect(button(/By length band/)).toHaveAttribute('aria-pressed', 'true');
    expect(field('Band 1 up to seconds').value).toBe('60');
    expect(field('Band 1 credits').value).toBe('5');
    expect(field('Band 2 up to seconds').value).toBe('180');
    expect(field('Band 2 credits').value).toBe('10');
    expect(field('Anything longer credits').value).toBe('20');
  });

  it('compares against the live price as the user types', async () => {
    renderSheet();
    expect(costCell('1 min')).toBe('4');
    await retype('Credits per block', '3');
    expect(costCell('1 min')).toBe('6 ↑');
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Clips cost up to 50% more.');
  });

  it('disables saving and explains while the draft is invalid', async () => {
    renderSheet();
    await retype('Credits per block', '');
    expect(button('Save for later')).toBeDisabled();
    expect(button('Make v4 live…')).toBeDisabled();
    expect(within(sheet()).getByText('Credits per block must be a whole number from 0 to 100,000.')).toBeInTheDocument();
    expect(costCell('1 min')).toBe('—');
  });

  it('saves for later without making it live', async () => {
    vi.mocked(creditsApi.createPricingRule).mockResolvedValue(rule({ id: 'p4', version: 4, isActive: false }));
    const { onOpenChange } = renderSheet();
    await retype('Credits per block', '3');
    await userEvent.click(button('Save for later'));

    expect(creditsApi.createPricingRule).toHaveBeenCalledWith({
      feature: 'auto_captions',
      mode: 'per_second',
      blockSeconds: 30,
      blockCredits: 3,
      minCredits: 4,
    });
    expect(creditsApi.activatePricingRule).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Price v4 saved for later');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('makes it live only after the confirm', async () => {
    vi.mocked(creditsApi.createPricingRule).mockResolvedValue(rule({ id: 'new-id', version: 4, isActive: false }));
    vi.mocked(creditsApi.activatePricingRule).mockResolvedValue([]);
    const { onOpenChange } = renderSheet();
    await retype('Credits per block', '3');
    await userEvent.type(field('Reason (shown in the price history)'), 'Provider costs went up');
    await userEvent.click(button('Make v4 live…'));

    const confirm = screen.getByRole('alertdialog', { name: 'Make v4 live?' });
    expect(confirm).toHaveTextContent(
      'New caption jobs will cost 3 credits for every 30 seconds started · never less than 4 credits. Jobs already charged keep their price.',
    );
    expect(creditsApi.createPricingRule).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Make live' }));
    expect(creditsApi.createPricingRule).toHaveBeenCalledWith(expect.objectContaining({ note: 'Provider costs went up' }));
    expect(creditsApi.activatePricingRule).toHaveBeenCalledWith('new-id');
    expect(toast).toHaveBeenCalledWith('Price v4 is live');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the server's problems when it refuses", async () => {
    vi.mocked(creditsApi.createPricingRule).mockRejectedValue(
      new ApiError(
        { code: 'VALIDATION_FAILED', message: 'The pricing rule is not valid.', details: { problems: ['each upToSeconds must be greater'] }, traceId: 't' },
        422,
      ),
    );
    const { onOpenChange } = renderSheet();
    await userEvent.click(button('Save for later'));
    expect(await within(sheet()).findByText('each upToSeconds must be greater')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('asks before discarding edits', async () => {
    const { onOpenChange } = renderSheet();
    await retype('Credits per block', '3');
    await userEvent.keyboard('{Escape}');

    const ask = screen.getByRole('alertdialog', { name: 'Discard this price?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(field('Credits per block').value).toBe('3');

    await userEvent.click(button('Cancel'));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Discard this price?' })).getByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes at once when nothing was changed', async () => {
    const { onOpenChange } = renderSheet();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fills the screen on phones', () => {
    renderSheet();
    // The base sheet sets data-[side=right]:w-3/4, which outranks a plain w-full: override it on the same variant.
    expect(sheet()).toHaveClass('data-[side=right]:w-full');
    expect(sheet()).not.toHaveClass('w-full');
  });

  it('guards a reload or closing the tab while a price is half-made', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { onOpenChange } = renderSheet();
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false);

    await retype('Credits per block', '3');
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);

    await userEvent.click(button('Cancel'));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Discard this price?' })).getByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(remove.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true);
    add.mockRestore();
    remove.mockRestore();
  });

  it('adds and removes length bands', async () => {
    renderSheet({ startFrom: V2 });
    await userEvent.click(button('Add band'));
    expect(field('Band 3 up to seconds').value).toBe('');
    await userEvent.click(button('Remove band 1'));
    expect(field('Band 1 up to seconds').value).toBe('180');
  });

  it('charges a flat price per clip', async () => {
    vi.mocked(creditsApi.createPricingRule).mockResolvedValue(rule({ id: 'p4', version: 4, mode: 'per_job' }));
    renderSheet();
    await userEvent.click(button(/Flat per job/));
    await userEvent.type(field('Credits per clip'), '10');
    await userEvent.click(button('Save for later'));
    expect(creditsApi.createPricingRule).toHaveBeenCalledWith({ feature: 'auto_captions', mode: 'per_job', perJobCredits: 10 });
  });
});

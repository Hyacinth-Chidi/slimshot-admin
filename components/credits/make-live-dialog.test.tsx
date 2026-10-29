import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { MakeLiveDialog } from './make-live-dialog';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, activatePricingRule: vi.fn() };
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
    note: null,
    createdById: 'a1',
    createdAt: '2026-10-23T09:00:00Z',
    activatedAt: '2026-10-23T09:00:00Z',
    ...overrides,
  };
}

const LIVE = rule({});
const V1 = rule({ id: 'p1', version: 1, mode: 'per_job', perJobCredits: 10, blockSeconds: null, blockCredits: null, minCredits: null, isActive: false, activatedAt: '2026-09-29T09:00:00Z' });
const SAVED = rule({ id: 'p4', version: 4, blockCredits: 3, isActive: false, activatedAt: null });

function renderDialog(target: PricingRule) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const setData = vi.spyOn(client, 'setQueryData');
  render(
    <QueryClientProvider client={client}>
      <MakeLiveDialog rule={target} live={LIVE} adRewardCredits={5} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, setData };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('MakeLiveDialog', () => {
  it('asks to make a version live again when it has been live before', () => {
    renderDialog(V1);
    expect(screen.getByRole('alertdialog', { name: 'Make v1 live again?' })).toBeInTheDocument();
  });

  it('asks to make a version live when it never has been', () => {
    renderDialog(SAVED);
    expect(screen.getByRole('alertdialog', { name: 'Make v4 live?' })).toBeInTheDocument();
  });

  it('shows what clips would cost against the live price', () => {
    renderDialog(SAVED);
    const dialog = screen.getByRole('alertdialog');
    const table = within(dialog).getByRole('table', { name: 'What clips will cost' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Clip', 'Now (v3)', 'v4']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Clips cost up to 50% more.');
    expect(dialog).toHaveTextContent('Jobs already charged keep their price.');
  });

  it('makes it live once, stores the new list and says so', async () => {
    const rules = [rule({ ...SAVED, isActive: true }), rule({ isActive: false })];
    vi.mocked(creditsApi.activatePricingRule).mockResolvedValue(rules);
    const { onClose, setData } = renderDialog(SAVED);

    await userEvent.click(screen.getByRole('button', { name: 'Make live' }));

    expect(creditsApi.activatePricingRule).toHaveBeenCalledTimes(1);
    expect(creditsApi.activatePricingRule).toHaveBeenCalledWith('p4');
    expect(setData).toHaveBeenCalledWith(['pricing', 'auto_captions'], rules);
    expect(toast).toHaveBeenCalledWith('Price v4 is live');
    expect(onClose).toHaveBeenCalled();
  });

  it("toasts the server's message and closes when the change is refused", async () => {
    vi.mocked(creditsApi.activatePricingRule).mockRejectedValue(
      new ApiError({ code: 'CONFLICT', message: 'Another price was made live at the same moment.', traceId: 't' }, 409),
    );
    const { onClose } = renderDialog(SAVED);

    await userEvent.click(screen.getByRole('button', { name: 'Make live' }));

    expect(toast).toHaveBeenCalledWith('Another price was made live at the same moment.', 'error');
    expect(onClose).toHaveBeenCalled();
  });
});

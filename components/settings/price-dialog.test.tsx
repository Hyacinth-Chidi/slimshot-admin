import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { PricingRule } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { PriceDialog } from './price-dialog';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, createPricingRule: vi.fn(), activatePricingRule: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const created: PricingRule = {
  id: 'r9',
  feature: 'auto_captions',
  version: 9,
  mode: 'per_job',
  perJobCredits: 3,
  tiers: null,
  isActive: false,
  note: null,
  createdById: 'a1',
  createdAt: '2026-10-05T10:00:00Z',
  activatedAt: null,
};

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PriceDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

const submit = () => screen.getByRole('button', { name: 'Create price' });

afterEach(() => {
  vi.resetAllMocks();
});

describe('PriceDialog', () => {
  it('creates a per-job price and activates it', async () => {
    vi.mocked(creditsApi.createPricingRule).mockResolvedValue(created);
    vi.mocked(creditsApi.activatePricingRule).mockResolvedValue([]);
    const { onOpenChange } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Per job' }));
    await userEvent.type(screen.getByLabelText('Credits per job'), '3');
    await userEvent.click(submit());

    expect(creditsApi.createPricingRule).toHaveBeenCalledWith({
      feature: 'auto_captions',
      mode: 'per_job',
      perJobCredits: 3,
    });
    expect(creditsApi.activatePricingRule).toHaveBeenCalledWith('r9');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('leaves the new version inactive when "Activate now" is off', async () => {
    vi.mocked(creditsApi.createPricingRule).mockResolvedValue(created);
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Per job' }));
    await userEvent.type(screen.getByLabelText('Credits per job'), '3');
    await userEvent.click(screen.getByRole('switch', { name: 'Activate now' }));
    await userEvent.click(submit());

    expect(creditsApi.createPricingRule).toHaveBeenCalled();
    expect(creditsApi.activatePricingRule).not.toHaveBeenCalled();
  });

  it('blocks a tier that is not longer than the one before, saying why', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Tier 1 seconds'), '60');
    await userEvent.type(screen.getByLabelText('Tier 1 credits'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Add tier' }));
    await userEvent.type(screen.getByLabelText('Tier 2 seconds'), '30');
    await userEvent.type(screen.getByLabelText('Tier 2 credits'), '3');
    await userEvent.type(screen.getByLabelText('Anything longer credits'), '5');

    expect(screen.getByText('Tier 2 must be longer than tier 1.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it("shows the server's problems when it still refuses", async () => {
    vi.mocked(creditsApi.createPricingRule).mockRejectedValue(
      new ApiError(
        {
          code: 'VALIDATION_FAILED',
          message: 'The pricing rule is not valid.',
          details: { problems: ['The last tier must be open-ended (upToSeconds: null).'] },
          traceId: 't1',
        },
        422,
      ),
    );
    renderDialog();

    await userEvent.type(screen.getByLabelText('Tier 1 seconds'), '60');
    await userEvent.type(screen.getByLabelText('Tier 1 credits'), '2');
    await userEvent.type(screen.getByLabelText('Anything longer credits'), '5');
    await userEvent.click(submit());

    expect(await screen.findByText('The last tier must be open-ended (upToSeconds: null).')).toBeInTheDocument();
  });
});

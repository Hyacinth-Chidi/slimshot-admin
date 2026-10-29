import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingCard } from '@/components/credits/setting-card';
import { SIGN_IN_CODES_CARD } from '@/components/credits/setting-cards';
import type { CreditSettings, CreditSettingsPatch } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { BlockedDomainsCard } from './blocked-domains-card';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, fetchCreditSettings: vi.fn(), updateCreditSettings: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

/** A server that applies each PUT when it arrives and answers after `delay` ms. */
function fakeServer(initial: Partial<CreditSettings>) {
  let state = { ...initial } as CreditSettings;
  const delays: number[] = [];
  vi.mocked(creditsApi.fetchCreditSettings).mockImplementation(async () => ({ ...state }));
  vi.mocked(creditsApi.updateCreditSettings).mockImplementation(async (patch: CreditSettingsPatch) => {
    state = { ...state, ...patch };
    const answer = { ...state };
    await new Promise((r) => setTimeout(r, delays.shift() ?? 0));
    return answer;
  });
  return { delays, get state() { return state; } };
}

/** Both cards read the one settings row, as on the Sign-in security page. */
function Page() {
  const q = useQuery({ queryKey: ['credits', 'settings'], queryFn: creditsApi.fetchCreditSettings });
  if (!q.data) return null;
  return (
    <>
      <SettingCard spec={SIGN_IN_CODES_CARD} settings={q.data} live={null} />
      <BlockedDomainsCard settings={q.data} />
    </>
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

const domainsCard = () => screen.getByRole('region', { name: 'Blocked email domains' });
const lastPut = () => vi.mocked(creditsApi.updateCreditSettings).mock.calls.at(-1)?.[0];

afterEach(() => {
  vi.resetAllMocks();
});

describe('blocked domains, with other saves around', () => {
  it("undoing an older toast reverses only that toast's change", async () => {
    const server = fakeServer({ disposableEmailDomains: ['a.com', 'b.com', 'c.com'], otpMaxAttempts: 5 });
    renderPage();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Blocked email domains' })).findByRole('button', { name: 'Remove a.com' }));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    await userEvent.click(within(domainsCard()).getByRole('button', { name: 'Remove b.com' }));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledTimes(2));

    const firstUndo = vi.mocked(toast).mock.calls[0][2]!;
    await act(async () => firstUndo.onClick());

    await vi.waitFor(() => expect(server.state.disposableEmailDomains).toEqual(['c.com', 'a.com']));
    expect(lastPut()).toEqual({ disposableEmailDomains: ['c.com', 'a.com'] });
  });

  it('never loses a domain to a slower save of another card', async () => {
    const server = fakeServer({
      disposableEmailDomains: ['a.com'],
      otpMaxAttempts: 5,
      otpResendCooldownSeconds: 60,
      otpPerEmailPerHour: 5,
      otpPerDevicePerHour: 10,
      otpPerIpPerHour: 20,
    });
    server.delays.push(600, 0); // the codes card's answer is slow, the domain's fast
    renderPage();

    const tries = await screen.findByLabelText('Wrong tries per code');
    await userEvent.clear(tries);
    await userEvent.type(tries, '6');
    await userEvent.click(within(screen.getByRole('region', { name: 'Sign-in codes' })).getByRole('button', { name: 'Save' }));
    await userEvent.type(within(domainsCard()).getByLabelText('Domain to block'), 'd.com{Enter}');

    await vi.waitFor(() => expect(creditsApi.updateCreditSettings).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 800));
    expect(server.state.disposableEmailDomains).toEqual(['a.com', 'd.com']);
    expect(within(domainsCard()).getByRole('button', { name: 'Remove d.com' })).toBeInTheDocument();

    // The next add is built from the list the server has, so d.com stays blocked.
    await userEvent.type(within(domainsCard()).getByLabelText('Domain to block'), 'e.com{Enter}');
    await vi.waitFor(() => expect(lastPut()).toEqual({ disposableEmailDomains: ['a.com', 'd.com', 'e.com'] }));
  });
});

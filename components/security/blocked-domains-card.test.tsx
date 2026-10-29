import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettings } from '@/lib/api/credits';
import * as creditsApi from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { BlockedDomainsCard, isBlockableDomain } from './blocked-domains-card';

vi.mock('@/lib/api/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/credits')>('@/lib/api/credits');
  return { ...actual, updateCreditSettings: vi.fn() };
});
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

const DOMAINS = ['mailinator.com', 'tempmail.dev', '10minutemail.com'];
const settings = (domains = DOMAINS) => ({ disposableEmailDomains: domains }) as CreditSettings;

function renderCard(domains = DOMAINS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(creditsApi.updateCreditSettings).mockImplementation(async (patch) => settings(patch.disposableEmailDomains));
  render(
    <QueryClientProvider client={client}>
      <BlockedDomainsCard settings={settings(domains)} />
    </QueryClientProvider>,
  );
}

const card = () => screen.getByRole('region', { name: 'Blocked email domains' });
const box = () => within(card()).getByPlaceholderText('Add a domain, e.g. tempmail.com');

afterEach(() => {
  vi.resetAllMocks();
});

describe('isBlockableDomain', () => {
  it.each(['tempmail.com', 'mail.example.co.uk', 'x-y.io', '10minutemail.com'])('accepts %s', (d) => {
    expect(isBlockableDomain(d)).toBe(true);
  });
  it.each(['tempmail', '-bad.com', 'bad-.com', 'a..com', 'user@tempmail.com', 'tempmail.c0m', ''])('refuses %s', (d) => {
    expect(isBlockableDomain(d)).toBe(false);
  });
});

describe('BlockedDomainsCard', () => {
  it('lists the domains with a count and a way to remove each', () => {
    renderCard();
    expect(within(card()).getByText('3 domains')).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'Remove tempmail.dev' })).toBeInTheDocument();
  });

  it('adds a domain, normalised, and saves the whole list', async () => {
    renderCard();
    await userEvent.type(box(), ' TempMail.com ');
    await userEvent.click(within(card()).getByRole('button', { name: 'Add' }));

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({
      disposableEmailDomains: [...DOMAINS, 'tempmail.com'],
    });
    expect(toast).toHaveBeenCalledWith('Blocked tempmail.com', 'default', expect.objectContaining({ label: 'Undo' }));
    expect(box()).toHaveValue('');
  });

  it('adds with Enter too', async () => {
    renderCard();
    await userEvent.type(box(), 'yopmail.com{Enter}');
    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ disposableEmailDomains: [...DOMAINS, 'yopmail.com'] });
  });

  it('refuses a duplicate or a non-domain without saving', async () => {
    renderCard();
    await userEvent.type(box(), 'Mailinator.com');
    await userEvent.click(within(card()).getByRole('button', { name: 'Add' }));
    expect(within(card()).getByText('mailinator.com is already blocked')).toBeInTheDocument();

    await userEvent.clear(box());
    await userEvent.type(box(), 'not a domain');
    await userEvent.click(within(card()).getByRole('button', { name: 'Add' }));
    expect(within(card()).getByText('Enter a domain like tempmail.com')).toBeInTheDocument();

    expect(creditsApi.updateCreditSettings).not.toHaveBeenCalled();
  });

  it('removes a domain and offers Undo', async () => {
    renderCard();
    await userEvent.click(within(card()).getByRole('button', { name: 'Remove tempmail.dev' }));

    expect(creditsApi.updateCreditSettings).toHaveBeenCalledWith({ disposableEmailDomains: ['mailinator.com', '10minutemail.com'] });
    const [message, variant, action] = vi.mocked(toast).mock.calls[0];
    expect([message, variant]).toEqual(['Unblocked tempmail.dev', 'default']);

    action!.onClick();
    await vi.waitFor(() => expect(creditsApi.updateCreditSettings).toHaveBeenCalledTimes(2));
    // Undo re-adds that one domain to the list as it is now (at the end: order never matters).
    expect(creditsApi.updateCreditSettings).toHaveBeenLastCalledWith({
      disposableEmailDomains: ['mailinator.com', '10minutemail.com', 'tempmail.dev'],
    });
  });

  it('shows a search box only past 20 domains', async () => {
    renderCard();
    expect(within(card()).queryByRole('searchbox', { name: 'Search domains' })).toBeNull();
  });

  it('filters the list with the search box', async () => {
    const many = Array.from({ length: 25 }, (_, i) => `spam${i}.com`);
    renderCard(many);
    await userEvent.type(within(card()).getByRole('searchbox', { name: 'Search domains' }), 'spam2');
    const chips = within(card()).getAllByRole('button', { name: /^Remove / });
    expect(chips.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove spam2.com',
      'Remove spam20.com',
      'Remove spam21.com',
      'Remove spam22.com',
      'Remove spam23.com',
      'Remove spam24.com',
    ]);
  });
});

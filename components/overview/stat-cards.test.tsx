import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { formatBytes, StatCards } from './stat-cards';

const HEALTHY = { total: 318, published: 204, failed: 0, totalBytes: 1_288_490_188 };
const USERS = { total: 1284, thisWeek: 56 };
const CREDITS = { spent: 3420, given: 5100, days: 30 };

function card(name: string) {
  return screen.getByTestId(`stat-${name}`);
}

function renderCards(overrides: Partial<ComponentProps<typeof StatCards>> = {}) {
  return render(<StatCards stats={HEALTHY} users={USERS} credits={CREDITS} {...overrides} />);
}

describe('StatCards', () => {
  it('shows the library, its users and the credits spent, with their labels', () => {
    renderCards();
    expect(within(card('total')).getByText('Total assets')).toBeInTheDocument();
    expect(within(card('total')).getByText('318')).toBeInTheDocument();
    expect(within(card('published')).getByText('Live in the app')).toBeInTheDocument();
    expect(within(card('published')).getByText('204')).toBeInTheDocument();
    expect(within(card('users')).getByText('Users')).toBeInTheDocument();
    expect(within(card('users')).getByText('1,284')).toBeInTheDocument();
    expect(within(card('credits')).getByText('Credits spent')).toBeInTheDocument();
    expect(within(card('credits')).getByText('3,420')).toBeInTheDocument();
  });

  // They sat at 0 nearly all the time; the owner wanted users and credits there.
  it('has no Processing or Failed card', () => {
    renderCards();
    expect(screen.queryByTestId('stat-processing')).toBeNull();
    expect(screen.queryByTestId('stat-failed')).toBeNull();
    expect(screen.getAllByTestId(/^stat-/)).toHaveLength(4);
  });

  it('says how much storage the library uses', () => {
    renderCards();
    expect(within(card('total')).getByText('1.2 GB stored')).toBeInTheDocument();
  });

  it('shows the live share of the library as text and as a meter', () => {
    renderCards();
    expect(within(card('published')).getByText('64% of the library')).toBeInTheDocument();
    const meter = within(card('published')).getByRole('meter', { name: /live in the app/i });
    expect(meter).toHaveAttribute('aria-valuenow', '64');
  });

  it('handles an empty library without dividing by zero', () => {
    renderCards({ stats: { total: 0, published: 0, failed: 0, totalBytes: 0 } });
    expect(within(card('published')).getByText('Nothing published yet')).toBeInTheDocument();
    expect(within(card('total')).getByText('No files stored yet')).toBeInTheDocument();
  });

  it('stays calm when nothing failed', () => {
    renderCards();
    expect(card('total')).toHaveAttribute('data-tone', 'default');
    expect(screen.queryByRole('link', { name: /failed/i })).toBeNull();
  });

  // The Failed card's alarm, kept on Total assets.
  it('flags failed uploads on Total assets and links to them', () => {
    renderCards({ stats: { ...HEALTHY, failed: 2 } });
    expect(card('total')).toHaveAttribute('data-tone', 'error');
    expect(within(card('total')).getByText('1.2 GB stored')).toBeInTheDocument();
    const link = within(card('total')).getByRole('link', { name: 'Review 2 failed assets' });
    expect(link).toHaveAttribute('href', '/audio?status=failed');
    expect(link).toHaveTextContent('2 failed');
    // A link inside a link is invalid HTML, and browsers split it apart.
    expect(link.parentElement?.closest('a')).toBeNull();
  });

  it('names one failed upload in the singular', () => {
    renderCards({ stats: { ...HEALTHY, failed: 1 } });
    expect(screen.getByRole('link', { name: 'Review 1 failed asset' })).toBeInTheDocument();
  });

  it('says how many users joined this week, and opens the Users page', () => {
    renderCards();
    expect(within(card('users')).getByText('+56 this week')).toBeInTheDocument();
    expect(card('users')).toHaveAttribute('href', '/users');
  });

  it('says when nobody joined this week', () => {
    renderCards({ users: { total: 1284, thisWeek: 0 } });
    expect(within(card('users')).getByText('No sign-ups this week')).toBeInTheDocument();
  });

  it('gives the window and the credits given, and opens the Credits pages', () => {
    renderCards();
    expect(within(card('credits')).getByText('Last 30 days · 5,100 given')).toBeInTheDocument();
    expect(card('credits')).toHaveAttribute('href', '/credits/pricing');
  });

  it('leaves out given when nothing was', () => {
    renderCards({ credits: { spent: 0, given: 0, days: 30 } });
    expect(within(card('credits')).getByText('0')).toBeInTheDocument();
    expect(within(card('credits')).getByText('Last 30 days')).toBeInTheDocument();
  });

  it('formats large numbers with separators', () => {
    renderCards({ stats: { ...HEALTHY, total: 12_840 } });
    expect(within(card('total')).getByText('12,840')).toBeInTheDocument();
  });

  it('shows a dash in every card while loading', () => {
    render(<StatCards stats={undefined} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  // Each card's figures arrive on a request of their own.
  it('fills each card as soon as its own figures land', () => {
    render(<StatCards stats={HEALTHY} />);
    expect(within(card('total')).getByText('318')).toBeInTheDocument();
    expect(within(card('users')).getByText('—')).toBeInTheDocument();
    expect(within(card('credits')).getByText('—')).toBeInTheDocument();
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [900, '900 B'],
    [1_536, '1.5 KB'],
    [52_428_800, '50 MB'],
    [1_288_490_188, '1.2 GB'],
  ])('%d bytes → %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { creditDays } from '@/lib/api/credits';
import { CreditsWaveform } from './credits-waveform';

const TODAY = new Date('2026-10-05T12:00:00Z');

const days = creditDays(
  [
    { day: '2026-10-04', type: 'rewarded_ad', granted: 10, spent: 0 },
    { day: '2026-10-04', type: 'feature_charge', granted: 0, spent: 4 },
    { day: '2026-10-05', type: 'signup_bonus', granted: 100, spent: 0 },
  ],
  30,
  TODAY,
);

const height = (el: HTMLElement) => parseFloat(el.style.height);

describe('CreditsWaveform', () => {
  it('draws one column per day with credits granted above and spent below', () => {
    render(<CreditsWaveform days={days} />);

    const columns = screen.getAllByTestId('credits-day');
    expect(columns).toHaveLength(30);
    const oct4 = columns[28];
    expect(oct4).toHaveAttribute('data-granted', '10');
    expect(oct4).toHaveAttribute('data-spent', '4');
    expect(height(within(oct4).getByTestId('granted-bar'))).toBeGreaterThan(
      height(within(oct4).getByTestId('spent-bar')),
    );
  });

  it('puts both directions on one shared scale', () => {
    render(<CreditsWaveform days={days} />);
    const columns = screen.getAllByTestId('credits-day');
    // The day of 100 granted is the peak: full height. 10 granted is a tenth of it.
    expect(height(within(columns[29]).getByTestId('granted-bar'))).toBe(100);
    expect(height(within(columns[28]).getByTestId('granted-bar'))).toBe(10);
    expect(height(within(columns[28]).getByTestId('spent-bar'))).toBe(4);
  });

  it('labels both series with their totals for the window', () => {
    render(<CreditsWaveform days={days} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Granted')).toBeInTheDocument();
    expect(within(legend).getByText('110')).toBeInTheDocument();
    expect(within(legend).getByText('Spent')).toBeInTheDocument();
    expect(within(legend).getByText('4')).toBeInTheDocument();
  });

  it('moves the readout between days with the arrow keys, listing each type', () => {
    render(<CreditsWaveform days={days} />);
    const plot = screen.getByRole('group', { name: /Credits per day/ });

    fireEvent.focus(plot);
    expect(screen.getByTestId('credits-readout')).toHaveTextContent('Signup bonus');

    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    const readout = screen.getByTestId('credits-readout');
    expect(readout).toHaveTextContent('granted 10 · spent 4');
    expect(readout).toHaveTextContent('Rewarded ad');
    expect(readout).toHaveTextContent('Auto caption');
  });

  it('hides its data table in a box that can shrink, so it adds no empty scroll below the page', () => {
    // A <table> can't be squeezed below its rows' height, so sr-only on the table
    // itself leaves an invisible ~600px box hanging below the last panel.
    render(<CreditsWaveform days={days} />);
    const table = screen.getByRole('table', { name: /credits granted and spent per day/i });
    expect(table).not.toHaveClass('sr-only');
    expect(table.parentElement?.tagName).toBe('DIV');
    expect(table.parentElement).toHaveClass('sr-only');
  });

  it('shows a loading state while the data is on its way', () => {
    render(<CreditsWaveform days={undefined} />);
    expect(screen.getByRole('heading', { name: 'Credits, last 30 days' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('credits-day')).toHaveLength(0);
  });
});

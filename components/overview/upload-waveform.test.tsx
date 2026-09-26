import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UploadPoint } from '@/lib/api/stats';
import { UploadWaveform } from './upload-waveform';

function days(counts: number[]): UploadPoint[] {
  // Oldest first, ending on 2026-09-26 — the shape zeroFill produces.
  const end = Date.UTC(2026, 8, 26);
  return counts.map((count, i) => ({
    date: new Date(end - (counts.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

const THIRTY = days([...Array(27).fill(0), 3, 0, 6]);

describe('UploadWaveform', () => {
  it('draws one column per day', () => {
    render(<UploadWaveform points={THIRTY} />);
    expect(screen.getAllByTestId('waveform-day')).toHaveLength(30);
  });

  it('states the total as a plain sentence', () => {
    render(<UploadWaveform points={THIRTY} />);
    expect(screen.getByRole('heading', { name: '9 uploads in the last 30 days' })).toBeInTheDocument();
  });

  it('uses the singular for one upload', () => {
    render(<UploadWaveform points={days([...Array(29).fill(0), 1])} />);
    expect(screen.getByRole('heading', { name: '1 upload in the last 30 days' })).toBeInTheDocument();
  });

  it('draws quiet days as silence and scales the rest to the busiest day', () => {
    render(<UploadWaveform points={THIRTY} />);
    const cols = screen.getAllByTestId('waveform-day');
    expect(cols[0]).toHaveAttribute('data-silent', 'true');
    expect(cols[29].querySelector('[data-bar]')).toHaveStyle({ height: '100%' });
    expect(cols[27].querySelector('[data-bar]')).toHaveStyle({ height: '50%' });
  });

  it('invites an upload when the month was silent', () => {
    render(<UploadWaveform points={days(Array(30).fill(0))} />);
    expect(screen.getByRole('heading', { name: 'No uploads in the last 30 days' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload audio' })).toHaveAttribute('href', '/assets');
  });

  it('shows a neutral heading and no numbers while loading', () => {
    render(<UploadWaveform points={undefined} />);
    expect(screen.getByRole('heading', { name: 'Uploads, last 30 days' })).toBeInTheDocument();
    expect(screen.getByTestId('waveform-plot')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('waveform-tooltip')).toBeNull();
  });

  it('labels the first day and today on the time axis', () => {
    render(<UploadWaveform points={THIRTY} />);
    const axis = screen.getByTestId('waveform-axis');
    expect(axis).toHaveTextContent('28 Aug');
    expect(axis).toHaveTextContent('Today');
  });

  it('moves a playhead with the arrow keys and reads the day out', () => {
    render(<UploadWaveform points={THIRTY} />);
    const plot = screen.getByTestId('waveform-plot');

    fireEvent.focus(plot);
    let tip = screen.getByTestId('waveform-tooltip');
    expect(tip).toHaveTextContent('6 uploads');
    expect(tip).toHaveTextContent('Sat 26 Sep');

    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    tip = screen.getByTestId('waveform-tooltip');
    expect(tip).toHaveTextContent('3 uploads');
    expect(tip).toHaveTextContent('Thu 24 Sep');

    fireEvent.keyDown(plot, { key: 'Home' });
    expect(screen.getByTestId('waveform-tooltip')).toHaveTextContent('No uploads');

    fireEvent.blur(plot);
    expect(screen.queryByTestId('waveform-tooltip')).toBeNull();
  });

  it('keeps every value reachable without hovering, in a table', () => {
    render(<UploadWaveform points={THIRTY} />);
    const table = screen.getByRole('table', { name: /uploads per day/i });
    expect(within(table).getAllByRole('row')).toHaveLength(31); // header + 30 days
  });
});

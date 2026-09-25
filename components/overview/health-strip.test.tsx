import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthStrip } from './health-strip';

describe('HealthStrip', () => {
  it('renders nothing when the queue is healthy', () => {
    // A panel that says "all healthy" every day trains the reader to ignore
    // it, so the strip only appears when something is actually wrong.
    const { container } = render(<HealthStrip failed={0} delayed={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when there are failures', () => {
    render(<HealthStrip failed={3} delayed={0} />);
    expect(screen.getByText(/3 failed/i)).toBeInTheDocument();
  });

  it('renders when there are delayed jobs', () => {
    render(<HealthStrip failed={0} delayed={7} />);
    expect(screen.getByText(/7 delayed/i)).toBeInTheDocument();
  });
});

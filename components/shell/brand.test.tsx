import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileTopBar } from './mobile-top-bar';

vi.mock('./logout-button', () => ({ performLogout: vi.fn() }));

describe('the SlimShot logo', () => {
  it('heads the phone top bar, beside the name', () => {
    render(<MobileTopBar />);
    const bar = screen.getByTestId('mobile-top-bar');
    const logo = bar.querySelector('img');
    expect(logo).toHaveAttribute('src', '/logo.png');
    expect(logo).toHaveAttribute('alt', '');
    expect(bar).toHaveTextContent('SlimShot');
  });
});

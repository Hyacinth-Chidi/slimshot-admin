import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

describe('Login page', () => {
  it('shows the SlimShot logo above the form', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LoginPage />
      </QueryClientProvider>,
    );
    const logo = document.querySelector('img');
    expect(logo).toHaveAttribute('src', '/logo.png');
    expect(screen.getByText('SlimShot')).toBeInTheDocument();
  });
});

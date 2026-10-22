import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { librarySection } from '@/lib/library/kinds';
import { LibraryHeader } from './library-header';

vi.mock('next/navigation', () => ({ usePathname: () => '/fonts/order' }));

function tabs(name: string) {
  return within(screen.getByRole('navigation', { name })).getAllByRole('link');
}

describe('LibraryHeader', () => {
  it('shows Library › Fonts with the Fonts and Order tabs, and no Categories', () => {
    render(<LibraryHeader section={librarySection('font')!} />);

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Library');
    expect(screen.getByRole('heading', { name: 'Fonts' })).toBeInTheDocument();
    expect(tabs('Fonts sections').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Fonts', '/fonts'],
      ['Order', '/fonts/order'],
    ]);
    expect(screen.getByRole('link', { name: 'Order' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Audio to Sounds and Categories', () => {
    render(<LibraryHeader section={librarySection('audio')!} />);
    expect(tabs('Audio sections').map((a) => a.textContent)).toEqual(['Sounds', 'Categories']);
  });
});

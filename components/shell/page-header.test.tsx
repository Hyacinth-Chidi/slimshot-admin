import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader, SectionTabs } from './page-header';

let pathname = '/audio';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('PageHeader', () => {
  it('shows where you are, the title and the page action', () => {
    render(
      <PageHeader
        crumbs={[{ label: 'Library' }, { label: 'Audio', href: '/audio' }]}
        title="Rain"
        actions={<button type="button">Upload</button>}
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByText('Library')).toBeInTheDocument();
    expect(within(trail).getByRole('link', { name: 'Audio' })).toHaveAttribute('href', '/audio');
    expect(screen.getByRole('heading', { level: 1, name: 'Rain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('shows a subtitle under the title', () => {
    render(<PageHeader title="Pricing" subtitle="What each paid feature costs in the app." />);
    expect(screen.getByText('What each paid feature costs in the app.')).toBeInTheDocument();
  });

  it('has no breadcrumb trail when given none', () => {
    render(<PageHeader title="Overview" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});

describe('SectionTabs', () => {
  const TABS = [
    { label: 'Sounds', href: '/audio' },
    { label: 'Categories', href: '/audio/categories' },
  ];

  it('links each tab and marks only the current page', () => {
    pathname = '/audio/categories';
    render(<SectionTabs label="Audio sections" items={TABS} />);
    const nav = screen.getByRole('navigation', { name: 'Audio sections' });
    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Sounds' })).not.toHaveAttribute('aria-current');
  });

  it('hides phone-only tabs from md up', () => {
    pathname = '/audio';
    render(<SectionTabs label="Audio sections" items={TABS} phoneOnly />);
    expect(screen.getByRole('navigation', { name: 'Audio sections' })).toHaveClass('md:hidden');
  });

  it('shows ordinary tabs at every size', () => {
    pathname = '/audio';
    render(<SectionTabs label="Audio sections" items={TABS} />);
    expect(screen.getByRole('navigation', { name: 'Audio sections' })).not.toHaveClass('md:hidden');
  });

  it('marks the first tab on its own page, not on the pages under it', () => {
    pathname = '/audio';
    render(<SectionTabs label="Audio sections" items={TABS} />);
    expect(screen.getByRole('link', { name: 'Sounds' })).toHaveAttribute('aria-current', 'page');
  });
});

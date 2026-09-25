import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Sheet, SheetContent, SheetTitle } from './sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Switch } from './switch';

describe('Dialog', () => {
  it('renders its title and content when open, styled with border and no shadow', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete category</DialogTitle>
          <p>Are you sure?</p>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText('Delete category')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    const content = screen.getByRole('dialog');
    expect(content).toHaveClass('bg-surface');
    expect(content.className).toMatch(/\bborder\b/);
    expect(content.className).not.toMatch(/shadow/);
  });

  it('is a bottom sheet below md and a centred dialog at md+ (spec §7)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete category</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole('dialog');
    // Below md: bottom-anchored, full-width, rounded top corners only.
    expect(content).toHaveClass('inset-x-0', 'bottom-0', 'rounded-t-xl', 'border-t');
    // md+: back to centred, both corners rounded.
    expect(content).toHaveClass('md:top-1/2', 'md:left-1/2', 'md:rounded-xl');
  });
});

describe('Sheet', () => {
  it('renders content when open with side="bottom" and no shadow class', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Filters</SheetTitle>
          <p>Filter body</p>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Filter body')).toBeInTheDocument();

    const content = screen.getByRole('dialog');
    expect(content.className).not.toMatch(/shadow/);
  });
});

describe('DropdownMenu', () => {
  it('renders an item with role menuitem when opened', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByText('Open menu'));

    expect(await screen.findByRole('menuitem')).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('renders role switch and toggles aria-checked on click', async () => {
    const user = userEvent.setup();
    render(<Switch />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

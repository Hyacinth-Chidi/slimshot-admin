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

/**
 * C1: shadcn's "radix-nova" classes use bare `data-[state=open]:` / `data-[state=checked]:`
 * variants, which only work when shadcn's own CSS maps them onto Radix's
 * `data-state`. Without that mapping Tailwind compiles them to
 * `[data-open]` / `[data-checked]` — attributes Radix never emits — so the
 * switch showed no state and no open/close styling applied. Every
 * state-keyed class must be keyed on the attribute Radix actually emits,
 * `data-state`. (jsdom has no stylesheet, so the pin is: the element carries
 * `data-state=X` AND the styling class is `data-[state=X]:…`.)
 */
const UNMAPPED_STATE_VARIANT = /(^|:)data-(open|closed|checked|unchecked):/;

function unmappedStateClasses(root: ParentNode = document.body): string[] {
  const offenders: string[] = [];
  root.querySelectorAll<HTMLElement>('[class]').forEach((el) => {
    for (const token of el.getAttribute('class')!.split(/\s+/)) {
      if (UNMAPPED_STATE_VARIANT.test(token)) offenders.push(token);
    }
  });
  return offenders;
}

describe('state variants are keyed on Radix data-state (C1)', () => {
  it('a checked switch carries data-state="checked" and its checked styling is keyed on it', () => {
    render(<Switch defaultChecked aria-label="Active" />);
    const root = screen.getByRole('switch');
    const thumb = root.querySelector('[data-slot="switch-thumb"]')!;

    expect(root).toHaveAttribute('data-state', 'checked');
    expect(root).toHaveClass('data-[state=checked]:bg-[var(--brand-from)]');
    expect(thumb).toHaveAttribute('data-state', 'checked');
    expect(thumb).toHaveClass('data-[state=checked]:translate-x-[calc(100%-2px)]');
  });

  it('an unchecked switch carries data-state="unchecked" and its track styling is keyed on it', () => {
    render(<Switch aria-label="Active" />);
    const root = screen.getByRole('switch');
    expect(root).toHaveAttribute('data-state', 'unchecked');
    expect(root).toHaveClass('data-[state=unchecked]:bg-elevated');
    expect(root.querySelector('[data-slot="switch-thumb"]')).toHaveClass(
      'data-[state=unchecked]:translate-x-0',
    );
  });

  it('an open dialog uses no unmapped variants and animates on data-state', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(unmappedStateClasses()).toEqual([]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'open');
    expect(dialog).toHaveClass('data-[state=open]:animate-in', 'data-[state=closed]:animate-out');
  });

  it('an open menu and a switch use no unmapped variants', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DropdownMenu>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Switch aria-label="s" />
      </>,
    );
    await user.click(screen.getByText('Open menu'));
    await screen.findByRole('menuitem');

    expect(unmappedStateClasses()).toEqual([]);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-state', 'open');
    expect(menu).toHaveClass('data-[state=open]:animate-in');
  });

  it('an open sheet uses no unmapped variants', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(unmappedStateClasses()).toEqual([]);
    expect(screen.getByRole('dialog')).toHaveClass('data-[state=open]:animate-in');
  });
});

describe('DialogContent width (T8b)', () => {
  it("lets a consumer's md:max-w-lg win over the default width", () => {
    render(
      <Dialog open>
        <DialogContent className="md:max-w-lg">
          <DialogTitle>Upload</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const content = screen.getByRole('dialog');
    expect(content).toHaveClass('md:max-w-lg');
    // `sm:md:max-w-sm` is a different variant stack from `md:max-w-lg`, so
    // twMerge kept both and the narrower one won in CSS order (384px).
    expect(content.className).not.toMatch(/max-w-sm/);
  });

  it('defaults to md:max-w-sm when the consumer sets no width', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('md:max-w-sm');
  });
});

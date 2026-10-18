import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Artwork } from './artwork';

describe('Artwork', () => {
  it('shows the cover image when there is one', () => {
    const { container } = render(<Artwork id="a1" size={32} src="https://cdn.test/slimshot/covers/c.png" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cdn.test/slimshot/covers/c.png');
    expect(img).toHaveAttribute('alt', '');
  });

  it('keeps the gradient tile when there is no cover', () => {
    const { container } = render(<Artwork id="a1" size={32} />);
    expect(container.querySelector('img')).toBeNull();
    expect((container.firstChild as HTMLElement).style.background).toContain('linear-gradient');
  });
});

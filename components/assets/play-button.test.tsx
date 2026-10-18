import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopPlayback } from '@/lib/audio/row-player';
import { PlayButton } from './play-button';

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // jsdom has no media playback.
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  act(() => stopPlayback());
  vi.restoreAllMocks();
});

describe('PlayButton', () => {
  it('plays the sound and turns into a pause button', async () => {
    render(<PlayButton id="a1" title="Rain" url="https://cdn.test/a1.mp3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Rain' }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause Rain' })).toBeInTheDocument();
  });

  it('stops when pressed again', async () => {
    render(<PlayButton id="a1" title="Rain" url="https://cdn.test/a1.mp3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Rain' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pause Rain' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play Rain' })).toBeInTheDocument();
  });

  it('plays one sound at a time: starting another stops the first', async () => {
    render(
      <>
        <PlayButton id="a1" title="Rain" url="https://cdn.test/a1.mp3" />
        <PlayButton id="a2" title="Wind" url="https://cdn.test/a2.mp3" />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Play Rain' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play Wind' }));
    expect(screen.getByRole('button', { name: 'Play Rain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause Wind' })).toBeInTheDocument();
  });

  it('goes back to play when the sound ends', async () => {
    render(<PlayButton id="a1" title="Rain" url="https://cdn.test/a1.mp3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Rain' }));
    const audio = play.mock.contexts[0] as HTMLAudioElement;
    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });
    expect(screen.getByRole('button', { name: 'Play Rain' })).toBeInTheDocument();
  });

  it('goes back to play when the browser refuses to play', async () => {
    play.mockRejectedValueOnce(new Error('NotSupportedError'));
    render(<PlayButton id="a1" title="Rain" url="https://cdn.test/a1.mp3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Rain' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Play Rain' })).toBeInTheDocument());
  });
});

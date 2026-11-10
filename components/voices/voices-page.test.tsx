import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import * as voicesApi from '@/lib/api/voices';
import type { Voice } from '@/lib/api/voices';
import { togglePlayback } from '@/lib/audio/row-player';
import { toast } from '@/lib/use-toast';
import { VoicesPage } from './voices-page';

vi.mock('@/lib/api/voices', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/voices')>('@/lib/api/voices');
  return {
    ...actual,
    fetchVoices: vi.fn(),
    syncVoices: vi.fn(),
    updateVoice: vi.fn(),
    reorderVoices: vi.fn(),
    makeVoiceSample: vi.fn(),
  };
});
// jsdom has no audio playback; the row player is the seam.
vi.mock('@/lib/audio/row-player', () => ({ togglePlayback: vi.fn(), stopPlayback: vi.fn(), usePlayingId: () => null }));
vi.mock('@/lib/use-toast', () => ({ toast: vi.fn() }));

function voice(overrides: Partial<Voice>): Voice {
  return {
    id: 'v1',
    provider: 'xai',
    providerVoiceId: 'eve',
    label: 'Eve',
    sortOrder: 0,
    enabled: true,
    sampleStorageId: 's1',
    sampleStorageKey: 'slimshot/voices/samples/a.mp3',
    sampleUrl: 'https://cdn.test/a.mp3',
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-10T09:00:00Z',
    ...overrides,
  };
}

const EVE = voice({});
const REX = voice({
  id: 'v2',
  providerVoiceId: 'rex',
  label: 'Rex',
  sortOrder: 1,
  enabled: false,
  sampleStorageId: null,
  sampleStorageKey: null,
  sampleUrl: null,
});

beforeEach(() => {
  vi.mocked(voicesApi.fetchVoices).mockReset().mockResolvedValue([EVE, REX]);
  vi.mocked(voicesApi.syncVoices).mockReset();
  vi.mocked(voicesApi.updateVoice).mockReset();
  vi.mocked(voicesApi.reorderVoices).mockReset();
  vi.mocked(voicesApi.makeVoiceSample).mockReset();
  vi.mocked(togglePlayback).mockReset();
  vi.mocked(toast).mockReset();
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <VoicesPage />
    </QueryClientProvider>,
  );
}

const row = (id: string) => screen.getByTestId(`voice-row-${id}`);

/** The names in list order, as their fields hold them. */
async function names() {
  const list = await screen.findByRole('list', { name: 'Voices' });
  return within(list)
    .getAllByRole('listitem')
    .map((li) => (within(li).getByRole('textbox') as HTMLInputElement).value);
}

describe('VoicesPage', () => {
  it('lists voices with label, sample and switch', async () => {
    renderPage();

    expect(await names()).toEqual(['Eve', 'Rex']);
    expect(within(row('v1')).getByText('eve')).toBeInTheDocument();
    expect(within(row('v1')).getByRole('button', { name: 'Play Eve' })).toBeInTheDocument();
    expect(within(row('v1')).getByRole('switch', { name: 'Offer Eve in the app' })).toBeChecked();
    expect(within(row('v2')).getByText('No sample yet')).toBeInTheDocument();
  });

  it('the switch is off and disabled without a sample', async () => {
    renderPage();
    await names();

    const offer = within(row('v2')).getByRole('switch', { name: 'Offer Rex in the app' });
    expect(offer).not.toBeChecked();
    expect(offer).toBeDisabled();
  });

  it('switching a voice off saves it', async () => {
    vi.mocked(voicesApi.updateVoice).mockResolvedValue({ ...EVE, enabled: false });
    renderPage();
    await names();

    await userEvent.click(within(row('v1')).getByRole('switch', { name: 'Offer Eve in the app' }));

    expect(voicesApi.updateVoice).toHaveBeenCalledWith('v1', { enabled: false });
    await waitFor(() =>
      expect(within(row('v1')).getByRole('switch', { name: 'Offer Eve in the app' })).not.toBeChecked(),
    );
  });

  it('Make sample plays the new one', async () => {
    const fresh = 'https://cdn.test/rex-new.mp3';
    vi.mocked(voicesApi.makeVoiceSample).mockResolvedValue({
      ...REX,
      sampleUrl: fresh,
      sampleStorageId: 's1',
      sampleStorageKey: 'slimshot/voices/samples/new.mp3',
    });
    renderPage();
    await names();

    await userEvent.click(within(row('v2')).getByRole('button', { name: 'Make sample for Rex' }));

    expect(voicesApi.makeVoiceSample).toHaveBeenCalledWith('v2');
    await waitFor(() => expect(togglePlayback).toHaveBeenCalledWith('voice:v2', fresh));
    expect(within(row('v2')).getByRole('button', { name: 'Play Rex' })).toBeInTheDocument();
    expect(within(row('v2')).getByRole('switch', { name: 'Offer Rex in the app' })).toBeEnabled();
  });

  it('renaming saves on blur', async () => {
    vi.mocked(voicesApi.updateVoice).mockResolvedValue({ ...REX, label: 'Rex Deep' });
    renderPage();
    await names();
    const field = within(row('v2')).getByRole('textbox', { name: 'Name of rex' });

    await userEvent.clear(field);
    await userEvent.type(field, '  Rex Deep ');
    expect(voicesApi.updateVoice).not.toHaveBeenCalled();
    await userEvent.tab();

    expect(voicesApi.updateVoice).toHaveBeenCalledWith('v2', { label: 'Rex Deep' });
  });

  it('a name left unchanged or empty saves nothing, and an empty one goes back', async () => {
    renderPage();
    await names();
    const field = within(row('v2')).getByRole('textbox', { name: 'Name of rex' });

    await userEvent.click(field);
    await userEvent.tab();
    await userEvent.clear(field);
    await userEvent.tab();

    expect(voicesApi.updateVoice).not.toHaveBeenCalled();
    expect(field).toHaveValue('Rex');
  });

  it('dragging reorders and saves the full order', async () => {
    vi.mocked(voicesApi.reorderVoices).mockResolvedValue([REX, EVE]);
    renderPage();
    await names();

    fireEvent.dragStart(row('v2'));
    fireEvent.dragOver(row('v1'));
    fireEvent.drop(row('v1'));

    await waitFor(() => expect(voicesApi.reorderVoices).toHaveBeenCalledWith(['v2', 'v1']));
    expect(await names()).toEqual(['Rex', 'Eve']);
  });

  it('moves a voice with its arrows too', async () => {
    vi.mocked(voicesApi.reorderVoices).mockResolvedValue([REX, EVE]);
    renderPage();
    await names();

    expect(within(row('v1')).getByRole('button', { name: 'Move Eve up' })).toBeDisabled();
    await userEvent.click(within(row('v1')).getByRole('button', { name: 'Move Eve down' }));

    expect(voicesApi.reorderVoices).toHaveBeenCalledWith(['v2', 'v1']);
  });

  it('Sync from xAI adds the new voices', async () => {
    const ara = voice({
      id: 'v3',
      providerVoiceId: 'ara',
      label: 'Ara',
      sortOrder: 2,
      enabled: false,
      sampleStorageId: null,
      sampleStorageKey: null,
      sampleUrl: null,
    });
    vi.mocked(voicesApi.syncVoices).mockResolvedValue([EVE, REX, ara]);
    renderPage();
    await names();

    await userEvent.click(screen.getByRole('button', { name: 'Sync from xAI' }));

    expect(await names()).toEqual(['Eve', 'Rex', 'Ara']);
    expect(toast).toHaveBeenCalledWith('1 new voice, switched off');
  });

  it('without a text-to-speech key, Sync says to add one on Providers', async () => {
    const message = 'Add an xAI key under Text to speech on the Providers page, and switch it on.';
    vi.mocked(voicesApi.syncVoices).mockRejectedValue(
      new ApiError({ code: 'TTS_UNAVAILABLE', message, traceId: 't' }, 503),
    );
    renderPage();
    await names();

    await userEvent.click(screen.getByRole('button', { name: 'Sync from xAI' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(within(alert).getByRole('link', { name: 'Open AI providers' })).toHaveAttribute('href', '/system/providers');
  });

  it('says how to start when there are no voices', async () => {
    vi.mocked(voicesApi.fetchVoices).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No voices yet/)).toBeInTheDocument();
  });
});

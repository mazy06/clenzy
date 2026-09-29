import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import BaitlyVideoPlayer from './BaitlyVideoPlayer';
import { ACADEMY_EPISODES } from '../../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../../lib/messages/baitlyAcademy';

/**
 * Le lecteur de l'Académie choisit la vidéo selon l'écran : 16:9 sur ordinateur, 9:16 sur téléphone
 * ou tablette à la verticale. En tournant l'écran pendant la lecture, il change de fichier SANS
 * perdre la seconde en cours ni l'état de lecture : c'est ce que ces tests verrouillent.
 */
const episode = ACADEMY_EPISODES[0];
const ui = BAITLY_ACADEMY_MESSAGES.fr.ui;
const labels = BAITLY_ACADEMY_MESSAGES.fr.episodes[episode.slug].chapters;
let tall = false;
let listeners: Array<() => void> = [];

beforeEach(() => {
  tall = false;
  listeners = [];
  vi.stubGlobal('matchMedia', (media: string) => ({
    get matches() { return tall; },
    media,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = (startAt?: number) =>
  render(
    <BaitlyVideoPlayer episode={episode} language="fr" ui={ui} title="Épisode" chapterLabels={labels} startAt={startAt} />,
  );
const video = () => document.querySelector('video')!;
const rotate = (toTall: boolean) =>
  act(() => {
    tall = toTall;
    listeners.forEach((listener) => listener());
  });

describe('BaitlyVideoPlayer', () => {
  it('charge la version 16:9 en 1080p sur un écran large, avec son aperçu', () => {
    mount();
    expect(video().getAttribute('src')).toBe(`/academie/media/fr/${episode.slug}-16x9-1080.mp4`);
    expect(video().getAttribute('poster')).toBe(`/academie/posters/${episode.slug}-16x9.jpg`);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('passe en 9:16 quand l’écran tourne et reprend à la même seconde, en lecture', () => {
    mount();
    Object.defineProperty(video(), 'currentTime', { configurable: true, writable: true, value: 42 });
    Object.defineProperty(video(), 'paused', { configurable: true, get: () => false });
    rotate(true);
    expect(video().getAttribute('src')).toBe(`/academie/media/fr/${episode.slug}-9x16-1080.mp4`);
    expect(video().getAttribute('poster')).toBe(`/academie/posters/${episode.slug}-9x16.jpg`);
    video().currentTime = 0;
    fireEvent(video(), new Event('loadedmetadata'));
    expect(video().currentTime).toBe(42);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('reste en pause après la rotation si la vidéo était en pause', () => {
    mount();
    Object.defineProperty(video(), 'currentTime', { configurable: true, writable: true, value: 12 });
    Object.defineProperty(video(), 'paused', { configurable: true, get: () => true });
    rotate(true);
    fireEvent(video(), new Event('loadedmetadata'));
    expect(video().currentTime).toBe(12);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('démarre au chapitre demandé par un lien horodaté', () => {
    mount(66);
    fireEvent(video(), new Event('loadedmetadata'));
    expect(video().currentTime).toBe(66);
  });

  it('choisit le 720p quand le visiteur économise ses données', () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } });
    mount();
    expect(video().getAttribute('src')).toBe(`/academie/media/fr/${episode.slug}-16x9-720.mp4`);
  });

  it('annonce l’indisponibilité de la vidéo au lieu d’un lecteur muet', () => {
    mount();
    fireEvent.error(video());
    expect(screen.getByRole('status')).toHaveTextContent(ui.unavailable);
    expect(screen.getByRole('button', { name: ui.play })).toBeDisabled();
  });

  it('avance de 5 secondes au clavier sur la barre de lecture', () => {
    mount();
    const slider = screen.getByRole('slider', { name: ui.seek });
    Object.defineProperty(video(), 'currentTime', { configurable: true, writable: true, value: 0 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(video().currentTime).toBe(5);
    expect(slider).toHaveAttribute('aria-valuenow', '5');
  });
});

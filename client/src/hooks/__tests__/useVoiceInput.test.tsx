import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock SpeechRecognition ──────────────────────────────────────────────────
// On expose un constructeur configurable + une derniere instance pour pouvoir
// declencher manuellement les events depuis chaque test.

interface MockResultItem {
  transcript: string;
  isFinal: boolean;
}

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: { length: number; [k: number]: { isFinal: boolean; length: number; 0: { transcript: string } } } }) => void) | null = null;
  onerror: ((event: { error: string; message?: string }) => void) | null = null;

  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;

  start = vi.fn(() => {
    this.startCalls++;
    // Le browser appelle onstart de maniere asynchrone, on simule en sync
    // car les tests utilisent act() pour driver les transitions.
    this.onstart?.();
  });

  stop = vi.fn(() => {
    this.stopCalls++;
    this.onend?.();
  });

  abort = vi.fn(() => {
    this.abortCalls++;
    this.onend?.();
  });

  // Helpers de test
  emitResult(items: MockResultItem[]) {
    const results = items.map(item => ({
      isFinal: item.isFinal,
      length: 1,
      0: { transcript: item.transcript },
    })) as unknown as { length: number; [k: number]: { isFinal: boolean; length: number; 0: { transcript: string } } };
    (results as { length: number }).length = items.length;
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(code: string, message?: string) {
    this.onerror?.({ error: code, message });
  }
}

let lastInstance: MockSpeechRecognition | null = null;

// Wrapper class qui tracke la derniere instance creee — utilise pour driver
// les events depuis les tests. On a besoin d'une vraie classe pour pouvoir
// faire `new SpeechRecognition()` cote hook.
class TrackedMockSpeechRecognition extends MockSpeechRecognition {
  constructor() {
    super();
    lastInstance = this;
  }
}

const installMock = (variant: 'standard' | 'webkit' = 'standard') => {
  if (variant === 'webkit') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitSpeechRecognition = TrackedMockSpeechRecognition;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition = TrackedMockSpeechRecognition;
  }
};

const uninstallMock = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).SpeechRecognition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).webkitSpeechRecognition;
  lastInstance = null;
};

// Import APRES la mise en place du mock pour eviter qu'un eventuel snapshot
// de getSpeechRecognitionCtor() vu au module-load n'affecte les tests.
import { useVoiceInput } from '../useVoiceInput';

describe('useVoiceInput', () => {
  beforeEach(() => {
    uninstallMock();
  });

  afterEach(() => {
    uninstallMock();
  });

  it('isSupported = false quand aucune API native dispo', () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
  });

  it('isSupported = true via window.SpeechRecognition', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('isSupported = true via le prefixe webkit', () => {
    installMock('webkit');
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('start() configure lang/continuous/interimResults + flip isListening', () => {
    installMock();
    const { result } = renderHook(() =>
      useVoiceInput({ language: 'fr-FR', continuous: false, interimResults: true }));

    act(() => { result.current.start(); });

    expect(lastInstance).not.toBeNull();
    expect(lastInstance!.lang).toBe('fr-FR');
    expect(lastInstance!.continuous).toBe(false);
    expect(lastInstance!.interimResults).toBe(true);
    expect(lastInstance!.startCalls).toBe(1);
    expect(result.current.isListening).toBe(true);
  });

  it('start() est un no-op si non supporte (pas de throw)', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('emet un transcript et appelle onResult avec final=true', () => {
    installMock();
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));

    act(() => { result.current.start(); });

    act(() => {
      lastInstance!.emitResult([{ transcript: 'bonjour', isFinal: true }]);
    });

    expect(result.current.transcript).toBe('bonjour');
    expect(onResult).toHaveBeenCalledWith('bonjour', true);
  });

  it('aggrege les segments interim + final', () => {
    installMock();
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));

    act(() => { result.current.start(); });

    act(() => {
      lastInstance!.emitResult([
        { transcript: 'bloque ', isFinal: false },
        { transcript: 'le calendrier', isFinal: false },
      ]);
    });
    expect(result.current.transcript).toBe('bloque le calendrier');
    expect(onResult).toHaveBeenLastCalledWith('bloque le calendrier', false);

    act(() => {
      lastInstance!.emitResult([
        { transcript: 'bloque ', isFinal: true },
        { transcript: 'le calendrier de juin', isFinal: true },
      ]);
    });
    expect(result.current.transcript).toBe('bloque le calendrier de juin');
    expect(onResult).toHaveBeenLastCalledWith('bloque le calendrier de juin', true);
  });

  it('stop() declenche onend → isListening repasse a false', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    expect(result.current.isListening).toBe(true);

    act(() => { result.current.stop(); });
    expect(result.current.isListening).toBe(false);
    expect(lastInstance!.stopCalls).toBe(1);
  });

  it('expose une erreur typee quand le micro est refuse', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    act(() => {
      lastInstance!.emitError('not-allowed', 'Permission denied');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.code).toBe('not-allowed');
    expect(result.current.isListening).toBe(false);
  });

  it('mappe les codes inconnus vers "unknown"', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    act(() => { lastInstance!.emitError('some-weird-code'); });

    expect(result.current.error!.code).toBe('unknown');
  });

  it('cleanup au unmount : abort() est appele si une recognition est en vie', () => {
    installMock();
    const { result, unmount } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    const instance = lastInstance!;
    expect(instance.startCalls).toBe(1);

    unmount();

    expect(instance.abortCalls).toBeGreaterThanOrEqual(1);
  });

  it('start() apres un cycle complet recree une nouvelle instance', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    const first = lastInstance!;
    act(() => { result.current.stop(); });

    act(() => { result.current.start(); });
    const second = lastInstance!;

    expect(second).not.toBe(first);
    expect(second.startCalls).toBe(1);
  });

  it('transcript reset a chaque nouveau start()', () => {
    installMock();
    const { result } = renderHook(() => useVoiceInput());

    act(() => { result.current.start(); });
    act(() => {
      lastInstance!.emitResult([{ transcript: 'first', isFinal: true }]);
    });
    expect(result.current.transcript).toBe('first');

    act(() => { result.current.stop(); });
    act(() => { result.current.start(); });
    // transcript doit avoir ete vide au demarrage
    expect(result.current.transcript).toBe('');
  });
});

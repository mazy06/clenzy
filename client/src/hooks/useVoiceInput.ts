import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wrapper minimal autour de la Web Speech API (SpeechRecognition) pour la
 * dictee vocale dans un champ texte.
 *
 * Pourquoi pas une lib externe (react-speech-recognition, etc.) ?
 *   - L'API native est suffisante pour un usage "single shot" (continuous=false)
 *   - Pas de dependance supplementaire
 *   - Controle precis du cleanup (eviter les fuites de microphone)
 *
 * Compatibilite :
 *   - Chrome / Edge / Safari : prefixe webkit
 *   - Firefox : non supporte (renvoie isSupported=false → cacher le bouton UI)
 *
 * @example
 *   const { isSupported, isListening, transcript, start, stop, error } =
 *     useVoiceInput({ language: 'fr-FR', onResult: (text) => setValue(text) });
 */

/**
 * Sous-set du contrat SpeechRecognition utilise par ce hook.
 * On evite d'importer @types/dom-speech-recognition (pas dans le projet) en
 * declarant juste ce dont on a besoin.
 */
interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type VoiceInputErrorCode =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'unknown';

export interface VoiceInputError {
  code: VoiceInputErrorCode;
  message: string;
}

export interface UseVoiceInputOptions {
  /** Code BCP-47, ex: 'fr-FR', 'en-US'. Defaut: 'fr-FR'. */
  language?: string;
  /** Si true, continue d'ecouter apres une phrase. Defaut: false. */
  continuous?: boolean;
  /** Si true, expose les resultats intermediaires (live preview). Defaut: true. */
  interimResults?: boolean;
  /**
   * Callback appele a chaque update de transcript (interim + final).
   * Si fourni, sert a injecter directement dans un champ controle sans relire
   * `transcript` (evite un rerender supplementaire cote consommateur).
   */
  onResult?: (transcript: string, isFinal: boolean) => void;
}

export interface UseVoiceInputResult {
  /** True si l'API SpeechRecognition est disponible dans ce browser. */
  isSupported: boolean;
  /** True entre start() et l'evenement onend (= ecoute active). */
  isListening: boolean;
  /** Dernier transcript reconnu (interim ou final). Reset a chaque start(). */
  transcript: string;
  /** Demarrer l'ecoute. No-op si non supporte ou deja en cours. */
  start: () => void;
  /** Arreter l'ecoute proprement (declenche onend → isListening=false). */
  stop: () => void;
  /** Derniere erreur encountered, null si OK. Reset a chaque start(). */
  error: VoiceInputError | null;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const {
    language = 'fr-FR',
    continuous = false,
    interimResults = true,
    onResult,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported = getSpeechRecognitionCtor() !== null;

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Edge case : appelle abort en fallback si stop() echoue (recognition deja stoppee)
      try { recognition.abort(); } catch { /* swallow */ }
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current) {
      // Deja une instance en vie : on l'arrete avant de recreer (start() apres
      // un fin naturel ne marche pas sur tous les browsers).
      try { recognitionRef.current.abort(); } catch { /* swallow */ }
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      // Concatene tous les segments depuis le debut pour avoir le texte complet
      // (Chrome envoie aussi les anciens resultats). On garde le dernier "final"
      // pour callback.
      let aggregated = '';
      let lastIsFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res && res.length > 0) {
          aggregated += res[0].transcript;
          if (res.isFinal) lastIsFinal = true;
        }
      }
      const cleaned = aggregated.trim();
      setTranscript(cleaned);
      if (onResultRef.current) {
        onResultRef.current(cleaned, lastIsFinal);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = mapErrorCode(event.error);
      setError({ code, message: event.message || event.error || 'Erreur micro inconnue' });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError({
        code: 'unknown',
        message: e instanceof Error ? e.message : 'Demarrage micro impossible',
      });
      recognitionRef.current = null;
    }
  }, [language, continuous, interimResults]);

  // Cleanup au unmount — important pour ne pas laisser le micro actif
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      try { recognition.abort(); } catch { /* swallow */ }
      recognitionRef.current = null;
    };
  }, []);

  return { isSupported, isListening, transcript, start, stop, error };
}

function mapErrorCode(raw: string | undefined): VoiceInputErrorCode {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'no-speech':
    case 'aborted':
    case 'audio-capture':
    case 'network':
      return raw;
    default:
      return 'unknown';
  }
}

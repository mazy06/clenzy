import { useEffect, useRef, useState } from 'react';

// Un observateur partagé par toute la grille, plutôt qu'un par réservation.
const measurements = new Map<Element, () => void>();
let observer: ResizeObserver | undefined;
const measureFonts = () => { for (const measure of measurements.values()) measure(); };

function observeText(node: Element, measure: () => void) {
  if (measurements.size === 0) {
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver((entries) => {
      for (const entry of entries) measurements.get(entry.target)?.();
    });
    document.fonts?.addEventListener('loadingdone', measureFonts);
    void document.fonts?.ready.then(measureFonts);
  }
  measurements.set(node, measure);
  observer?.observe(node);
  return () => {
    observer?.unobserve(node);
    measurements.delete(node);
    if (measurements.size === 0) {
      observer?.disconnect();
      observer = undefined;
      document.fonts?.removeEventListener('loadingdone', measureFonts);
    }
  };
}

/** Mesure la typographie rendue pour replier les détails sans sacrifier le nom. */
export function useBaitlyTextWidth(text: string, language: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [measurement, setMeasurement] = useState<{ text: string; language: string; width: number }>();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let mounted = true;
    const measure = () => {
      if (!mounted) return;
      const width = node.getBoundingClientRect().width;
      if (width > 0) setMeasurement((previous) =>
        previous?.text === text && previous.language === language && previous.width === width
          ? previous : { text, language, width });
    };
    measure();
    const stop = observeText(node, measure);
    return () => { mounted = false; stop(); };
  }, [text, language]);
  const width = measurement?.text === text && measurement.language === language ? measurement.width : undefined;
  return { ref, width };
}

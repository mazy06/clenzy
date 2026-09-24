import { useEffect, useRef, useState } from 'react';
import {
  BAITLY_LOYALTY_STAGES,
  loyaltyStage,
} from '../data/baitlyLoyaltyPricing';

/** A visitor-triggered demonstration, paused off screen and when the tab is hidden. */
export function useBaitlyLoyaltyMotion(
  month: number,
  setMonth: (month: number) => void,
) {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const stage = loyaltyStage(month);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    media.addEventListener('change', change);
    const visibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPlaying(false);
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      media.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!playing || reduced || stage === 3) return;
    const timer = window.setTimeout(
      () => setMonth(BAITLY_LOYALTY_STAGES[stage + 1].start),
      1600,
    );
    return () => window.clearTimeout(timer);
  }, [playing, reduced, stage, setMonth]);
  const selectMonth = (value: number) => {
    setPlaying(false);
    setMonth(value);
  };
  const toggle = () => {
    if (playing && stage !== 3) setPlaying(false);
    else {
      setMonth(1);
      setPlaying(true);
    }
  };
  return { ref, reduced, playing: playing && stage !== 3, selectMonth, toggle };
}

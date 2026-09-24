import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './mockupKit';

const PHASES = [0, 1, 2, 2, 3] as const;

/** Ephemeral marketing demo state. Nothing is persisted or sent to the booking API. */
export function useBaitlyBookingDemo() {
  const [templateIndex, setTemplateIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [extras, setExtras] = useState<[boolean, boolean]>([false, false]);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const sceneRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const running = playing && visible && tabVisible && !reduced && beat < 4;
  const step = PHASES[beat];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (sceneRef.current) observer.observe(sceneRef.current);
    const updateVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => {
        const next = beat + 1;
        if (next === 3) setExtras([true, false]);
        if (next === 4) setPlaying(false);
        setBeat(next);
      },
      beat === 2 ? 2200 : 3200,
    );
    return () => window.clearTimeout(timer);
  }, [running, beat]);

  function selectTemplate(index: number) {
    setTemplateIndex(index);
    setBeat(0);
    setExtras([false, false]);
    setPlaying(false);
  }

  function goToStep(next: number) {
    setBeat(next === 3 ? 4 : next);
    setPlaying(false);
  }

  function toggleExtra(index: number) {
    setPlaying(false);
    setExtras(
      (current) =>
        current.map((value, i) => (i === index ? !value : value)) as [
          boolean,
          boolean,
        ],
    );
  }

  function togglePlayback() {
    if (beat === 4) {
      setBeat(0);
      setExtras([false, false]);
    }
    setPlaying((current) => !current);
  }

  return {
    templateIndex,
    step,
    extras,
    playing,
    running,
    reduced,
    sceneRef,
    selectTemplate,
    goToStep,
    toggleExtra,
    togglePlayback,
    pause: () => setPlaying(false),
  };
}

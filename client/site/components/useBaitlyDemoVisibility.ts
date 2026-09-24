import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './mockupKit';

/** Pause offscreen work without losing the current demonstration step. */
export function useBaitlyDemoVisibility() {
  const visibilityRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const reduced = useReducedMotion();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '-100px 0px 0px' },
    );
    if (visibilityRef.current) observer.observe(visibilityRef.current);
    const updateVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return { visibilityRef, active: visible && tabVisible && !reduced, reduced };
}

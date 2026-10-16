import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createSettledScheduler } from '../../../utils/layoutShift';

/** Shared geometry for the loading grid and the populated Baitly planning. */
export function useBaitlyPlanningViewport(
  scrollRef: RefObject<HTMLDivElement | null>,
  onHeight?: (height: number) => void,
  ready = true,
) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const publish = useRef(onHeight);
  publish.current = onHeight;
  const publishedHeight = useRef(0);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !ready) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setViewport((previous) => previous.width === width && previous.height === height
        ? previous : { width, height });
      if (height > 0 && height !== publishedHeight.current) {
        publishedHeight.current = height;
        publish.current?.(height);
      }
    };
    // Measure before data arrives: page-scoped queries need not wait for the index.
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Sidebar animations produce intermediate dimensions; publish only their settled layout.
    const settled = createSettledScheduler(measure);
    const observer = new ResizeObserver(settled.schedule);
    observer.observe(element);
    return () => {
      settled.cancel();
      observer.disconnect();
    };
  }, [scrollRef, ready]);

  return viewport;
}

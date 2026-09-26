import { useEffect, useRef } from 'react';

type BuildTimeline = (at: (ms: number, run: () => void) => void) => void;

/** Keep the exact playhead when the demo is paused, offscreen or in a hidden tab. */
export function useBaitlyPlanningTimeline(
  active: boolean,
  build: BuildTimeline,
) {
  const buildRef = useRef(build);
  buildRef.current = build;
  const state = useRef({
    elapsed: 0,
    index: 0,
    steps: null as { at: number; run: () => void }[] | null,
  });

  useEffect(() => {
    if (!active) return;
    const timeline = state.current;
    if (!timeline.steps) {
      const steps: { at: number; run: () => void }[] = [];
      buildRef.current((at, run) => steps.push({ at, run }));
      timeline.steps = steps.sort((a, b) => a.at - b.at);
    }
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const advance = () => {
      if (disposed) return;
      const elapsed = timeline.elapsed + performance.now() - started;
      const steps = timeline.steps!;
      while (
        timeline.index < steps.length &&
        steps[timeline.index].at <= elapsed
      ) {
        steps[timeline.index++].run();
      }
      if (timeline.index < steps.length) {
        timer = setTimeout(
          advance,
          Math.max(0, steps[timeline.index].at - elapsed),
        );
      }
    };
    advance();
    return () => {
      disposed = true;
      clearTimeout(timer);
      timeline.elapsed += performance.now() - started;
    };
  }, [active]);
}

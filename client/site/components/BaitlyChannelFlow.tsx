/** The three branches end at (300, 68); the shared route starts at that exact point. */
const BRANCHES = [
  'M100 0 V40 Q100 54 114 54 H286 Q300 54 300 68',
  'M300 0 V68',
  'M500 0 V40 Q500 54 486 54 H314 Q300 54 300 68',
];
const SHARED_ROUTE = 'M300 68 V100';

export default function BaitlyChannelFlow() {
  return (
    <svg
      className="bpm-sync-connectors"
      viewBox="0 0 600 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {[...BRANCHES, SHARED_ROUTE].map((path) => (
        <path
          key={path}
          d={path}
          className="bpm-sync-track"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {BRANCHES.map((path) => (
        <path
          key={path}
          d={path}
          pathLength={100}
          className="bpm-sync-data bpm-sync-data-branch"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        d={SHARED_ROUTE}
        pathLength={100}
        className="bpm-sync-data bpm-sync-data-merged"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

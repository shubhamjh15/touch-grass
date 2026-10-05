import type { WorldSnapshot } from './contract';

interface FallbackTreeProps {
  snapshot: WorldSnapshot;
  className?: string;
}

/**
 * Illustrated stand-in for the 3D tree, used when WebGL is unavailable or 3D is
 * turned off. Scales with `growth` so progress is still visible.
 */
export function FallbackTree({ snapshot, className }: FallbackTreeProps) {
  const growth = Math.min(1, Math.max(0, snapshot.growth));
  const canopy = 26 + growth * 46;
  const trunk = 18 + growth * 62;
  const canopyColor = snapshot.species === 'cherry' ? '#f472b6' : '#4ade80';

  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <ellipse cx="126" cy="214" rx="86" ry="16" fill="#18181b" />
      <ellipse cx="120" cy="208" rx="86" ry="16" fill="#4ade80" stroke="#18181b" strokeWidth="4" />
      <rect
        x={120 - 5 - growth * 5}
        y={206 - trunk}
        width={10 + growth * 10}
        height={trunk}
        rx="4"
        fill="#a16207"
        stroke="#18181b"
        strokeWidth="4"
      />
      <circle
        cx="120"
        cy={206 - trunk - canopy * 0.55}
        r={canopy}
        fill={canopyColor}
        stroke="#18181b"
        strokeWidth="4"
      />
    </svg>
  );
}

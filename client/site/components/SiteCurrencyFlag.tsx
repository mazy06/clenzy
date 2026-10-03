import type { SiteCurrency } from '../lib/siteCurrency';

// Drapeaux en SVG plutôt qu'en emoji : Windows n'affiche pas les emojis de drapeau
// (il montre « MA », « EU », « SA »). Format 3:2, décoratifs (le nom de la devise est lu).
const W = 30;
const H = 20;

/** Pentagramme marocain (étoile entrelacée) : 5 sommets reliés un sur deux. */
function pentagram(cx: number, cy: number, r: number) {
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  return [0, 2, 4, 1, 3]
    .map((i, k) => `${k ? 'L' : 'M'}${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`)
    .join(' ')
    .concat(' Z');
}

/** Étoile pleine à 5 branches (drapeau européen). */
function star(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.4 : r;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${i ? 'L' : 'M'}${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  })
    .join(' ')
    .concat(' Z');
}

function Morocco() {
  return (
    <>
      <rect width={W} height={H} fill="#C1272D" />
      <path
        d={pentagram(15, 10.6, 5.2)}
        fill="none"
        stroke="#006233"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </>
  );
}

function Europe() {
  return (
    <>
      <rect width={W} height={H} fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6;
        return (
          <path
            key={i}
            d={star(15 + 6 * Math.sin(angle), 10 - 6 * Math.cos(angle), 1.15)}
            fill="#FFCC00"
          />
        );
      })}
    </>
  );
}

function Saudi() {
  // Version simplifiée lisible en petit : inscription stylisée + sabre.
  return (
    <>
      <rect width={W} height={H} fill="#006C35" />
      <path
        d="M7 8.2 Q9 6.4 11 8.2 T15 8.2 T19 8.2 T23 8.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M8 13.2 H21.5 Q23 13.2 23 12.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <rect x={20} y={12.4} width={1} height={2.2} fill="#FFFFFF" />
    </>
  );
}

const FLAGS = { MAD: Morocco, EUR: Europe, SAR: Saudi } as const;

export function SiteCurrencyFlag({ currency }: { currency: SiteCurrency }) {
  const Flag = FLAGS[currency];
  return (
    <svg
      className="site-currency-flag"
      viewBox={`0 0 ${W} ${H}`}
      width={21}
      height={14}
      aria-hidden="true"
      focusable="false"
    >
      <Flag />
    </svg>
  );
}

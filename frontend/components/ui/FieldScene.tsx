const INK = '#111111';
const ORANGE = '#d9541e';
const SAND = '#e0d8c7';
const PALE = '#efe9dc';
const CREAM = '#f3eee3';
const EARTH = '#d3c9b5';

/** Evenly spaced x positions across the band. */
function spread(from: number, to: number, n: number) {
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

/** Hand-placed so the row does not look machine-stamped: x, base y, height, round head. */
const PLANTS: [number, number, number, boolean][] = [
  [58, 288, 58, false],
  [132, 296, 74, true],
  [204, 285, 62, false],
  [292, 298, 80, true],
  [366, 288, 66, false],
  [452, 300, 86, true],
  [536, 290, 70, false],
  [628, 299, 78, true],
  [706, 287, 60, false],
];

/** A standing crop: stalk, two leaves and a head. */
function Plant({ x, y, h, head }: { x: number; y: number; h: number; head: 'grain' | 'round' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0V${-h}`} stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d={`M0 ${-h * 0.4}c-9 0-14-4-15-10 8-1 14 3 15 10z`} fill={SAND} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={`M0 ${-h * 0.6}c9 0 14-4 15-10-8-1-14 3-15 10z`} fill={SAND} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {head === 'grain' ? (
        <ellipse cx="0" cy={-h - 9} rx="7" ry="13" fill={ORANGE} stroke={INK} strokeWidth="2" />
      ) : (
        <circle cx="0" cy={-h - 9} r="9.5" fill={ORANGE} stroke={INK} strokeWidth="2" />
      )}
    </g>
  );
}

/**
 * The hero band on the landing page: a field, the route a crop takes and the
 * buyer's shed at the end of it -- the product in one picture. Decorative, so
 * it is hidden from assistive technology and carries no text.
 */
export function FieldScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 300" className={className} role="presentation" aria-hidden preserveAspectRatio="xMidYMax slice">
      <circle cx="1038" cy="52" r="34" fill={ORANGE} />

      {/* Three bands of land: far, worked, and the headland in front. */}
      <path d="M0 150c230-34 430-26 700 6s530 30 740 2v142H0z" fill={PALE} />
      <path d="M0 206c250 24 430-10 700-10s470 32 740 8v96H0z" fill={SAND} />
      <path d="M0 264c260 14 450-8 700-8s480 20 740 6v38H0z" fill={EARTH} />
      <path d="M0 150c230-34 430-26 700 6s530 30 740 2" stroke={INK} strokeWidth="2" fill="none" />
      <path d="M0 206c250 24 430-10 700-10s470 32 740 8" stroke={INK} strokeWidth="2" fill="none" />

      {/* Far rows: short strokes that read as a planted field. */}
      {spread(30, 1410, 46).map((x, i) => (
        <path key={`f${x}`} d={`M${x} ${190 - Math.sin(i / 3) * 10}v-24`} stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.4" fill="none" />
      ))}

      {/* Near rows: full plants standing on the headland. */}
      {PLANTS.map(([x, y, h, round]) => (
        <Plant key={`p${x}`} x={x} y={y} h={h} head={round ? 'round' : 'grain'} />
      ))}

      {/* The route the crop takes, from the field to the buyer. */}
      <path d="M760 252c140-8 214-46 330-58" stroke={ORANGE} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 15" fill="none" />

      {/* Lorry. */}
      <g transform="translate(838 146)">
        <rect x="0" y="12" width="104" height="54" rx="6" fill={CREAM} stroke={INK} strokeWidth="2.4" />
        <path d="M104 30h36l22 24v12h-58z" fill={ORANGE} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M112 36h22l13 14h-35z" fill={CREAM} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 26h76M14 40h76M14 54h76" stroke={SAND} strokeWidth="3" strokeLinecap="round" />
        <circle cx="34" cy="70" r="12" fill={INK} />
        <circle cx="34" cy="70" r="4.5" fill={CREAM} />
        <circle cx="136" cy="70" r="12" fill={INK} />
        <circle cx="136" cy="70" r="4.5" fill={CREAM} />
      </g>

      {/* Buyer's shed. */}
      <g transform="translate(1186 88)">
        <path d="M0 44L68 0l68 44z" fill={ORANGE} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <rect x="12" y="44" width="112" height="90" fill={CREAM} stroke={INK} strokeWidth="2.4" />
        <rect x="50" y="78" width="36" height="56" fill={SAND} stroke={INK} strokeWidth="2" />
        <path d="M26 62h18M92 62h18" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

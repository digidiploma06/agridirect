import type { CropId } from '@/lib/types';

/**
 * Original line drawings, one per crop, in the brand palette: ink for the
 * plant, burnt orange for the part that is sold, cream behind. They are drawn
 * here rather than photographed so every crop looks like it belongs to the
 * same set, and so the pages carry no image downloads.
 *
 * Each glyph is drawn on a 48 x 48 grid.
 */
const INK = '#111111';
const ORANGE = '#d9541e';
const SAND = '#e0d8c7';
const CREAM = '#f3eee3';

/** Stem, leaves and other structure: thin ink strokes. */
const stem = { stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const outline = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** Grains on an ear: a column of slanted ovals either side of the stalk. */
function grains(cx: number, top: number, rows: number, dy: number, rx: number, ry: number, spread: number, fill: string) {
  const out = [];
  for (let i = 0; i < rows; i += 1) {
    const y = top + i * dy;
    const w = spread * (1 - Math.abs(i - (rows - 1) / 2) / rows / 1.6);
    out.push(
      <ellipse key={`l${i}`} cx={cx - w} cy={y} rx={rx} ry={ry} transform={`rotate(-28 ${cx - w} ${y})`} fill={fill} {...outline} />,
      <ellipse key={`r${i}`} cx={cx + w} cy={y} rx={rx} ry={ry} transform={`rotate(28 ${cx + w} ${y})`} fill={fill} {...outline} />,
    );
  }
  return out;
}

/** Grain positions along the drooping rice panicle: x, y and the hang angle. */
const RICE_GRAINS: [number, number, number][] = [
  [16, 29, 10],
  [18.5, 22, 18],
  [22, 16, 32],
  [27, 12, 52],
  [32.5, 11.5, 74],
  [37.5, 14, 92],
];

/** The grain cluster that makes up a jowar head. */
const JOWAR_HEAD: [number, number][] = [
  [24, 8],
  [18.5, 12],
  [29.5, 12],
  [15, 17.5],
  [24, 16.5],
  [33, 17.5],
  [17, 23.5],
  [24, 23],
  [31, 23.5],
  [20.5, 29],
  [27.5, 29],
];

const GLYPHS: Record<string, JSX.Element> = {
  rice: (
      <>
      <path d="M13 45C13 29 15 18 23 12c7-5 15-2 18 4" {...stem} />
      {RICE_GRAINS.map(([x, y, r]) => (
        <ellipse key={`${x}`} cx={x + 2} cy={y + 4} rx="2.1" ry="3.9" fill={ORANGE} transform={`rotate(${r} ${x + 2} ${y + 4})`} {...outline} />
      ))}
      <path d="M13 36c-4-2-6-6-6-11 5 1 8 5 8 10" fill={SAND} {...outline} />
      </>
  ),
  wheat: (
    <>
      <path d="M24 44V20" {...stem} />
      {grains(24, 10, 6, 4, 2.4, 4.2, 4.4, ORANGE)}
      <path d="M18 9l3 4M30 9l-3 4M24 7v4" {...stem} />
    </>
  ),
  jowar: (
      <>
      <path d="M24 45V30" {...stem} />
      <path d="M24 37c-7 0-10-3-11-7" {...stem} />
      {JOWAR_HEAD.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.2" fill={ORANGE} {...outline} />
      ))}
      </>
  ),
  bajra: (
      <>
      <path d="M24 45V32" {...stem} />
      <path d="M24 38c-7 1-10-2-11-6" {...stem} />
      <path d="M24 5c3.4 0 6 2.6 6 6v16c0 3.4-2.6 6-6 6s-6-2.6-6-6V11c0-3.4 2.6-6 6-6z" fill={ORANGE} {...outline} />
      {[10, 15, 20, 25, 30].map((y) => (
        <g key={y}>
          <circle cx="18" cy={y} r="2.4" fill={ORANGE} {...outline} />
          <circle cx="30" cy={y} r="2.4" fill={ORANGE} {...outline} />
        </g>
      ))}
      </>
  ),
  maize: (
      <>
      <path d="M24 45V40" {...stem} />
      <path d="M14 38c-5-4-7-11-6-19 5 3 8 9 8 16M34 38c5-4 7-11 6-19-5 3-8 9-8 16" fill={SAND} {...outline} />
      <path d="M24 5c4.7 0 8.5 3.8 8.5 8.5v17c0 4.7-3.8 8.5-8.5 8.5s-8.5-3.8-8.5-8.5v-17C15.5 8.8 19.3 5 24 5z" fill={ORANGE} {...outline} />
      <path d="M24 7v30M19 9v26M29 9v26" stroke={CREAM} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M16 15h16M16 22h16M16 29h16" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </>
  ),
  gram: (
      <>
      <path d="M12 42c4-4 7-9 8-15" {...stem} />
      <path d="M33 10c4 2 6 7 5 13-1 7-6 12-12 12-4 0-7-3-7-7 0-3 2-5 4-6-1-2-1-4 0-6 2-4 6-6 10-6z" fill={ORANGE} {...outline} />
      <path d="M22 22c5-3 10-5 15-5" stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M20 27c-4 1-8-1-9-5 4-2 8-1 9 5z" fill={SAND} {...outline} />
      <path d="M22 18c-4-1-7-4-7-8 4 0 7 3 8 7z" fill={SAND} {...outline} />
      </>
  ),
  tur: (
    <>
      <path d="M12 44c6-6 10-14 12-24" {...stem} />
      <path d="M32 10c4 3 5 9 2 14s-9 7-13 5c2-7 6-15 11-19z" fill={ORANGE} {...outline} />
      <circle cx="28" cy="18" r="2.2" fill={CREAM} />
      <circle cx="27" cy="24" r="2.2" fill={CREAM} />
      <path d="M22 28c-5 1-8-1-9-5 4-2 8-1 9 5z" fill={SAND} {...outline} />
    </>
  ),
  moong: (
    <>
      <path d="M24 44c0-8-1-14-3-18" {...stem} />
      <path d="M13 10c6 0 10 4 10 10s-4 9-8 9c-3-5-4-13-2-19z" fill={ORANGE} {...outline} />
      <path d="M35 14c-5 1-8 5-8 10s3 8 6 8c3-5 4-13 2-18z" fill={ORANGE} {...outline} />
      <circle cx="18" cy="17" r="1.9" fill={CREAM} />
      <circle cx="19" cy="23" r="1.9" fill={CREAM} />
      <circle cx="31" cy="21" r="1.9" fill={CREAM} />
    </>
  ),
  urad: (
      <>
      <path d="M11 13c8 0 14 6 15 15" {...stem} />
      <path d="M26 28c-7-2-12-8-13-15 8 0 14 5 16 12" fill={SAND} {...outline} />
      <ellipse cx="22" cy="34" rx="6" ry="4.4" transform="rotate(-18 22 34)" fill={INK} />
      <ellipse cx="32" cy="30" rx="6" ry="4.4" transform="rotate(-18 32 30)" fill={INK} />
      <ellipse cx="34" cy="39" rx="6" ry="4.4" transform="rotate(-18 34 39)" fill={INK} />
      <path d="M20 33h4M30 29h4M32 38h4" stroke={CREAM} strokeWidth="1.2" strokeLinecap="round" />
      </>
  ),
  soybean: (
    <>
      <path d="M24 44V16" {...stem} />
      <path d="M8 22c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" fill={ORANGE} {...outline} />
      <path d="M26 32c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" fill={ORANGE} {...outline} />
      <circle cx="15" cy="22" r="2.4" fill={CREAM} />
      <circle cx="33" cy="32" r="2.4" fill={CREAM} />
      <path d="M24 16c4-4 8-5 12-4-1 5-5 8-10 8" fill={SAND} {...outline} />
    </>
  ),
  groundnut: (
      <>
      <g transform="rotate(-28 24 28)">
        <ellipse cx="24" cy="19" rx="9.6" ry="8.4" fill={INK} />
        <ellipse cx="24" cy="36" rx="10.4" ry="9.2" fill={INK} />
        <ellipse cx="24" cy="19" rx="8" ry="6.8" fill={ORANGE} />
        <ellipse cx="24" cy="36" rx="8.8" ry="7.6" fill={ORANGE} />
        <path d="M18 27.5h12" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M19 16h10M18 22h12M18 33h12M19 40h10" stroke={CREAM} strokeWidth="1.3" strokeLinecap="round" />
      </g>
      </>
  ),
  sunflower: (
    <>
      <path d="M24 45V30" {...stem} />
      <path d="M24 38c-6 0-9-3-10-7" {...stem} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse key={a} cx="24" cy="7" rx="3.4" ry="6" fill={ORANGE} {...outline} transform={`rotate(${a} 24 19)`} />
      ))}
      <circle cx="24" cy="19" r="6.5" fill={INK} />
    </>
  ),
  cotton: (
      <>
      <path d="M24 45V34" {...stem} />
      <path d="M24 40c-6 0-9-3-10-7" {...stem} />
      <path d="M24 5c3 0 5.4 2 6 4.8 2.6-1.6 6.1-1 7.9 1.6s1.3 6.1-1.1 8c2.4 1.9 3 5.4 1.2 8s-5.3 3.2-7.9 1.6C29.4 32 27 34 24 34s-5.4-2-6-4.8c-2.6 1.6-6.1 1-7.9-1.6s-1.2-6.1 1.2-8c-2.4-1.9-2.9-5.4-1.1-8s5.3-3.2 7.9-1.6C18.6 7 21 5 24 5z" fill={CREAM} {...outline} />
      <path d="M24 34l-5 6M24 34l5 6M24 34v7" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      </>
  ),
  sugarcane: (
    <>
      <rect x="15" y="4" width="8" height="41" rx="3" fill={ORANGE} {...outline} />
      <path d="M15 14h8M15 23h8M15 32h8" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M23 12c6-4 11-4 16-1-4 5-10 6-16 4M23 26c6-4 11-4 16-1-4 5-10 6-16 4" fill={SAND} {...outline} />
    </>
  ),
  onion: (
    <>
      <path d="M24 14V5M24 11c-3-2-5-5-5-8M24 11c3-2 5-5 5-8" {...stem} />
      <path d="M24 14c8 0 13 6 13 14 0 7-6 13-13 13s-13-6-13-13c0-8 5-14 13-14z" fill={ORANGE} {...outline} />
      <path d="M18 18c-2 4-3 8-3 11M30 18c2 4 3 8 3 11" stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </>
  ),
  tomato: (
    <>
      <circle cx="24" cy="28" r="14" fill={ORANGE} {...outline} />
      <path d="M24 14V8" {...stem} />
      <path d="M24 14c-4-3-8-4-11-3 1 4 4 6 8 6M24 14c4-3 8-4 11-3-1 4-4 6-8 6" fill={SAND} {...outline} />
      <path d="M17 23c-1 2-2 4-2 6" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  potato: (
      <>
      <path d="M7 27c0-6 5-10 11-12 7-3 14-3 18 1 5 4 6 10 3 15-3 6-10 8-17 7C12 37 7 33 7 27z" fill={SAND} {...outline} />
      <circle cx="16" cy="24" r="1.5" fill={INK} />
      <circle cx="23" cy="19" r="1.3" fill={INK} />
      <circle cx="31" cy="24" r="1.5" fill={INK} />
      <circle cx="21" cy="31" r="1.3" fill={INK} />
      <circle cx="33" cy="33" r="1.4" fill={INK} />
      <circle cx="27" cy="27" r="1.2" fill={INK} />
      </>
  ),
  chilli: (
    <>
      <path d="M22 9c5-2 9 0 10 4" {...stem} />
      <path d="M22 9c-3 0-5 2-5 4" {...stem} />
      <path d="M30 14c5 5 5 14 0 20s-13 8-18 4c6-1 10-5 12-11 1-5 3-10 6-13z" fill={ORANGE} {...outline} />
    </>
  ),
  turmeric: (
    <>
      <path d="M10 28c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" fill={ORANGE} {...outline} />
      <path d="M22 19c3-3 8-3 11 0s3 8 0 11-8 3-11 0" fill={ORANGE} {...outline} />
      <path d="M31 14c3-2 7-1 9 2s1 7-2 9" fill={ORANGE} {...outline} />
      <path d="M14 26c2-1 4-1 6 0" stroke={CREAM} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M12 38h24" stroke={SAND} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  garlic: (
    <>
      <path d="M24 13V5M24 10c-3-1-4-3-4-5M24 10c3-1 4-3 4-5" {...stem} />
      <path d="M24 13c7 0 12 6 12 14 0 7-5 12-12 12s-12-5-12-12c0-8 5-14 12-14z" fill={CREAM} {...outline} />
      <path d="M24 14v25M17 17c-2 5-2 13 1 20M31 17c2 5 2 13-1 20" stroke={INK} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </>
  ),
};

/** A generic sheaf, for a crop with no drawing of its own yet. */
const FALLBACK = (
  <>
    <path d="M24 44V20" {...stem} />
    {grains(24, 12, 4, 4.4, 2.5, 4.4, 4.6, SAND)}
  </>
);

export interface CropArtProps {
  cropId: CropId | string;
  /** Rendered size in pixels. */
  size?: number;
  /** Draw the cream tile behind the glyph. */
  tile?: boolean;
  className?: string;
}

export function CropArt({ cropId, size = 48, tile = true, className }: CropArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="presentation" aria-hidden className={className}>
      {tile && <rect width="48" height="48" rx="12" fill={CREAM} />}
      {GLYPHS[cropId] ?? FALLBACK}
    </svg>
  );
}

export const DRAWN_CROPS = Object.keys(GLYPHS);

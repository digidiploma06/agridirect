// Synthetic weekly mandi series (52 weeks). Deterministic per crop x mandi so
// charts look the same on every reload. Clearly labelled as sample data in
// the UI; replaced by Agmarknet/CEDA data in Phase 2.

import { addDays } from '../dates';
import type { CropId, PricePoint } from '../types';

const BASE_PRICE: Record<CropId, number> = { maize: 2100, soybean: 4600, onion: 1800, tur: 7200, tomato: 1500 };
const VOLATILITY: Record<CropId, number> = { maize: 0.04, soybean: 0.03, onion: 0.14, tur: 0.03, tomato: 0.18 };
const BASE_ARRIVALS_T: Record<CropId, number> = { maize: 420, soybean: 260, onion: 1900, tur: 90, tomato: 640 };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Monday of the ISO week containing `isoDate`. */
function weekStart(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((day + 6) % 7));
}

export function marketSeries(cropId: CropId, mandiId: string, today: string, weeks = 52): PricePoint[] {
  const rand = mulberry32(hash(`${cropId}:${mandiId}`));
  const base = (BASE_PRICE[cropId] ?? 3000) * (0.94 + rand() * 0.12);
  const vol = VOLATILITY[cropId] ?? 0.05;
  const lastWeek = weekStart(today);
  const points: PricePoint[] = [];
  let drift = 0;
  for (let i = weeks - 1; i >= 0; i--) {
    const week = addDays(lastWeek, -7 * i);
    const month = Number(week.slice(5, 7));
    const seasonal = Math.sin(((month - 3) / 12) * 2 * Math.PI) * vol * 1.5;
    drift = drift * 0.85 + (rand() - 0.5) * vol;
    const modal = Math.round(base * (1 + seasonal + drift));
    const spread = modal * (0.06 + rand() * 0.05);
    const arrivals = (BASE_ARRIVALS_T[cropId] ?? 300) * (1 - seasonal * 2 - drift * 1.5) * (0.85 + rand() * 0.3);
    points.push({
      week,
      modalPrice: modal,
      minPrice: Math.round(modal - spread),
      maxPrice: Math.round(modal + spread * 0.8),
      arrivalsT: Math.max(1, Math.round(arrivals)),
    });
  }
  return points;
}

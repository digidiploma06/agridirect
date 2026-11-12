// Stand-in for the ML service's features (TRD section 7.2). Numbers are
// synthetic and chosen to make the demo tell a realistic story: an onion
// glut in Ahilyanagar, tight maize supply, thin tomato data in the south.

import type { CropId } from '../types';

export interface MarketSignal {
  /** Forecast % change in modal price over the horizon. */
  forecastPriceChangePct: number;
  /** Arrivals vs 3-year same-week average, %. Positive = more supply than usual. */
  arrivalAnomalyPct: number;
  /** Historical MAPE for this crop x horizon, used to calibrate confidence. */
  historicalMapePct: number;
  /** True when district data is missing and state-level averages are used. */
  fallback: boolean;
}

export const MODEL_VERSION = 'lgbm-2026.10.1';
export const HORIZON_WEEKS = 8;

const STATE_LEVEL: Record<CropId, MarketSignal> = {
  maize: { forecastPriceChangePct: 9, arrivalAnomalyPct: -18, historicalMapePct: 8, fallback: false },
  soybean: { forecastPriceChangePct: 4, arrivalAnomalyPct: -6, historicalMapePct: 7, fallback: false },
  onion: { forecastPriceChangePct: -12, arrivalAnomalyPct: 26, historicalMapePct: 18, fallback: false },
  tur: { forecastPriceChangePct: 6, arrivalAnomalyPct: -11, historicalMapePct: 6, fallback: false },
  tomato: { forecastPriceChangePct: 2, arrivalAnomalyPct: 4, historicalMapePct: 22, fallback: false },
};

const DISTRICT_OVERRIDES: Record<string, Partial<Record<CropId, Partial<MarketSignal>>>> = {
  'd-ahilyanagar': { onion: { forecastPriceChangePct: -15, arrivalAnomalyPct: 31 } },
  'd-nashik': { onion: { forecastPriceChangePct: -9, arrivalAnomalyPct: 22 } },
  'd-pune': { tomato: { forecastPriceChangePct: 7, arrivalAnomalyPct: -9, historicalMapePct: 19 } },
  'd-solapur': { tur: { forecastPriceChangePct: 8, arrivalAnomalyPct: -14 }, tomato: { fallback: true } },
  'd-satara': { tomato: { fallback: true }, soybean: { forecastPriceChangePct: 6 } },
};

export function getSignal(cropId: CropId, districtId: string): MarketSignal {
  // Crops without a hand-written demo signal get a neutral, low-confidence one.
  const base: MarketSignal = STATE_LEVEL[cropId] ?? { forecastPriceChangePct: 0, arrivalAnomalyPct: 0, historicalMapePct: 20, fallback: true };
  return { ...base, ...DISTRICT_OVERRIDES[districtId]?.[cropId] };
}

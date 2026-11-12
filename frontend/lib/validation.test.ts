import { describe, expect, it } from 'vitest';
import {
  gstinCheckChar,
  maskPhone,
  normalizePhone,
  sanitizeText,
  toKg,
  validateGstin,
  validateNotPast,
  validateOtp,
  validatePhoto,
  validatePriceRange,
  validateQuantity,
} from './validation';
import { formatDate, formatQty, formatRupees } from './format';
import { haversineKm, roundTo5Km } from './geo';
import { addDays, currentSeason, daysBetween } from './dates';

describe('phone', () => {
  it('normalises common Indian formats to E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+91-9876543210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('rejects numbers not starting 6-9 or of the wrong length', () => {
    expect(normalizePhone('5876543210')).toBeNull();
    expect(normalizePhone('987654321')).toBeNull();
  });

  it('masks all but the first two and last three digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98·····210');
  });
});

describe('otp', () => {
  it('requires exactly 6 digits', () => {
    expect(validateOtp('123456')).toBeNull();
    expect(validateOtp('12345')).toBe('otp_invalid');
    expect(validateOtp('12a456')).toBe('otp_invalid');
  });
});

describe('gstin', () => {
  it('accepts a known valid GSTIN and computes its check character', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toBeNull();
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V');
    expect(validateGstin(' 27aapfu0939f1zv ')).toBeNull();
  });

  it('distinguishes format errors from checksum errors', () => {
    expect(validateGstin('27AAPFU0939F1ZX')).toBe('gstin_checksum');
    expect(validateGstin('27AAPFU0939F1XV')).toBe('gstin_format');
    expect(validateGstin('ABC')).toBe('gstin_format');
  });
});

describe('quantity and price', () => {
  it('converts quintal and tonne to kg', () => {
    expect(toKg(2.5, 'q')).toBe(250);
    expect(toKg(8, 't')).toBe(8000);
  });

  it('requires > 0 and at most 10,000 t', () => {
    expect(validateQuantity(0, 'q')).toBe('qty_positive');
    expect(validateQuantity(10_000, 't')).toBeNull();
    expect(validateQuantity(10_000.5, 't')).toBe('qty_max');
  });

  it('price ranges must be positive integers with min <= max', () => {
    expect(validatePriceRange(2000, 2200)).toBeNull();
    expect(validatePriceRange(2300, 2200)).toBe('price_range');
    expect(validatePriceRange(20.5, 2200)).toBe('price_integer');
  });
});

describe('dates, text and photos', () => {
  it('dates must be today or later', () => {
    expect(validateNotPast('2026-10-25', '2026-10-25')).toBeNull();
    expect(validateNotPast('2026-10-24', '2026-10-25')).toBe('date_past');
    expect(validateNotPast('', '2026-10-25')).toBe('date_required');
  });

  it('strips HTML and caps at 500 characters', () => {
    expect(sanitizeText('<b>Good</b> maize<script>x</script>')).toBe('Good maizex');
    expect(sanitizeText('a'.repeat(600))).toHaveLength(500);
  });

  it('accepts JPG/PNG/WebP up to 5 MB', () => {
    expect(validatePhoto({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(validatePhoto({ type: 'image/gif', size: 1000 })).toBe('photo_type');
    expect(validatePhoto({ type: 'image/png', size: 6 * 1024 * 1024 })).toBe('photo_size');
  });

  it('date helpers', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-25', '2026-11-01')).toBe(7);
    expect(currentSeason('2026-07-01')).toBe('kharif');
    expect(currentSeason('2026-10-25')).toBe('rabi');
    expect(currentSeason('2026-04-10')).toBe('zaid');
  });
});

describe('format and geo', () => {
  it('formats dates as DD MMM YYYY and amounts in Indian grouping', () => {
    expect(formatDate('2026-10-24')).toBe('24 Oct 2026');
    expect(formatRupees(125000)).toBe('₹1,25,000');
    expect(formatQty(8000)).toBe('8 t');
    expect(formatQty(450)).toBe('4.5 q');
  });

  it('computes distance and rounds to 5 km', () => {
    const km = haversineKm({ lat: 18.52, lng: 73.86 }, { lat: 19.09, lng: 74.74 });
    expect(km).toBeGreaterThan(105);
    expect(km).toBeLessThan(115);
    expect(roundTo5Km(112)).toBe(110);
    expect(roundTo5Km(1)).toBe(5);
  });
});

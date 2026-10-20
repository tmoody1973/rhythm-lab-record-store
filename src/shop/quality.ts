// How much the shop draws: phones and low-memory devices get the light tier (decision 10: tuned for phones).
export type Quality = { tier: 'full' | 'light'; dpr: [number, number]; shadowMapSize: 1024 | 2048; lushPlants: boolean; plantCount: number };

const LIGHT: Quality = { tier: 'light', dpr: [1, 1.5], shadowMapSize: 1024, lushPlants: false, plantCount: 4 };
const FULL: Quality = { tier: 'full', dpr: [1, 2], shadowMapSize: 2048, lushPlants: true, plantCount: 8 };

/** memoryGB is navigator.deviceMemory where the browser reports it (Chrome rounds it, e.g. 4 or 8). */
export function qualityFor(width: number, memoryGB?: number): Quality {
  return width < 768 || (memoryGB !== undefined && memoryGB <= 4) ? LIGHT : FULL;
}

// Synced to absolute UTC so every client sees the same cycle position.
// 10-minute period: 00:00 UTC start of cycle, 00:10 next, etc.
const CYCLE_MS = 10 * 60 * 1000;

// Returns 0..1 around the cycle. 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight.
export function dayPhase(): number {
  return (Date.now() % CYCLE_MS) / CYCLE_MS;
}

// Smooth brightness curve — peaks at noon, troughs at midnight, never quite
// goes black so the scene stays readable.
export function dayBrightness(phase: number): number {
  return 0.45 + 0.85 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - 0.25)));
}

// Hue rotation in radians. Sweeps ±π/4 (±45°) across the cycle so colours
// drift from cool-blue night through warm-pink day and back.
export function dayHueAngle(phase: number): number {
  return Math.cos(2 * Math.PI * (phase - 0.25)) * (Math.PI / 4);
}

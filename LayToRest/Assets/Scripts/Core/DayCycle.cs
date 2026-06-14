using System;
using UnityEngine;

namespace LayToRest.Core
{
    /// Port of src/game/dayCycle.ts — 10-minute cycle synced to absolute
    /// UTC so every client sees the same phase. 0 = dawn, 0.25 = noon,
    /// 0.5 = dusk, 0.75 = midnight.
    public class DayCycle : MonoBehaviour
    {
        const double CycleMs = 10.0 * 60.0 * 1000.0;

        [Tooltip("Optional sun — intensity is driven by the brightness curve.")]
        public Light sun;
        [Tooltip("Base intensity the brightness curve multiplies.")]
        public float sunBaseIntensity = 1f;

        public static float Phase
        {
            get
            {
                double ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % CycleMs;
                return (float)(ms / CycleMs);
            }
        }

        /// Peaks at noon, troughs at midnight; floor kept high so the world
        /// always reads as a glowing biome.
        public static float Brightness(float phase) =>
            0.95f + 0.45f * (0.5f + 0.5f * Mathf.Cos(2f * Mathf.PI * (phase - 0.25f)));

        /// Gentle warm/cool hue drift, ±15°, in radians.
        public static float HueAngle(float phase) =>
            Mathf.Cos(2f * Mathf.PI * (phase - 0.25f)) * (Mathf.PI / 12f);

        void Update()
        {
            if (sun != null)
                sun.intensity = sunBaseIntensity * Brightness(Phase);
        }
    }
}

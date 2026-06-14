using System.Collections.Generic;
using UnityEngine;

namespace LayToRest.Core
{
    /// Region ids — ported 1:1 from src/game/regions.ts.
    /// Five-world chain: lysningen → blod → geometri → siste → senter.
    /// `remnants` is legacy (no spawns target it).
    public enum RegionId
    {
        lysningen,
        remnants,
        blod,
        geometri,
        siste,
        senter,
    }

    public struct RegionDef
    {
        public RegionId id;
        public string displayName;
        public Vector2 center; // world XZ
        public float sigma;    // gradient falloff (m) — kept for the palette-blend port
    }

    public static class Regions
    {
        public static readonly Dictionary<RegionId, RegionDef> All = new()
        {
            { RegionId.lysningen, new RegionDef { id = RegionId.lysningen, displayName = "Hageverden",   center = new Vector2(0, -30),   sigma = 26 } },
            { RegionId.remnants,  new RegionDef { id = RegionId.remnants,  displayName = "The Remnants", center = new Vector2(0, 90),    sigma = 26 } },
            { RegionId.blod,      new RegionDef { id = RegionId.blod,      displayName = "Blodverden",   center = new Vector2(-90, -50), sigma = 24 } },
            { RegionId.geometri,  new RegionDef { id = RegionId.geometri,  displayName = "Flisverden",   center = new Vector2(-90, 60),  sigma = 24 } },
            { RegionId.siste,     new RegionDef { id = RegionId.siste,     displayName = "Saltverden",   center = new Vector2(90, -50),  sigma = 24 } },
            { RegionId.senter,    new RegionDef { id = RegionId.senter,    displayName = "Kjellerverden",center = new Vector2(90, 70),   sigma = 22 } },
        };

        public static bool TryParse(string s, out RegionId id)
        {
            return System.Enum.TryParse(s, out id);
        }
    }
}

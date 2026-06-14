using System;

namespace LayToRest.World
{
    /// JSON schema classes matching the web spawns.json files 1:1
    /// (src/game/levels/<world>/spawns.json). One fat class covers every
    /// Spawn variant — JsonUtility leaves absent fields at defaults.
    [Serializable]
    public class LevelJson
    {
        public SpawnPointJson spawnPoint;
        public SpawnJson[] spawns;
    }

    [Serializable]
    public class SpawnPointJson
    {
        public float x;
        public float z;
    }

    [Serializable]
    public class SpawnJson
    {
        public string kind;
        public string id;
        public float[] position;     // [x, z]

        // Common optionals
        public float scale;          // 0 → unset, treat as 1
        public float rotation;       // radians (web convention)

        // portal / car_portal
        public string targetRegion;
        public string requiredKey;
        public string gate;          // 'bobbleVanished' | 'hasKey' | 'key:<region>'

        // key / artifact
        public string opens;
        public string region;

        // sprites / cards
        public string texture;
        public float height;
        public float yOffset;
        public float rotationOffset;
        public bool noCollide;
        public float glow;
        public string tint;
        public string colorA;
        public string colorB;
        public string color;
        public string emissive;
        public float emissiveIntensity;

        // flis / misc
        public string prop;          // flis_prop kind
        public string model;         // car model variant
        public float width;
        public float depth;
        public float tileSize;
        public float resolution;

        // skate orbit
        public float radius;
        public float period;
        public float phase;
    }
}

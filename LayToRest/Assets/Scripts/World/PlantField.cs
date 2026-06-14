using System;
using System.Collections.Generic;
using UnityEngine;
using LayToRest.Core;

namespace LayToRest.World
{
    /// Port of the web Plants.tsx: procedurally chunk-streamed sprite-card
    /// vegetation around the player. Identical constants and deterministic
    /// RNG (hash2 + mulberry32), so the plant layout matches the web build
    /// for the same world coordinates. Renders only in Hageverden
    /// (lysningen) — the other worlds are intentionally blank slates.
    public class PlantField : MonoBehaviour
    {
        [Serializable]
        public class PlantType
        {
            public Texture2D texture;
            public float height = 3f;   // world units tall
            [Range(0, 1)] public float wind = 0.5f;
            public bool pushable = true;
        }

        public PlantType[] types;
        public Transform player;

        // config — mirrors Plants.tsx
        const float FaceCameraY = 45f;          // π/4
        const float ChunkSize = 12f;
        const int ChunkRadius = 3;
        const int PlantsPerChunkMin = 5;
        const int PlantsPerChunkMax = 9;
        const float SpawnSafeRadius = 3f;

        Mesh _card;
        Material[] _baseMats, _haloMats;
        readonly Dictionary<long, List<GameObject>> _chunks = new();
        (int cx, int cz)? _last;

        void Awake()
        {
            _card = BuildCardMesh();
            int n = types.Length;
            _baseMats = new Material[n];
            _haloMats = new Material[n];
            var baseShader = Shader.Find("Spelauget/PlantCard");
            var haloShader = Shader.Find("Spelauget/PlantHalo");
            for (int i = 0; i < n; i++)
            {
                var t = types[i];
                _baseMats[i] = new Material(baseShader);
                _baseMats[i].SetTexture("_BaseMap", t.texture);
                _baseMats[i].SetFloat("_WindAmp", t.wind);
                _baseMats[i].SetFloat("_PushAmp", t.pushable ? 1f : 0f);

                _haloMats[i] = new Material(haloShader);
                _haloMats[i].SetTexture("_BaseMap", t.texture);
                _haloMats[i].SetFloat("_WindAmp", t.wind);
                _haloMats[i].SetFloat("_PushAmp", t.pushable ? 1f : 0f);
            }
        }

        void Update()
        {
            if (player == null) return;
            Shader.SetGlobalVector("_SpelPlayerPos", player.position);

            int ccx = Mathf.FloorToInt(player.position.x / ChunkSize);
            int ccz = Mathf.FloorToInt(player.position.z / ChunkSize);
            if (_last.HasValue && _last.Value.cx == ccx && _last.Value.cz == ccz) return;
            _last = (ccx, ccz);

            var desired = new HashSet<long>();
            for (int dx = -ChunkRadius; dx <= ChunkRadius; dx++)
                for (int dz = -ChunkRadius; dz <= ChunkRadius; dz++)
                    desired.Add(Key(ccx + dx, ccz + dz));

            var stale = new List<long>();
            foreach (var k in _chunks.Keys)
                if (!desired.Contains(k)) stale.Add(k);
            foreach (var k in stale)
            {
                foreach (var go in _chunks[k]) Destroy(go);
                _chunks.Remove(k);
            }

            foreach (var k in desired)
            {
                if (_chunks.ContainsKey(k)) continue;
                int cx = (int)(k >> 32);
                int cz = (int)(k & 0xffffffffL);
                _chunks[k] = BuildChunk(cx, cz);
            }
        }

        void OnDisable()
        {
            foreach (var list in _chunks.Values)
                foreach (var go in list)
                    if (go != null) Destroy(go);
            _chunks.Clear();
            _last = null;
        }

        static long Key(int cx, int cz) => ((long)cx << 32) | (uint)cz;

        List<GameObject> BuildChunk(int cx, int cz)
        {
            var list = new List<GameObject>();
            var rng = Mulberry32(Hash2(cx, cz));
            int count = Mathf.FloorToInt(
                PlantsPerChunkMin + rng() * (PlantsPerChunkMax - PlantsPerChunkMin + 1));
            for (int i = 0; i < count; i++)
            {
                float lx = (rng() - 0.5f) * ChunkSize;
                float lz = (rng() - 0.5f) * ChunkSize;
                float wx = cx * ChunkSize + lx + ChunkSize / 2f;
                float wz = cz * ChunkSize + lz + ChunkSize / 2f;
                int idx = Mathf.Min(Mathf.FloorToInt(rng() * types.Length), types.Length - 1);
                float scale = 0.7f + rng() * 0.7f;
                bool flip = rng() > 0.5f;
                if (Mathf.Sqrt(wx * wx + wz * wz) < SpawnSafeRadius) continue;
                list.Add(SpawnCard(idx, wx, wz, scale, flip));
            }
            return list;
        }

        GameObject SpawnCard(int idx, float x, float z, float scale, bool flip)
        {
            var t = types[idx];
            float aspect = t.texture != null && t.texture.height > 0
                ? (float)t.texture.width / t.texture.height : 1f;
            float w = t.height * aspect * scale;
            float h = t.height * scale;

            var go = new GameObject($"plant_{idx}");
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(x, 0, z);
            go.transform.rotation = Quaternion.Euler(0, FaceCameraY, 0);
            go.transform.localScale = new Vector3(flip ? -w : w, h, 1);
            var mf = go.AddComponent<MeshFilter>(); mf.sharedMesh = _card;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = _baseMats[idx];
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // Halo: 1.2x copy, additive, nudged back so it never z-fights.
            var halo = new GameObject("halo");
            halo.transform.SetParent(go.transform, false);
            halo.transform.localPosition = new Vector3(0, 0, 0.005f);
            halo.transform.localScale = Vector3.one * 1.2f;
            var hf = halo.AddComponent<MeshFilter>(); hf.sharedMesh = _card;
            var hr = halo.AddComponent<MeshRenderer>(); hr.sharedMaterial = _haloMats[idx];
            hr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        /// 1×1 card, pivot at bottom-center — scale = (width, height, 1).
        static Mesh BuildCardMesh()
        {
            var m = new Mesh { name = "PlantCard" };
            m.vertices = new[]
            {
                new Vector3(-0.5f, 0, 0), new Vector3(0.5f, 0, 0),
                new Vector3(-0.5f, 1, 0), new Vector3(0.5f, 1, 0),
            };
            m.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1), new Vector2(1, 1) };
            m.triangles = new[] { 0, 2, 1, 1, 2, 3 };
            m.RecalculateBounds();
            // Generous bounds so wind sway never gets frustum-culled mid-swing.
            m.bounds = new Bounds(new Vector3(0, 0.5f, 0), new Vector3(2, 1.5f, 2));
            return m;
        }

        // --- deterministic RNG, ported verbatim from Plants.tsx -----------
        static uint Hash2(int a, int b)
        {
            unchecked
            {
                uint h = (uint)(a * 0x27d4eb2d) ^ (uint)(b * 0x165667b1 + unchecked((int)0x9e3779b9));
                h = (uint)((h ^ (h >> 15)) * 0x85ebca6b);
                h = (uint)((h ^ (h >> 13)) * 0xc2b2ae35);
                return h ^ (h >> 16);
            }
        }

        static Func<float> Mulberry32(uint seed)
        {
            uint s = seed;
            return () =>
            {
                unchecked
                {
                    s += 0x6d2b79f5;
                    uint t = s;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return (t ^ (t >> 14)) / 4294967296f;
                }
            };
        }
    }
}

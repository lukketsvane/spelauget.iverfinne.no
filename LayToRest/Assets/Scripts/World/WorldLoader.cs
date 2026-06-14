using System.Collections.Generic;
using System.IO;
using UnityEngine;
using LayToRest.Core;
using LayToRest.Player;

namespace LayToRest.World
{
    /// Port of Spawns.tsx + the level store: loads
    /// StreamingAssets/Levels/<region>.json (the unchanged web spawns.json
    /// files), instantiates prefabs from the SpawnPrefabLibrary, and moves
    /// the player to the world's spawn point. Switching region tears down
    /// the previous world's spawned root — same remount semantics as the
    /// web version.
    public class WorldLoader : MonoBehaviour
    {
        public static WorldLoader Instance { get; private set; }

        public SpawnPrefabLibrary prefabLibrary;
        public PlayerController player;
        public RegionId startRegion = RegionId.lysningen;

        public RegionId CurrentRegion { get; private set; }

        Transform _root;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start() => LoadRegion(startRegion, teleportPlayer: true);

        public void LoadRegion(RegionId region, bool teleportPlayer = true)
        {
            if (_root != null) Destroy(_root.gameObject);
            _root = new GameObject($"World_{region}").transform;

            var level = ReadLevelJson(region);
            CurrentRegion = region;

            if (level == null)
            {
                Debug.LogWarning($"[WorldLoader] No Levels/{region}.json found in StreamingAssets.");
                return;
            }

            foreach (var s in level.spawns ?? new SpawnJson[0])
                Instantiate(region, s);

            // Procedural vegetation renders only in Hageverden — the other
            // chain worlds are intentionally blank slates (web parity).
            var plants = FindFirstObjectByType<PlantField>(FindObjectsInactive.Include);
            if (plants != null) plants.gameObject.SetActive(region == RegionId.lysningen);

            if (teleportPlayer && player != null && level.spawnPoint != null)
            {
                player.TeleportTo(new Vector3(level.spawnPoint.x, 0.5f, level.spawnPoint.z));
                var cam = Camera.main != null ? Camera.main.GetComponent<IsoCameraFollow>() : null;
                if (cam != null) cam.Snap();
            }
        }

        void Instantiate(RegionId region, SpawnJson s)
        {
            // Skip one-shot pickups the player already collected.
            var gs = GameState.Instance;
            bool isPickup = s.kind == "crystal" || s.kind == "key" || s.kind == "artifact";
            if (isPickup && gs != null && gs.IsCollected(s.id)) return;

            string lookup = s.kind switch
            {
                "flis_prop" => $"flis_prop:{s.prop}",
                "car" => $"car:{(string.IsNullOrEmpty(s.model) ? "car_01" : s.model)}",
                _ => s.kind,
            };

            var prefab = prefabLibrary != null ? prefabLibrary.Get(lookup) : null;
            GameObject go;
            if (prefab != null)
            {
                go = Object.Instantiate(prefab, _root);
            }
            else
            {
                // Placeholder so the layout is visible before all prefabs exist.
                go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                go.transform.SetParent(_root);
                go.transform.localScale = Vector3.one * 0.75f;
                Debug.Log($"[WorldLoader] No prefab for kind '{lookup}' (id {s.id}) — placeholder cube.");
            }

            go.name = $"{s.kind}__{s.id}";
            ApplyWorldLook(go, s.kind);
            float x = s.position != null && s.position.Length > 0 ? s.position[0] : 0;
            float z = s.position != null && s.position.Length > 1 ? s.position[1] : 0;
            go.transform.position = new Vector3(x, s.yOffset, z);
            if (s.rotation != 0)
                go.transform.rotation = Quaternion.Euler(0, s.rotation * Mathf.Rad2Deg, 0);
            if (s.scale != 0)
                go.transform.localScale *= s.scale;

            WireBehaviour(go, s);
        }

        void WireBehaviour(GameObject go, SpawnJson s)
        {
            switch (s.kind)
            {
                case "portal":
                {
                    var p = go.GetComponent<Portal>() ?? go.AddComponent<Portal>();
                    p.Configure(s);
                    break;
                }
                case "key":
                {
                    var k = go.GetComponent<Pickup>() ?? go.AddComponent<Pickup>();
                    k.Configure(Pickup.Type.Key, s);
                    break;
                }
                case "crystal":
                {
                    var c = go.GetComponent<Pickup>() ?? go.AddComponent<Pickup>();
                    c.Configure(Pickup.Type.Crystal, s);
                    break;
                }
                case "artifact":
                {
                    var a = go.GetComponent<Pickup>() ?? go.AddComponent<Pickup>();
                    a.Configure(Pickup.Type.Artifact, s);
                    break;
                }
            }
        }

        // --- Web look parity ---------------------------------------------
        // The web renders everything unlit: characters keep their textures
        // (MeshBasicMaterial), scenery gets its luminance remapped through
        // the region palette (gradient map). Mirror both here.
        static readonly Dictionary<Texture, Material> _gradientCache = new();
        static readonly Dictionary<Texture, Material> _unlitCache = new();

        public static void ApplyWorldLook(GameObject go, string kind)
        {
            bool isCharacter = kind is "boble_npc" or "star_npc";
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                bool skinned = r is SkinnedMeshRenderer;
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    if (mats[i] == null) continue;
                    var tex = FindBaseTexture(mats[i]);
                    mats[i] = (isCharacter || skinned)
                        ? GetUnlit(tex)
                        : GetGradient(tex);
                }
                r.sharedMaterials = mats;
            }
        }

        /// Base-colour texture across importer conventions: URP (_BaseMap),
        /// glTFast (baseColorTexture), legacy (_MainTex / mainTexture).
        public static Texture FindBaseTexture(Material m)
        {
            if (m == null) return null;
            Texture tex = null;
            if (m.HasProperty("_BaseMap")) tex = m.GetTexture("_BaseMap");
            if (tex == null && m.HasProperty("baseColorTexture")) tex = m.GetTexture("baseColorTexture");
            if (tex == null && m.HasProperty("_MainTex")) tex = m.GetTexture("_MainTex");
            if (tex == null) tex = m.mainTexture;
            return tex;
        }

        public static Material GetUnlit(Texture tex)
        {
            var key = tex != null ? tex : Texture2D.whiteTexture;
            if (_unlitCache.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Unlit"));
            if (tex != null) m.SetTexture("_BaseMap", tex);
            _unlitCache[key] = m;
            return m;
        }

        public static Material GetGradient(Texture tex)
        {
            var key = tex != null ? tex : Texture2D.whiteTexture;
            if (_gradientCache.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Spelauget/GradientMesh"));
            if (tex != null) m.SetTexture("_BaseMap", tex);
            _gradientCache[key] = m;
            return m;
        }

        LevelJson ReadLevelJson(RegionId region)
        {
            string path = Path.Combine(Application.streamingAssetsPath, "Levels", region + ".json");
            if (!File.Exists(path)) return null;
            try { return JsonUtility.FromJson<LevelJson>(File.ReadAllText(path)); }
            catch (System.Exception e)
            {
                Debug.LogError($"[WorldLoader] Failed parsing {path}: {e.Message}");
                return null;
            }
        }
    }
}

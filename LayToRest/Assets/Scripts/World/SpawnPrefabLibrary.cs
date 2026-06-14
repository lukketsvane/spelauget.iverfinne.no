using System;
using System.Collections.Generic;
using UnityEngine;

namespace LayToRest.World
{
    /// Maps spawn `kind` strings (and flis `prop` / car `model` variants)
    /// to prefabs. Create via Assets ▸ Create ▸ LayToRest ▸ Spawn Prefab
    /// Library and fill in prefabs made from the imported FBX assets in
    /// Art/Models + Art/Characters.
    [CreateAssetMenu(menuName = "LayToRest/Spawn Prefab Library", fileName = "SpawnPrefabLibrary")]
    public class SpawnPrefabLibrary : ScriptableObject
    {
        [Serializable]
        public struct Entry
        {
            [Tooltip("Spawn kind from spawns.json, e.g. 'purple_coral', 'portal', 'star_npc'. For flis_prop variants use 'flis_prop:<prop>'; for cars 'car:<model>'.")]
            public string kind;
            public GameObject prefab;
        }

        public List<Entry> entries = new();

        Dictionary<string, GameObject> _map;

        public GameObject Get(string kind)
        {
            _map ??= Build();
            return _map.TryGetValue(kind, out var p) ? p : null;
        }

        Dictionary<string, GameObject> Build()
        {
            var m = new Dictionary<string, GameObject>();
            foreach (var e in entries)
                if (!string.IsNullOrEmpty(e.kind) && e.prefab != null)
                    m[e.kind] = e.prefab;
            return m;
        }

        void OnValidate() => _map = null;
    }
}

using UnityEngine;
using LayToRest.Core;
using LayToRest.Player;

namespace LayToRest.World
{
    /// One-shot pickups: keys (open a specific portal), crystals
    /// (consumable currency) and hidden artifacts (one per outer world —
    /// the mandala ending reads them as a bitmask). Ports Key.tsx /
    /// Crystal.tsx / Artifact.tsx pickup behaviour.
    public class Pickup : MonoBehaviour
    {
        public enum Type { Key, Crystal, Artifact }

        public Type type;
        public string spawnId;
        public RegionId region; // key: opens; artifact: belongs-to

        [Tooltip("Slow idle spin so pickups read as interactable.")]
        public float spinDegPerSec = 45f;

        public void Configure(Type t, SpawnJson s)
        {
            type = t;
            spawnId = s.id;
            string regionStr = t == Type.Key ? s.opens : s.region;
            if (!string.IsNullOrEmpty(regionStr) && Regions.TryParse(regionStr, out var r))
                region = r;
            EnsureTrigger();
        }

        void EnsureTrigger()
        {
            var col = GetComponent<Collider>();
            if (col == null)
            {
                var sc = gameObject.AddComponent<SphereCollider>();
                sc.radius = 1f;
                col = sc;
            }
            col.isTrigger = true;
        }

        void Update()
        {
            transform.Rotate(0f, spinDegPerSec * Time.deltaTime, 0f, Space.World);
        }

        void OnTriggerEnter(Collider other)
        {
            if (other.GetComponentInParent<PlayerController>() == null) return;
            var gs = GameState.Instance;
            if (gs == null) return;

            switch (type)
            {
                case Type.Key: gs.AddKey(region); break;
                case Type.Crystal: gs.AddCrystal(); break;
                case Type.Artifact: gs.AddArtifact(region); break;
            }
            gs.CollectItem(spawnId);
            Destroy(gameObject);
        }
    }
}

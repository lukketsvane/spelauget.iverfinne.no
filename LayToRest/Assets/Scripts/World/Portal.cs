using UnityEngine;
using LayToRest.Core;
using LayToRest.Player;

namespace LayToRest.World
{
    /// Port of Portal.tsx gating: a trigger that teleports the player to
    /// `targetRegion` when entered, locked behind `requiredKey` (a RegionId)
    /// when set. Legacy behaviour without requiredKey: any key opens it.
    public class Portal : MonoBehaviour
    {
        public RegionId targetRegion;
        public bool hasRequiredKey;
        public RegionId requiredKey;

        public void Configure(SpawnJson s)
        {
            if (Regions.TryParse(s.targetRegion, out var t)) targetRegion = t;
            hasRequiredKey = !string.IsNullOrEmpty(s.requiredKey) && Regions.TryParse(s.requiredKey, out requiredKey);
            EnsureTrigger();
        }

        void EnsureTrigger()
        {
            var col = GetComponent<Collider>();
            if (col == null)
            {
                var sc = gameObject.AddComponent<SphereCollider>();
                sc.radius = 1.5f;
                col = sc;
            }
            col.isTrigger = true;
        }

        void OnTriggerEnter(Collider other)
        {
            var player = other.GetComponentInParent<PlayerController>();
            if (player == null) return;

            var gs = GameState.Instance;
            bool unlocked = hasRequiredKey
                ? gs != null && gs.HasKeyFor(requiredKey)
                : gs != null && gs.HasKey; // legacy any-key

            if (!unlocked)
            {
                Debug.Log($"[Portal] Locked — needs key '{(hasRequiredKey ? requiredKey.ToString() : "any")}'.");
                return;
            }

            WorldLoader.Instance?.LoadRegion(targetRegion, teleportPlayer: true);
        }
    }
}

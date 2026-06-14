using System;
using System.Collections.Generic;
using UnityEngine;

namespace LayToRest.Core
{
    /// Persistent game state — port of src/store/game.ts (zustand store).
    /// Saved as JSON in PlayerPrefs under "spelauget.game", same field
    /// names as the web save so the shape stays recognisable.
    [Serializable]
    public class GameStateData
    {
        public int hearts = 3;
        public int coins = 0;
        public int crystals = 0;
        public int level = 1;
        public int xp = 0;
        public int xpToNext = 10;
        public bool bobbleVanished = false;
        public List<string> keys = new();
        public List<string> artifacts = new();
        public List<string> collectedItems = new();
        public List<string> activatedAltars = new();
    }

    public class GameState : MonoBehaviour
    {
        const string PrefsKey = "spelauget.game";

        public static GameState Instance { get; private set; }
        public GameStateData Data { get; private set; } = new();

        public event Action Changed;

        public bool HasKey => Data.keys.Count > 0; // legacy bool mirror

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Load();
        }

        public void AddCoin() { Data.coins++; Save(); }
        public void AddCrystal() { Data.crystals++; Save(); }

        /// Returns true if a crystal was actually consumed.
        public bool UseCrystal()
        {
            if (Data.crystals <= 0) return false;
            Data.crystals--; Save();
            return true;
        }

        public void TakeDamage() { Data.hearts = Mathf.Max(0, Data.hearts - 1); Save(); }

        /// Same XP curve as web: overflow carries, threshold ×1.5 per level.
        public void AddXp(int amount)
        {
            Data.xp += amount;
            while (Data.xp >= Data.xpToNext)
            {
                Data.xp -= Data.xpToNext;
                Data.level++;
                Data.xpToNext = Mathf.RoundToInt(Data.xpToNext * 1.5f);
            }
            Save();
        }

        /// Digger's key opens the first chain portal (lysningen → blod).
        public void GiveKey() => AddKey(RegionId.blod);

        public bool HasKeyFor(RegionId region) => Data.keys.Contains(region.ToString());

        public void AddKey(RegionId region)
        {
            var s = region.ToString();
            if (Data.keys.Contains(s)) return;
            Data.keys.Add(s); Save();
        }

        public void AddArtifact(RegionId region)
        {
            var s = region.ToString();
            if (Data.artifacts.Contains(s)) return;
            Data.artifacts.Add(s); Save();
        }

        public void VanishBobble() { Data.bobbleVanished = true; Save(); }

        public bool IsCollected(string id) => Data.collectedItems.Contains(id);
        public void CollectItem(string id)
        {
            if (Data.collectedItems.Contains(id)) return;
            Data.collectedItems.Add(id); Save();
        }

        public bool IsAltarActivated(string id) => Data.activatedAltars.Contains(id);
        public void ActivateAltar(string id)
        {
            if (Data.activatedAltars.Contains(id)) return;
            Data.activatedAltars.Add(id); Save();
        }

        public void ResetAll()
        {
            Data = new GameStateData();
            Save();
        }

        void Save()
        {
            PlayerPrefs.SetString(PrefsKey, JsonUtility.ToJson(Data));
            PlayerPrefs.Save();
            Changed?.Invoke();
        }

        void Load()
        {
            var json = PlayerPrefs.GetString(PrefsKey, null);
            if (!string.IsNullOrEmpty(json))
            {
                try { Data = JsonUtility.FromJson<GameStateData>(json) ?? new GameStateData(); }
                catch { Data = new GameStateData(); }
            }
            Changed?.Invoke();
        }
    }
}

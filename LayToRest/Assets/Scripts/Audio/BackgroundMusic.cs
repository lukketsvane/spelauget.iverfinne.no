using System.Collections.Generic;
using UnityEngine;
using LayToRest.Core;
using LayToRest.World;

namespace LayToRest.Audio
{
    /// Port of BackgroundMusic.tsx. Per-region playlists, picked by mood;
    /// each track plays once then advances to the next in a shuffled queue.
    /// Volume fades in over 4 s on the first track and afterwards tracks the
    /// GamePrefs.MusicVolume slider live. Clips load from
    /// Resources/Audio/ost_NN — no scene wiring needed (mirrors GameHud's
    /// self-building convention). Plays on the splash menu already, since the
    /// region defaults to lysningen before the world loads.
    [RequireComponent(typeof(AudioSource))]
    public class BackgroundMusic : MonoBehaviour
    {
        const float FadeSeconds = 4f;

        // RegionId → ordered track pool. Mirrors PLAYLISTS in the web build.
        static readonly Dictionary<RegionId, string[]> Playlists = new()
        {
            { RegionId.lysningen, new[] { "ost_01", "ost_02" } },
            { RegionId.remnants,  new[] { "ost_04", "ost_03" } },
            { RegionId.blod,      new[] { "ost_03", "ost_04" } },
            { RegionId.geometri,  new[] { "ost_04", "ost_03" } },
            { RegionId.siste,     new[] { "ost_04", "ost_03" } },
            { RegionId.senter,    new[] { "ost_01", "ost_02" } },
        };

        AudioSource _src;
        readonly List<string> _queue = new();
        RegionId _queueRegion;
        bool _hasQueue;
        bool _playing;        // a clip is currently running → watch for its end
        float _fadeStart = -1f;

        void Awake()
        {
            _src = GetComponent<AudioSource>();
            _src.loop = false;
            _src.playOnAwake = false;
            _src.volume = 0f;
            _src.ignoreListenerPause = true; // keep playing while the menu pauses the game
        }

        void Start() => NextTrack();

        void Update()
        {
            // Volume: fade in for the first FadeSeconds, then follow the slider.
            if (_fadeStart >= 0f)
            {
                float t = Mathf.Clamp01((Time.unscaledTime - _fadeStart) / FadeSeconds);
                _src.volume = t * GamePrefs.MusicVolume;
            }

            // Advance when the running track has finished (web's 'ended').
            if (_playing && !_src.isPlaying)
            {
                _playing = false;
                NextTrack();
            }
        }

        void NextTrack()
        {
            var region = WorldLoader.Instance != null ? WorldLoader.Instance.CurrentRegion : RegionId.lysningen;
            if (!_hasQueue || _queueRegion != region || _queue.Count == 0)
                Refill(region);

            if (_queue.Count == 0) return;
            string name = _queue[0];
            _queue.RemoveAt(0);

            var clip = Resources.Load<AudioClip>($"Audio/{name}");
            if (clip == null)
            {
                Debug.LogWarning($"[BackgroundMusic] Missing clip Resources/Audio/{name}");
                return; // leave _playing false so we don't busy-loop on a bad clip
            }
            _src.clip = clip;
            _src.Play();
            _playing = true;
            if (_fadeStart < 0f) _fadeStart = Time.unscaledTime; // first track kicks off the fade-in
        }

        void Refill(RegionId region)
        {
            _queue.Clear();
            var pool = Playlists.TryGetValue(region, out var p) ? p : Playlists[RegionId.lysningen];
            var shuffled = new List<string>(pool);
            for (int i = shuffled.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1);
                (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
            }
            _queue.AddRange(shuffled);
            _queueRegion = region;
            _hasQueue = true;
        }
    }
}

using System;
using UnityEngine;

namespace LayToRest.Core
{
    /// Display / audio preferences — ports store/audio.ts (musicVolume) and
    /// store/settings.ts (exposure). These live apart from GameState so they
    /// survive a "New Game" reset, and persist to PlayerPrefs across sessions
    /// (same intent as the web's localStorage `spelauget.audio` / `.settings`).
    public static class GamePrefs
    {
        const string MusicKey = "spelauget.audio.musicVolume";
        const string ExposureKey = "spelauget.settings.exposure";

        /// Fires whenever a value changes so the music mixer / exposure sync
        /// can react live to a slider drag.
        public static event Action Changed;

        static float _music = -1f;
        static float _exposure = -1f;

        /// 0–1, default 0.55 (audio.ts).
        public static float MusicVolume
        {
            get { if (_music < 0f) _music = PlayerPrefs.GetFloat(MusicKey, 0.55f); return _music; }
            set
            {
                _music = Mathf.Clamp01(value);
                PlayerPrefs.SetFloat(MusicKey, _music);
                PlayerPrefs.Save();
                Changed?.Invoke();
            }
        }

        /// Final-image exposure multiplier, 0.4–1.8, default 1.0 (settings.ts).
        public static float Exposure
        {
            get { if (_exposure < 0f) _exposure = PlayerPrefs.GetFloat(ExposureKey, 1.0f); return _exposure; }
            set
            {
                _exposure = Mathf.Clamp(value, 0.4f, 1.8f);
                PlayerPrefs.SetFloat(ExposureKey, _exposure);
                PlayerPrefs.Save();
                Changed?.Invoke();
            }
        }
    }
}

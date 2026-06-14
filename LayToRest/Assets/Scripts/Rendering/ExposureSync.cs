using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using LayToRest.Core;

namespace LayToRest.Rendering
{
    /// Port of ExposureSync.tsx: drives the final-image brightness from the
    /// GamePrefs.Exposure slider. The web multiplied gl.toneMappingExposure;
    /// URP's equivalent is ColorAdjustments.postExposure, which is measured
    /// in EV stops — so a ×exposure multiplier maps to log2(exposure) stops.
    ///
    /// Looks up a global Volume's ColorAdjustments override (set up by
    /// Tools ▸ LayToRest ▸ Build Title Screen). If none exists the component
    /// is a harmless no-op — the menu/music/pixelation still work.
    public class ExposureSync : MonoBehaviour
    {
        ColorAdjustments _color;
        float _applied = float.NaN;

        void OnEnable() => Resolve();

        void Resolve()
        {
            _color = null;
            foreach (var v in FindObjectsByType<Volume>(FindObjectsSortMode.None))
            {
                if (v.profile == null) continue;
                if (v.profile.TryGet(out ColorAdjustments ca)) { _color = ca; break; }
            }
        }

        void Update()
        {
            if (_color == null) { if (Time.frameCount % 60 == 0) Resolve(); return; }
            float e = GamePrefs.Exposure;
            if (Mathf.Approximately(e, _applied)) return;
            _applied = e;
            _color.postExposure.overrideState = true;
            _color.postExposure.value = Mathf.Log(Mathf.Max(0.01f, e), 2f);
        }
    }
}

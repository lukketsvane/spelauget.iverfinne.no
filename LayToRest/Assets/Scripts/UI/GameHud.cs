using UnityEngine;
using UnityEngine.UI;
using LayToRest.Core;
using LayToRest.World;

namespace LayToRest.UI
{
    /// Minimal port of the web HUD: red hearts top-left, letter-spaced
    /// region name bottom-left. Builds its own canvas at runtime so no
    /// scene wiring is needed.
    public class GameHud : MonoBehaviour
    {
        Text _hearts;
        Text _region;

        void Awake()
        {
            var canvasGo = new GameObject("HUDCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);
            canvasGo.AddComponent<GraphicRaycaster>();

            _hearts = MakeText(canvasGo.transform, "Hearts",
                anchorMin: new Vector2(0, 1), anchorMax: new Vector2(0, 1),
                pivot: new Vector2(0, 1), pos: new Vector2(18, -14),
                size: 26, new Color(1f, 0.27f, 0.35f));

            _region = MakeText(canvasGo.transform, "Region",
                anchorMin: new Vector2(0, 0), anchorMax: new Vector2(0, 0),
                pivot: new Vector2(0, 0), pos: new Vector2(18, 36),
                size: 13, new Color(0.75f, 0.75f, 0.85f, 0.85f));
        }

        void Update()
        {
            var gs = GameState.Instance;
            if (gs != null)
            {
                int h = Mathf.Max(0, gs.Data.hearts);
                _hearts.text = string.Join(" ", System.Linq.Enumerable.Repeat("♥", h));
            }
            var wl = WorldLoader.Instance;
            if (wl != null && Regions.All.TryGetValue(wl.CurrentRegion, out var def))
            {
                // Letter-spaced uppercase, like the web's tracking-wide label.
                _region.text = string.Join(" ", def.displayName.ToUpperInvariant().ToCharArray());
            }
        }

        static Text MakeText(Transform parent, string name,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 pos,
            int size, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = anchorMin; rt.anchorMax = anchorMax; rt.pivot = pivot;
            rt.anchoredPosition = pos;
            rt.sizeDelta = new Vector2(640, 48);
            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = size;
            text.color = color;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }
    }
}

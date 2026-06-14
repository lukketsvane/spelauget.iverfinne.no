using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using LayToRest.Core;
using LayToRest.Player;

namespace LayToRest.UI
{
    /// Port of MainMenu.tsx + the menu store. Splash on first launch (full
    /// pixel-art bg over a paused game), then a dim pause overlay reachable
    /// with Esc / Q. Buttons: Continue (if a save exists), New Game (splash
    /// only), Settings, Title Screen (pause only). Settings holds the Music
    /// and Brightness sliders plus Erase Save — same as the web panel.
    ///
    /// Builds its own canvas at runtime, so the only scene wiring needed is
    /// "add this component" (see Tools ▸ LayToRest ▸ Build Title Screen).
    public class MainMenu : MonoBehaviour
    {
        // Tailwind-ish palette from the web menu.
        static readonly Color VioletPanel = new(0.18f, 0.063f, 0.396f, 0.80f); // violet-950/80
        static readonly Color PinkBorder = new(0.976f, 0.659f, 0.831f, 0.60f); // pink-300/60
        static readonly Color VioletText = new(0.93f, 0.91f, 1f);              // violet-100
        static readonly Color PinkText = new(0.98f, 0.80f, 0.92f);             // pink-200
        static readonly Color RosePanel = new(0.30f, 0.02f, 0.10f, 0.80f);     // rose-950/80
        static readonly Color RoseBorder = new(1f, 0.45f, 0.5f, 0.70f);
        static readonly Color RoseText = new(1f, 0.89f, 0.90f);

        Font _font;
        Canvas _canvas;
        Image _bg;
        RawImage _splash;
        RectTransform _column; // holds either the button stack or settings
        PlayerController _player;

        bool _hasStarted;
        bool _open = true;
        bool _showSettings;

        void Awake()
        {
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _player = FindFirstObjectByType<PlayerController>(FindObjectsInactive.Include);
            EnsureEventSystem();
            BuildCanvas();
            // Start on the splash with the game paused until the player picks.
            _open = true;
            _hasStarted = false;
            _showSettings = false;
            Pause();
            Refresh();
        }

        void Update()
        {
            // Esc / Q toggles the pause overlay once the game has started
            // (matches MenuHotkey.tsx). On the splash the keys do nothing.
            var kb = Keyboard.current;
            if (kb == null || !_hasStarted) return;
            if (kb.escapeKey.wasPressedThisFrame || kb.qKey.wasPressedThisFrame)
            {
                if (_open) Resume();
                else { _open = true; _showSettings = false; Pause(); Refresh(); }
            }
        }

        // --- Actions --------------------------------------------------------
        void StartGame() // Continue
        {
            _hasStarted = true;
            Resume();
        }

        void NewGame()
        {
            GameState.Instance?.ResetAll();
            _hasStarted = true;
            Resume();
        }

        void BackToTitle()
        {
            // Keep the save; just return to the splash (paused, full bg).
            _hasStarted = false;
            _showSettings = false;
            _open = true;
            Pause();
            Refresh();
        }

        void EraseSave()
        {
            PlayerPrefs.DeleteKey("spelauget.game");
            PlayerPrefs.Save();
            GameState.Instance?.ResetAll();
            _showSettings = false;
            Refresh();
        }

        // --- Pause / resume -------------------------------------------------
        void Pause()
        {
            _open = true;
            Time.timeScale = 0f;
            if (_player != null) _player.enabled = false;
            if (_canvas != null) _canvas.gameObject.SetActive(true);
            Refresh();
        }

        void Resume()
        {
            _open = false;
            _showSettings = false;
            Time.timeScale = 1f;
            if (_player != null) _player.enabled = true;
            if (_canvas != null) _canvas.gameObject.SetActive(false);
        }

        // --- Has-save check (mirrors MainMenu.tsx "meaningful" flags) -------
        bool HasSave()
        {
            var gs = GameState.Instance;
            if (gs == null) return false;
            var d = gs.Data;
            return d.keys.Count > 0 || d.bobbleVanished || d.coins > 0 || d.crystals > 0;
        }

        // --- UI build -------------------------------------------------------
        void BuildCanvas()
        {
            var go = new GameObject("MainMenuCanvas");
            go.transform.SetParent(transform, false);
            _canvas = go.AddComponent<Canvas>();
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            _canvas.sortingOrder = 100; // above the HUD
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();

            // Background veil (opaque on splash, translucent as pause overlay).
            _bg = MakeImage(go.transform, "BG", Color.black);
            Stretch(_bg.rectTransform);

            // Splash image (only shown on the very first visit).
            var splashGo = new GameObject("Splash");
            splashGo.transform.SetParent(go.transform, false);
            _splash = splashGo.AddComponent<RawImage>();
            _splash.texture = Resources.Load<Texture2D>("UI/menu_screen");
            FitCover(_splash);

            // Button / settings column — bottom-centre, like the web menu.
            var colGo = new GameObject("Column");
            colGo.transform.SetParent(go.transform, false);
            _column = colGo.AddComponent<RectTransform>();
            _column.anchorMin = new Vector2(0.5f, 0f);
            _column.anchorMax = new Vector2(0.5f, 0f);
            _column.pivot = new Vector2(0.5f, 0f);
            _column.anchoredPosition = new Vector2(0, 60);
            _column.sizeDelta = new Vector2(360, 0);
            var vlg = colGo.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = 12;
            vlg.childAlignment = TextAnchor.LowerCenter;
            vlg.childControlWidth = true;
            vlg.childControlHeight = true; // honour each child's LayoutElement height
            vlg.childForceExpandWidth = true;
            vlg.childForceExpandHeight = false;
            var fitter = colGo.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }

        void Refresh()
        {
            if (_canvas == null) return;

            // Splash vs pause-overlay look.
            _bg.color = _hasStarted ? new Color(0, 0, 0, 0.70f) : Color.black;
            _splash.gameObject.SetActive(!_hasStarted);

            // Rebuild the column contents for the current state.
            for (int i = _column.childCount - 1; i >= 0; i--)
                Destroy(_column.GetChild(i).gameObject);

            if (_showSettings) BuildSettings();
            else BuildButtons();
        }

        void BuildButtons()
        {
            if (HasSave()) MakeButton(_column, "Continue", StartGame);
            if (!_hasStarted) MakeButton(_column, "New Game", NewGame);
            MakeButton(_column, "Settings", () => { _showSettings = true; Refresh(); });
            if (_hasStarted) MakeButton(_column, "Title Screen", BackToTitle);
        }

        void BuildSettings()
        {
            MakeSlider(_column, "Music", GamePrefs.MusicVolume, 0f, 1f,
                v => GamePrefs.MusicVolume = v, v => $"{Mathf.RoundToInt(v * 100)}");
            MakeSlider(_column, "Brightness", GamePrefs.Exposure, 0.4f, 1.8f,
                v => GamePrefs.Exposure = v, v => $"{Mathf.RoundToInt(v * 100)}");
            MakeButton(_column, "Erase Save", EraseSave, danger: true);
            MakeButton(_column, "Back", () => { _showSettings = false; Refresh(); });
        }

        // --- Widget builders ------------------------------------------------
        Button MakeButton(Transform parent, string label, System.Action onClick, bool danger = false)
        {
            var go = new GameObject(label + "Button");
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = danger ? RosePanel : VioletPanel;
            var outline = go.AddComponent<Outline>();
            outline.effectColor = danger ? RoseBorder : PinkBorder;
            outline.effectDistance = new Vector2(2, -2);
            var le = go.AddComponent<LayoutElement>();
            le.minHeight = 52; le.preferredHeight = 52;
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(() => onClick());

            var txt = MakeLabel(go.transform, Spaced(label.ToUpperInvariant()),
                18, danger ? RoseText : VioletText, TextAnchor.MiddleCenter);
            Stretch(txt.rectTransform);
            return btn;
        }

        void MakeSlider(Transform parent, string label, float value, float min, float max,
            System.Action<float> onChange, System.Func<float, string> format)
        {
            // Panel chrome matching the web RangeSlider card.
            var panel = new GameObject(label + "Panel");
            panel.transform.SetParent(parent, false);
            var pimg = panel.AddComponent<Image>();
            pimg.color = VioletPanel;
            var po = panel.AddComponent<Outline>();
            po.effectColor = PinkBorder; po.effectDistance = new Vector2(2, -2);
            var ple = panel.AddComponent<LayoutElement>();
            ple.minHeight = 64; ple.preferredHeight = 64;
            var pvl = panel.AddComponent<VerticalLayoutGroup>();
            pvl.padding = new RectOffset(14, 14, 10, 10);
            pvl.spacing = 6;
            pvl.childControlWidth = true; pvl.childControlHeight = true;
            pvl.childForceExpandWidth = true; pvl.childForceExpandHeight = false;

            // Header row: label + live value.
            var header = new GameObject("Header");
            header.transform.SetParent(panel.transform, false);
            header.AddComponent<RectTransform>();
            var hle = header.AddComponent<LayoutElement>(); hle.minHeight = 16;
            var hl = MakeLabel(header.transform, Spaced(label.ToUpperInvariant()), 13, PinkText, TextAnchor.MiddleLeft);
            Stretch(hl.rectTransform);
            var hv = MakeLabel(header.transform, format(value), 13, VioletText, TextAnchor.MiddleRight);
            Stretch(hv.rectTransform);

            // The slider track.
            var sgo = new GameObject("Slider");
            sgo.transform.SetParent(panel.transform, false);
            var srt = sgo.AddComponent<RectTransform>();
            var sle = sgo.AddComponent<LayoutElement>(); sle.minHeight = 16; sle.preferredHeight = 16;
            var slider = sgo.AddComponent<Slider>();

            var bgImg = MakeImage(sgo.transform, "Background", new Color(0, 0, 0, 0.45f));
            Stretch(bgImg.rectTransform);

            var fillArea = new GameObject("Fill Area");
            fillArea.transform.SetParent(sgo.transform, false);
            var fart = fillArea.AddComponent<RectTransform>();
            fart.anchorMin = new Vector2(0, 0.25f); fart.anchorMax = new Vector2(1, 0.75f);
            fart.offsetMin = Vector2.zero; fart.offsetMax = Vector2.zero;
            var fill = MakeImage(fillArea.transform, "Fill", PinkText);
            fill.rectTransform.anchorMin = new Vector2(0, 0);
            fill.rectTransform.anchorMax = new Vector2(1, 1);
            fill.rectTransform.sizeDelta = Vector2.zero;

            var handleArea = new GameObject("Handle Slide Area");
            handleArea.transform.SetParent(sgo.transform, false);
            var hart = handleArea.AddComponent<RectTransform>();
            hart.anchorMin = new Vector2(0, 0); hart.anchorMax = new Vector2(1, 1);
            hart.offsetMin = Vector2.zero; hart.offsetMax = Vector2.zero;
            var handle = MakeImage(handleArea.transform, "Handle", Color.white);
            // Vertical-stretch anchors: the Slider only drives the x anchor,
            // so y must span 0..1 or the handle collapses to zero height.
            handle.rectTransform.anchorMin = new Vector2(0, 0);
            handle.rectTransform.anchorMax = new Vector2(0, 1);
            handle.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            handle.rectTransform.sizeDelta = new Vector2(14, 0);

            slider.fillRect = fill.rectTransform;
            slider.handleRect = handle.rectTransform;
            slider.targetGraphic = handle;
            slider.direction = Slider.Direction.LeftToRight;
            slider.minValue = min; slider.maxValue = max; slider.value = value;
            slider.onValueChanged.AddListener(v =>
            {
                onChange(v);
                hv.text = format(v);
            });
        }

        Image MakeImage(Transform parent, string name, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = color;
            return img;
        }

        Text MakeLabel(Transform parent, string content, int size, Color color, TextAnchor anchor)
        {
            var go = new GameObject("Label");
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            var t = go.AddComponent<Text>();
            t.font = _font;
            t.text = content;
            t.fontSize = size;
            t.fontStyle = FontStyle.Bold;
            t.color = color;
            t.alignment = anchor;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }

        // object-fit: cover for the splash RawImage (crop, don't distort).
        // EnvelopeParent wants centre anchors so the overflow crops evenly.
        void FitCover(RawImage ri)
        {
            var rt = ri.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = Vector2.zero;
            if (ri.texture == null) return;
            var fitter = ri.gameObject.GetComponent<AspectRatioFitter>() ?? ri.gameObject.AddComponent<AspectRatioFitter>();
            fitter.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
            fitter.aspectRatio = (float)ri.texture.width / ri.texture.height;
        }

        // "CONTINUE" → "C O N T I N U E" (Legacy Text has no letter-spacing;
        // mirrors GameHud's tracking-wide region label trick).
        static string Spaced(string s) => string.Join(" ", s.ToCharArray());

        void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>(FindObjectsInactive.Include) != null) return;
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
            // Project uses the new Input System; wire the module's built-in
            // default UI actions so buttons/sliders respond to pointer input.
            var module = es.AddComponent<InputSystemUIInputModule>();
            module.AssignDefaultActions();
        }
    }
}

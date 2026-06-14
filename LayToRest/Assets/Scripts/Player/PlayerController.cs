using UnityEngine;
using UnityEngine.InputSystem;

namespace LayToRest.Player
{
    /// Port of the web input stack (PointerInput.tsx + KeyboardInput.tsx +
    /// Character.tsx movement), designed for iOS/mobile first:
    ///
    ///   Touch — quick tap (≤220 ms, ≤14 px) walks to the tapped ground
    ///   point; tap-and-drag becomes an analog joystick (60 px knob).
    ///
    ///   Mouse — hold to walk: while the button is held the character
    ///   chases the cursor's projected ground position. Speed scales with
    ///   cursor distance (walk near, run far), dead zone right on top.
    ///
    ///   Keyboard / gamepad — WASD / arrows / left stick, camera-relative.
    ///
    /// Like the web build, input magnitude drives speed: velocity =
    /// dir · mag · runSpeed, and animation switches to "run" above 0.85.
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Config (mirrors config.ts CHARACTER)")]
        public float walkSpeed = 3.0f;
        public float runSpeed = 5.5f;
        [Tooltip("rad/sec the character turns toward the move direction")]
        public float turnSpeed = 12f;

        [Header("Pointer (mirrors PointerInput.tsx)")]
        public float knobRadiusPx = 60f;
        public float tapMaxMs = 220f;
        public float tapMaxPx = 14f;
        public float cursorDeadZone = 0.4f;
        public float destinationStopRadius = 0.3f;

        public Transform cameraTransform;

        CharacterController _cc;
        Camera _cam;

        // touch state
        bool _touchActive;
        bool _touchIsDrag;
        Vector2 _touchStart;
        double _touchStartTime;

        Vector3? _destination;

        /// 0..1 input magnitude — drives animation. > 0.85 → run.
        public float NormalizedSpeed { get; private set; }
        public bool IsRunning => NormalizedSpeed > 0.85f;
        public bool IsMoving => NormalizedSpeed > 0.01f;

        void Awake()
        {
            _cc = GetComponent<CharacterController>();
            _cam = Camera.main;
            if (cameraTransform == null && _cam != null)
                cameraTransform = _cam.transform;
        }

        void Update()
        {
            Vector3 dir = Vector3.zero;
            float mag = 0f;

            ReadTouch(ref dir, ref mag);
            if (mag <= 0f) ReadMouse(ref dir, ref mag);
            if (mag <= 0f) ReadKeysAndStick(ref dir, ref mag);
            if (mag <= 0f) FollowDestination(ref dir, ref mag);

            NormalizedSpeed = mag;

            if (mag > 0.001f && dir.sqrMagnitude > 0.0001f)
            {
                _cc.SimpleMove(dir * (mag * runSpeed));
                Quaternion target = Quaternion.LookRotation(dir, Vector3.up);
                float t = 1f - Mathf.Exp(-turnSpeed * Time.deltaTime);
                transform.rotation = Quaternion.Slerp(transform.rotation, target, t);
            }
            else
            {
                _cc.SimpleMove(Vector3.zero); // keep gravity applied
            }
        }

        // --- Touch: tap-to-move + drag joystick ---------------------------
        void ReadTouch(ref Vector3 dir, ref float mag)
        {
            var ts = Touchscreen.current;
            if (ts == null) return;
            var touch = ts.primaryTouch;
            bool pressed = touch.press.isPressed;
            Vector2 pos = touch.position.ReadValue();

            float px = DpiScale();

            if (pressed && !_touchActive)
            {
                _touchActive = true;
                _touchIsDrag = false;
                _touchStart = pos;
                _touchStartTime = Time.unscaledTimeAsDouble;
            }
            else if (pressed && _touchActive)
            {
                Vector2 d = pos - _touchStart;
                if (!_touchIsDrag &&
                    (d.magnitude > tapMaxPx * px ||
                     (Time.unscaledTimeAsDouble - _touchStartTime) * 1000.0 > tapMaxMs))
                {
                    _touchIsDrag = true;
                    _destination = null;
                }
                if (_touchIsDrag)
                {
                    Vector2 k = Vector2.ClampMagnitude(d, knobRadiusPx * px);
                    Vector2 knob = k / (knobRadiusPx * px); // -1..1, screen space
                    dir = CameraRelative(new Vector2(knob.x, -knob.y));
                    mag = Mathf.Clamp01(knob.magnitude);
                }
            }
            else if (!pressed && _touchActive)
            {
                if (!_touchIsDrag && RaycastGround(pos, out var hit))
                    _destination = hit; // tap → walk there
                _touchActive = false;
                _touchIsDrag = false;
            }
        }

        // --- Mouse: hold-to-walk toward cursor ----------------------------
        void ReadMouse(ref Vector3 dir, ref float mag)
        {
            var mouse = Mouse.current;
            if (mouse == null || !mouse.leftButton.isPressed) return;
            _destination = null;
            if (!RaycastGround(mouse.position.ReadValue(), out var hit)) return;

            Vector3 to = hit - transform.position;
            to.y = 0;
            float dist = to.magnitude;
            if (dist < cursorDeadZone) { mag = 0f; return; }
            dir = to / dist;
            // Walk when the cursor is close, run further out (≈2.7 m+).
            mag = Mathf.Min(1f, 0.5f + (dist - cursorDeadZone) / 4.0f);
        }

        // --- Keyboard / gamepad -------------------------------------------
        void ReadKeysAndStick(ref Vector3 dir, ref float mag)
        {
            Vector2 v = Vector2.zero;
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) v.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) v.y -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) v.x += 1;
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) v.x -= 1;
            }
            var pad = Gamepad.current;
            if (pad != null && v == Vector2.zero)
                v = pad.leftStick.ReadValue();
            if (v == Vector2.zero) return;

            _destination = null;
            v = Vector2.ClampMagnitude(v, 1f);
            dir = CameraRelative(v);
            mag = v.magnitude;
        }

        // --- Tap destination ----------------------------------------------
        void FollowDestination(ref Vector3 dir, ref float mag)
        {
            if (_destination == null) return;
            Vector3 to = _destination.Value - transform.position;
            to.y = 0;
            float dist = to.magnitude;
            if (dist < destinationStopRadius) { _destination = null; return; }
            dir = to / dist;
            mag = 1f;
        }

        // --- helpers -------------------------------------------------------
        Vector3 CameraRelative(Vector2 input)
        {
            Vector3 fwd = cameraTransform != null ? cameraTransform.forward : Vector3.forward;
            Vector3 right = cameraTransform != null ? cameraTransform.right : Vector3.right;
            fwd.y = 0; right.y = 0;
            fwd.Normalize(); right.Normalize();
            Vector3 d = right * input.x + fwd * input.y;
            return d.sqrMagnitude > 0.0001f ? d.normalized : Vector3.zero;
        }

        bool RaycastGround(Vector2 screenPos, out Vector3 hit)
        {
            hit = default;
            if (_cam == null) _cam = Camera.main;
            if (_cam == null) return false;
            Ray ray = _cam.ScreenPointToRay(screenPos);
            var ground = new Plane(Vector3.up, 0f);
            if (!ground.Raycast(ray, out float enter)) return false;
            hit = ray.GetPoint(enter);
            return true;
        }

        static float DpiScale()
        {
            // Web thresholds are CSS px; scale by device DPI (160 = 1x).
            float dpi = Screen.dpi;
            return dpi > 1f ? Mathf.Max(1f, dpi / 160f) : 1f;
        }

        /// Hard teleport (portals / fast travel).
        public void TeleportTo(Vector3 worldPos)
        {
            _destination = null;
            _cc.enabled = false;
            transform.position = worldPos;
            _cc.enabled = true;
        }
    }
}

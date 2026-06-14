using UnityEngine;

namespace LayToRest.Player
{
    /// Port of the web iso camera (config.ts CAMERA + Scene.tsx follow).
    /// Orthographic, 45° azimuth with a flat-ish pitch, smooth lerp follow.
    [RequireComponent(typeof(Camera))]
    public class IsoCameraFollow : MonoBehaviour
    {
        public Transform target;

        [Header("Config (mirrors config.ts CAMERA)")]
        public Vector3 offset = new(14f, 9f, 14f);
        [Tooltip("Ortho frustum HEIGHT in world units / 2 → Unity orthographicSize. Web viewSize 18 ≈ size 9.")]
        public float viewSize = 18f;
        public float viewSizeDesktop = 14f;
        [Range(0.01f, 1f)] public float followLerp = 0.12f;
        public bool useDesktopZoom = true;

        Camera _cam;
        Vector3 _focus;

        void Awake()
        {
            _cam = GetComponent<Camera>();
            _cam.orthographic = true;
            // Web viewSize is full frustum height; Unity's orthographicSize is half.
            _cam.orthographicSize = (useDesktopZoom ? viewSizeDesktop : viewSize) * 0.5f;
        }

        void Start()
        {
            if (target != null) _focus = target.position;
            Snap();
        }

        void LateUpdate()
        {
            if (target == null) return;
            // Frame-rate independent version of the web's per-frame 0.12 lerp
            // (authored at 60 fps).
            float t = 1f - Mathf.Pow(1f - followLerp, Time.deltaTime * 60f);
            _focus = Vector3.Lerp(_focus, target.position, t);
            Apply();
        }

        public void Snap()
        {
            if (target != null) _focus = target.position;
            Apply();
        }

        void Apply()
        {
            transform.position = _focus + offset;
            transform.LookAt(_focus, Vector3.up);
        }
    }
}

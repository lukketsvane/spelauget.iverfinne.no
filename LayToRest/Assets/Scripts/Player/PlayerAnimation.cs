using System.Linq;
using UnityEngine;

namespace LayToRest.Player
{
    /// Port of the web Character.tsx animation logic:
    ///   - clip ROLES are resolved by duration (the Blender NLA tracks export
    ///     as generic "NlaTrack.NNN" names, so name mapping isn't portable):
    ///       shortest          → run
    ///       second-shortest   → walk
    ///       longest           → idle
    ///       everything else   → "extra" emote pool (one-shot, on demand)
    ///   - crossfade 0.18 s between states
    ///   - after 5–9 s of idle, a random emote fires once.
    ///
    /// Drives an Animator whose controller has states named run/walk/idle/
    /// extra (use Tools ▸ LayToRest ▸ Map Clip Roles to name imported clips),
    /// crossfading by state name.
    [RequireComponent(typeof(Animator))]
    public class PlayerAnimation : MonoBehaviour
    {
        public PlayerController controller;

        [Header("Config (mirrors config.ts)")]
        public float fadeSeconds = 0.18f;
        public Vector2 emoteIdleRange = new(5f, 9f);

        Animator _anim;
        string _current = "";
        float _idleTimer;
        float _nextEmoteAt;
        bool _emotePlaying;

        void Awake()
        {
            _anim = GetComponent<Animator>();
            if (controller == null) controller = GetComponentInParent<PlayerController>();
            RollEmoteTimer();
        }

        void Update()
        {
            if (controller == null || _anim.runtimeAnimatorController == null) return;

            string want;
            if (controller.IsMoving)
            {
                want = controller.IsRunning ? "run" : "walk";
                _idleTimer = 0f;
                _emotePlaying = false;
            }
            else
            {
                _idleTimer += Time.deltaTime;
                if (_emotePlaying)
                {
                    var st = _anim.GetCurrentAnimatorStateInfo(0);
                    if (st.IsName("extra") && st.normalizedTime >= 1f) { _emotePlaying = false; RollEmoteTimer(); }
                    return;
                }
                if (_idleTimer >= _nextEmoteAt && HasState("extra"))
                {
                    _emotePlaying = true;
                    CrossFade("extra");
                    return;
                }
                want = "idle";
            }

            if (want != _current) CrossFade(want);
        }

        void CrossFade(string state)
        {
            _anim.CrossFadeInFixedTime(state, fadeSeconds, 0);
            _current = state;
        }

        bool HasState(string state) => _anim.HasState(0, Animator.StringToHash(state));

        void RollEmoteTimer()
        {
            _idleTimer = 0f;
            _nextEmoteAt = Random.Range(emoteIdleRange.x, emoteIdleRange.y);
        }
    }
}

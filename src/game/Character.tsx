'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { CHARACTER, EMOTE_IDLE_RANGE, PLAYER_MODEL_URL } from './config';
import { playerWorldPos, useInput } from '@/store/input';
import { useEmote } from '@/store/emote';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';
import { collision } from '@/store/collision';
import { WORLD_RADIUS } from './regions';

// Player collision footprint (metres). Big enough that the character
// stops short of huts, doesn't squeeze between trilos.
const PLAYER_RADIUS = 0.6;

type Props = { positionRef: MutableRefObject<THREE.Vector3> };
type Role = 'idle' | 'walk' | 'run';

export default function Character({ positionRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(PLAYER_MODEL_URL);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;

        // Pop the eyes against the rest of the character. Tripo exports
        // sometimes name eye sub-meshes "eye"/"eyeball"/"pupil"; we also
        // catch materials whose existing colour is already very dark
        // (typical eyeball black) and treat them the same way.
        // Eyes stay unshaded — toneMapped: false — so they read at
        // close-to-pure black against the lit body, giving the
        // character a clearly visible gaze even at low dpr.
        const meshName = mesh.name.toLowerCase();
        const matName = (
          (mesh.material as THREE.Material | THREE.Material[] | undefined) &&
          !Array.isArray(mesh.material) &&
          (mesh.material as THREE.MeshStandardMaterial).name
            ? (mesh.material as THREE.MeshStandardMaterial).name
            : ''
        ).toLowerCase();
        const isEyeByName =
          /\beye|pupil|iris|sclera/.test(meshName) ||
          /\beye|pupil|iris|sclera/.test(matName);

        const matCheck = !Array.isArray(mesh.material)
          ? (mesh.material as THREE.MeshStandardMaterial)
          : null;
        const baseColor = matCheck?.color;
        const isEyeByColor =
          baseColor &&
          baseColor.r < 0.15 &&
          baseColor.g < 0.15 &&
          baseColor.b < 0.15;

        if (isEyeByName || isEyeByColor) {
          // Replace with a flat unlit material so the eye reads as a
          // sharp dark dot regardless of the day-cycle lighting.
          mesh.material = new THREE.MeshBasicMaterial({
            color: '#0a0810',
            toneMapped: false,
          });
          mesh.castShadow = false;
          // Push eyes very slightly outward along their normals so they
          // don't z-fight with the head when the body mesh is at the
          // same depth.
          mesh.scale.multiplyScalar(1.08);
        }
      }
    });
  }, [scene]);

  const footLift = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return -box.min.y * CHARACTER.scale;
  }, [scene]);

  const { actions, names, mixer } = useAnimations(animations, group);

  const clipsByRole = useRef<Record<Role, THREE.AnimationAction | null>>({
    idle: null,
    walk: null,
    run: null,
  });
  // Pool of one-shot emote clips (everything that isn't run / walk / idle).
  // We pick one at random per emote firing for visual variety.
  const emotePool = useRef<THREE.AnimationAction[]>([]);
  const activeEmote = useRef<THREE.AnimationAction | null>(null);
  const currentRole = useRef<Role>('idle');
  const isPlayingExtra = useRef(false);

  // Shuffles the next-emote countdown after each emote so they don't feel
  // metronomic. Stored as a ref so useFrame can mutate without re-renders.
  const idleSeconds = useRef(0);
  const nextEmoteAt = useRef(rollEmoteDelay());

  // -- Map clips by duration, configure loop modes ------------------------
  useEffect(() => {
    if (!names.length) return;
    const byDuration = names
      .map((n) => ({ name: n, dur: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => a.dur - b.dur);

    // shortest=run, 2nd=walk, longest=idle, everything else = emote pool.
    const run = byDuration[0]?.name ?? names[0];
    const walk = byDuration[1]?.name ?? run;
    const idle = byDuration[byDuration.length - 1]?.name ?? run;
    const emoteNames = byDuration
      .map((c) => c.name)
      .filter((n) => n !== run && n !== walk && n !== idle);

    clipsByRole.current = {
      run: actions[run] ?? null,
      walk: actions[walk] ?? null,
      idle: actions[idle] ?? actions[names[0]] ?? null,
    };
    emotePool.current = emoteNames
      .map((n) => actions[n])
      .filter((a): a is THREE.AnimationAction => a != null);

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[Character] clips:',
        byDuration.map((c) => `${c.name}=${c.dur.toFixed(2)}s`).join(', '),
        '→ idle:', idle, 'walk:', walk, 'run:', run, 'emotes:', emoteNames,
      );
    }

    // Looping for movement clips; one-shot for emotes.
    for (const role of ['idle', 'walk', 'run'] as const) {
      clipsByRole.current[role]?.setLoop(THREE.LoopRepeat, Infinity);
    }
    for (const emote of emotePool.current) {
      emote.setLoop(THREE.LoopOnce, 1);
      emote.clampWhenFinished = true;
    }

    const idleAction = clipsByRole.current.idle;
    if (idleAction) {
      idleAction.reset().fadeIn(CHARACTER.fadeSeconds).play();
      currentRole.current = 'idle';
    }

    return () => {
      idleAction?.fadeOut(CHARACTER.fadeSeconds);
    };
  }, [actions, names]);

  // -- Emote: fade out whatever's playing, fire a random one-shot, fade
  // back to idle. Always responsive — pressing the button stops movement
  // immediately so the emote actually plays even while the player was
  // walking. The useFrame movement check still cancels mid-emote if the
  // user actively pushes input again.
  const playEmote = useMemo(() => {
    return () => {
      const pool = emotePool.current;
      if (!pool.length) return;
      if (isPlayingExtra.current) return;

      // Halt current motion so the emote has visual room to play.
      useInput.getState().setMove(0, 0);
      useInput.getState().clearDestination();

      const pick = pool[Math.floor(Math.random() * pool.length)];
      activeEmote.current = pick;
      isPlayingExtra.current = true;

      const current = clipsByRole.current[currentRole.current];
      current?.fadeOut(CHARACTER.fadeSeconds * 0.6);
      pick.reset().fadeIn(CHARACTER.fadeSeconds * 0.6).play();
      currentRole.current = 'idle';
    };
  }, []);

  // Mixer's "finished" event: an emote ended → cross-fade back to idle.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== activeEmote.current) return;
      const idle = clipsByRole.current.idle;
      idle?.reset().fadeIn(CHARACTER.fadeSeconds).play();
      e.action.fadeOut(CHARACTER.fadeSeconds);
      isPlayingExtra.current = false;
      activeEmote.current = null;
      idleSeconds.current = 0;
      nextEmoteAt.current = rollEmoteDelay();
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [mixer]);

  // Bridge: external triggers (HUD button, keyboard) push into the emote
  // store; we listen here and call playEmote.
  useEffect(() => {
    return useEmote.subscribe((s, prev) => {
      if (s.requestId !== prev.requestId) playEmote();
    });
  }, [playEmote]);

  // Teleport on level change: reset to the new level's spawn point and
  // halt any input so we don't drift away from the spawn marker.
  useEffect(() => {
    return useLevel.subscribe((s, prev) => {
      if (s.changeCounter === prev.changeCounter) return;
      const g = group.current;
      if (!g) return;
      g.position.set(s.playerSpawn.x, 0, s.playerSpawn.z);
      g.quaternion.identity();
      useInput.getState().setMove(0, 0);
      useInput.getState().clearDestination();
    });
  }, []);

  // Initial spawn: teleport to the rehydrated playerSpawn (which is
  // savedPosition on Continue, or the level marker on a fresh save).
  // Without this, the character would render at world origin until the
  // first level-change subscription fires.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const spawn = useLevel.getState().playerSpawn;
    g.position.set(spawn.x, 0, spawn.z);
    positionRef.current.copy(g.position);
    playerWorldPos.copy(g.position);
  }, [positionRef]);

  // Autosave: write the current position to the level store every
  // couple seconds. Gated on `hasStartedGame` so the splash screen
  // (where the canvas is already mounted but the player hasn't
  // chosen New Game yet) never creates a localStorage save key.
  // Without this guard, the splash autosaves the default-spawn
  // position immediately, which makes the menu show a spurious
  // Continue button before the player has actually played anything.
  //
  // The store still de-dupes near-identical writes and skips updates
  // during a teleport, so localStorage bandwidth stays low. Flush on
  // unmount / page hide too, but only when in-game, so a quick close
  // doesn't lose the last few metres of walking.
  useEffect(() => {
    const flush = () => {
      if (!useMenu.getState().hasStartedGame) return;
      const g = group.current;
      if (!g) return;
      useLevel.getState().savePosition(g.position.x, g.position.z);
    };
    const tick = setInterval(flush, 2000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // Keyboard shortcut: E or Space.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        useEmote.getState().request();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // -- Per-frame movement / animation switching ---------------------------
  const moveVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const upY = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Freeze all movement / input during the cinematic teleport fade.
    // Animation still ticks (mixer is driven by drei) so the character
    // stays in idle pose; we just don't read input or move them. The
    // changeCounter subscription above handles the actual teleport at
    // the 'out' → 'in' boundary while the screen is fully black.
    if (useLevel.getState().transitionPhase !== 'idle') {
      positionRef.current.copy(g.position);
      playerWorldPos.copy(g.position);
      return;
    }

    const state = useInput.getState();

    let dirX = 0;
    let dirZ = 0;
    let mag = 0;

    const stickMag = Math.hypot(state.moveX, state.moveY);
    if (stickMag > 0.05) {
      const c = Math.SQRT1_2;
      dirX = state.moveX * c - state.moveY * c;
      dirZ = -state.moveX * c - state.moveY * c;
      const dm = Math.hypot(dirX, dirZ);
      if (dm > 0) {
        dirX /= dm;
        dirZ /= dm;
      }
      mag = Math.min(1, stickMag);
    } else if (state.destination) {
      const dx = state.destination.x - g.position.x;
      const dz = state.destination.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        state.clearDestination();
      } else {
        dirX = dx / dist;
        dirZ = dz / dist;
        mag = Math.min(1, dist / 2);
      }
    }

    const moving = mag > 0.05;

    // Cancel an emote the moment the player tries to move.
    if (moving && isPlayingExtra.current) {
      activeEmote.current?.fadeOut(CHARACTER.fadeSeconds * 0.5);
      activeEmote.current = null;
      isPlayingExtra.current = false;
    }

    if (moving) {
      const speed = THREE.MathUtils.lerp(CHARACTER.walkSpeed, CHARACTER.runSpeed, mag);
      moveVec.current.set(dirX, 0, dirZ);
      g.position.addScaledVector(moveVec.current, speed * dt * mag);

      const yaw = Math.atan2(dirX, dirZ) + CHARACTER.modelForwardYaw;
      targetQuat.current.setFromAxisAngle(upY.current, yaw);
      g.quaternion.rotateTowards(targetQuat.current, CHARACTER.turnSpeed * dt);
    }

    // Resolve any collision with registered props (huts, rocks, trilos).
    // Mutates g.position in place if the player is overlapping anything.
    collision.resolve(g.position, PLAYER_RADIUS);

    const desired: Role = !moving ? 'idle' : mag > 0.85 ? 'run' : 'walk';
    if (desired !== currentRole.current && !isPlayingExtra.current) {
      const from = clipsByRole.current[currentRole.current];
      const to = clipsByRole.current[desired];
      if (to) {
        from?.fadeOut(CHARACTER.fadeSeconds);
        to.reset().fadeIn(CHARACTER.fadeSeconds).play();
        currentRole.current = desired;
      }
    }

    // Spontaneous emote when standing still long enough.
    if (!moving && currentRole.current === 'idle' && !isPlayingExtra.current) {
      idleSeconds.current += dt;
      if (idleSeconds.current >= nextEmoteAt.current) {
        idleSeconds.current = 0;
        nextEmoteAt.current = rollEmoteDelay();
        playEmote();
      }
    } else if (moving) {
      idleSeconds.current = 0;
    }

    positionRef.current.copy(g.position);
    playerWorldPos.copy(g.position);
  });

  return (
    <group ref={group} dispose={null}>
      <group scale={CHARACTER.scale} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function rollEmoteDelay() {
  const [min, max] = EMOTE_IDLE_RANGE;
  return min + Math.random() * (max - min);
}

useGLTF.preload(PLAYER_MODEL_URL);

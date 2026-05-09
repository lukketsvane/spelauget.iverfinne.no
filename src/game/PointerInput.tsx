'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { playerWorldPos, useInput } from '@/store/input';

const KNOB_RADIUS = 60; // px
const TAP_MAX_MS = 220;
const TAP_MAX_PX = 14;
// Cursor closer than this to the character → stop, so we don't jitter
// while the mouse hovers right on top.
const CURSOR_DEAD_ZONE = 0.4;

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const RAY = new THREE.Raycaster();

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  isDrag: boolean;
};

// Two control schemes share the same overlay:
//
//   Mouse  — hold to walk: while button is held, character moves toward
//   the cursor's projected ground position. Releasing the button stops
//   movement immediately. Direction is recomputed each pointermove so
//   the character chases the cursor.
//
//   Touch  — quick tap walks to the tapped point; tap-and-drag becomes
//   an analog joystick.

export default function PointerInput() {
  const dragRef = useRef<DragState | null>(null);
  const mouseHeld = useRef(false);

  const updateMouseDirection = (clientX: number, clientY: number) => {
    const { camera, canvasEl } = useInput.getState();
    if (!camera || !canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    RAY.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!RAY.ray.intersectPlane(GROUND, hit)) return;

    const dx = hit.x - playerWorldPos.x;
    const dz = hit.z - playerWorldPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < CURSOR_DEAD_ZONE) {
      useInput.getState().setMove(0, 0);
      return;
    }
    const wdx = dx / dist;
    const wdz = dz / dist;
    // Inverse of the iso world→screen-input rotation Character uses.
    const c = Math.SQRT1_2;
    const ux = (wdx - wdz) * c;
    const uy = -(wdx + wdz) * c;
    // Magnitude scales with cursor distance so the character walks when
    // the cursor is close and breaks into a run further out. Character
    // animation switches to "run" at mag > 0.85 — that crosses around
    // dist ≈ 2.7 m here.
    const mag = Math.min(1, 0.5 + (dist - CURSOR_DEAD_ZONE) / 4.0);
    useInput.getState().setMove(ux * mag, uy * mag);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      if (mouseHeld.current) return;
      mouseHeld.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
      useInput.getState().clearDestination();
      updateMouseDirection(e.clientX, e.clientY);
      return;
    }

    if (dragRef.current) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      isDrag: false,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (mouseHeld.current) updateMouseDirection(e.clientX, e.clientY);
      return;
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const dist = Math.hypot(dx, dy);
    if (!d.isDrag && (dist > TAP_MAX_PX || performance.now() - d.startTime > TAP_MAX_MS)) {
      d.isDrag = true;
      useInput.getState().clearDestination();
    }
    if (d.isDrag) {
      let kx = dx;
      let ky = dy;
      const km = Math.hypot(kx, ky);
      if (km > KNOB_RADIUS) {
        kx = (kx / km) * KNOB_RADIUS;
        ky = (ky / km) * KNOB_RADIUS;
      }
      useInput.getState().setMove(kx / KNOB_RADIUS, -ky / KNOB_RADIUS);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (!mouseHeld.current) return;
      mouseHeld.current = false;
      useInput.getState().setMove(0, 0);
      useInput.getState().clearDestination();
      return;
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.isDrag) {
      // Tap → raycast through screen point onto the ground plane.
      const { camera, canvasEl } = useInput.getState();
      if (camera && canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        RAY.setFromCamera(ndc, camera);
        const hit = new THREE.Vector3();
        if (RAY.ray.intersectPlane(GROUND, hit)) {
          useInput.getState().setDestination(hit.x, hit.z);
        }
      }
    } else {
      useInput.getState().setMove(0, 0);
    }
    dragRef.current = null;
  };

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

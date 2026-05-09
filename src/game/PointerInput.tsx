'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useInput } from '@/store/input';

const KNOB_RADIUS = 60; // px
const TAP_MAX_MS = 220;
const TAP_MAX_PX = 14;

// HTML overlay that captures all primary-button pointer events:
//   - Quick tap (short, no drag)  → raycast to ground, set path destination
//   - Hold + drag                 → analog virtual joystick
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  isDrag: boolean;
};

export default function PointerInput() {
  const dragRef = useRef<DragState | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
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
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const dist = Math.hypot(dx, dy);

    // Promote to drag once we move past the tap threshold or hold past
    // the tap window.
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
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(GROUND, hit)) {
          useInput.getState().setDestination(hit.x, hit.z);
        }
      }
    } else {
      useInput.getState().setMove(0, 0);
    }

    dragRef.current = null;
  };

  // Invisible full-screen overlay that captures pointer events. No visual
  // joystick — the drag-to-move feel is intuitive enough on its own, and
  // the empty white scene reads cleaner without UI chrome.
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

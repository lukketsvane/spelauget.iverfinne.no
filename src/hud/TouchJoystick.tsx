'use client';

import { useEffect, useRef, useState } from 'react';
import { useInput } from '@/store/input';

const RADIUS = 60; // px — half the joystick diameter

// Floating touch joystick: appears wherever the user first touches the bottom-half
// of the screen. Drag to steer; release to recenter. Hidden on non-touch devices.
export default function TouchJoystick() {
  const [hasTouch, setHasTouch] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointer = useRef<number | null>(null);

  useEffect(() => {
    setHasTouch(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  }, []);

  if (!hasTouch) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    // Only respond to touches starting in the lower half (left or right side both ok).
    if (e.clientY < window.innerHeight * 0.4) return;
    activePointer.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);
    setOrigin({ x: e.clientX, y: e.clientY });
    setKnob({ x: 0, y: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current || !origin) return;
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    // Convert to input axes: x right, y up (so invert dy).
    useInput.getState().set(dx / RADIUS, -dy / RADIUS);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    useInput.getState().set(0, 0);
  };

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {origin && (
        <>
          <div
            className="absolute rounded-full border-2 border-neutral-400/60 bg-white/30 backdrop-blur-sm"
            style={{
              width: RADIUS * 2,
              height: RADIUS * 2,
              left: origin.x - RADIUS,
              top: origin.y - RADIUS,
            }}
          />
          <div
            className="absolute rounded-full bg-neutral-700/70"
            style={{
              width: RADIUS,
              height: RADIUS,
              left: origin.x - RADIUS / 2 + knob.x,
              top: origin.y - RADIUS / 2 + knob.y,
            }}
          />
        </>
      )}
    </div>
  );
}

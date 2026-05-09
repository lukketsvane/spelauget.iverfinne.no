import { create } from 'zustand';
import type * as THREE from 'three';

type InputState = {
  // Analog stick: x in [-1, 1] right+, y in [-1, 1] up+ (screen-space).
  moveX: number;
  moveY: number;

  // Tap-to-move target in world space (xz). Null when no path active.
  destination: { x: number; z: number } | null;

  // Exposed by an in-canvas helper so the HTML pointer overlay can
  // raycast from screen-space to the ground plane.
  camera: THREE.Camera | null;
  canvasEl: HTMLCanvasElement | null;

  setMove: (x: number, y: number) => void;
  setDestination: (x: number, z: number) => void;
  clearDestination: () => void;
  setCamera: (cam: THREE.Camera | null) => void;
  setCanvasEl: (el: HTMLCanvasElement | null) => void;
};

export const useInput = create<InputState>((set) => ({
  moveX: 0,
  moveY: 0,
  destination: null,
  camera: null,
  canvasEl: null,
  setMove: (moveX, moveY) => set({ moveX, moveY }),
  setDestination: (x, z) => set({ destination: { x, z } }),
  clearDestination: () => set({ destination: null }),
  setCamera: (camera) => set({ camera }),
  setCanvasEl: (canvasEl) => set({ canvasEl }),
}));

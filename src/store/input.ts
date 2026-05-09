import { create } from 'zustand';

type InputState = {
  // Raw analog stick: x in [-1, 1] (right+), y in [-1, 1] (up+ in screen-space, i.e. forward).
  moveX: number;
  moveY: number;
  set: (x: number, y: number) => void;
};

export const useInput = create<InputState>((set) => ({
  moveX: 0,
  moveY: 0,
  set: (x, y) => set({ moveX: x, moveY: y }),
}));

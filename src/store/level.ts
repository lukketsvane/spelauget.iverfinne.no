import { create } from 'zustand';
import { findPlayerSpawn, LEVELS, type LevelId } from '@/game/levels';

type LevelState = {
  currentLevelId: LevelId;
  // Updated whenever the level changes — Character watches this and
  // teleports its group to (x, 0, z).
  playerSpawn: { x: number; z: number };
  // Increments on every level change. Components that need to reset
  // (NPC dialogue state, interaction claims) can subscribe to this.
  changeCounter: number;
  setLevel: (id: LevelId) => void;
};

export const useLevel = create<LevelState>((set) => ({
  currentLevelId: 'level1',
  playerSpawn: findPlayerSpawn(LEVELS.level1),
  changeCounter: 0,
  setLevel: (id) =>
    set((s) => ({
      currentLevelId: id,
      playerSpawn: findPlayerSpawn(LEVELS[id]),
      changeCounter: s.changeCounter + 1,
    })),
}));

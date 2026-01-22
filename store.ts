
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE } from './types';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  gameTime: number; // Time in seconds
  
  // Abilities & Upgrades
  isSlowMotion: boolean; // "Crouch" effect
  damagePerShot: number;
  hasSpreadShot: boolean;
  hasImmortality: boolean; // Keeping shield as requested by user context, though perks changed
  isImmortalityActive: boolean;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  updateTime: (delta: number) => void;
  
  // Shop / Abilities
  buyItem: (type: 'HEAVY_AMMO' | 'SPREAD_SHOT' | 'MAX_LIFE' | 'HEAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
  triggerSlowMotion: () => void;
}

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const MAX_LEVEL = 50;

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  gameTime: 0,
  
  // New Shooter/Flyer Props
  isSlowMotion: false,
  damagePerShot: 1,
  hasSpreadShot: false,
  hasImmortality: false,
  isImmortalityActive: false,

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    gameTime: 0,
    isSlowMotion: false,
    damagePerShot: 1,
    hasSpreadShot: false,
    hasImmortality: false,
    isImmortalityActive: false
  }),

  restartGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    gameTime: 0,
    isSlowMotion: false,
    damagePerShot: 1,
    hasSpreadShot: false,
    hasImmortality: false,
    isImmortalityActive: false
  }),

  takeDamage: () => {
    const { lives, isImmortalityActive } = get();
    if (isImmortalityActive) return; // No damage if skill is active

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
    }
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  
  collectGem: (value) => set((state) => ({ 
    score: state.score + value, 
    gemsCollected: state.gemsCollected + 1 
  })),

  setDistance: (dist) => set({ distance: dist }),
  
  updateTime: (delta) => set((state) => ({ gameTime: state.gameTime + delta })),

  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      
      // Minor speed increase for collecting letters (1%)
      const speedIncrease = speed * 0.01;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      // Check if full word collected
      if (newLetters.length === GEMINI_TARGET.length) {
        if (level < MAX_LEVEL) {
            get().advanceLevel();
        } else {
            set({
                status: GameStatus.VICTORY,
                score: get().score + 50000
            });
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, speed } = get();
      const nextLevel = level + 1;
      
      // Increase speed by 5% per level
      const newSpeed = speed * 1.05;

      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9), 
          status: GameStatus.PLAYING, 
          speed: newSpeed,
          collectedLetters: [] 
      });
  },

  openShop: () => set({ status: GameStatus.SHOP }),
  
  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
      const { score, maxLives, lives, damagePerShot } = get();
      
      if (score >= cost) {
          set({ score: score - cost });
          
          switch (type) {
              case 'HEAVY_AMMO':
                  set({ damagePerShot: damagePerShot + 1 });
                  break;
              case 'SPREAD_SHOT':
                  set({ hasSpreadShot: true });
                  break;
              case 'MAX_LIFE':
                  set({ maxLives: maxLives + 1, lives: lives + 1 });
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
          }
          return true;
      }
      return false;
  },

  triggerSlowMotion: () => {
      const { isSlowMotion } = get();
      if (!isSlowMotion) {
          set({ isSlowMotion: true });
          // Lasts 5 seconds
          setTimeout(() => {
              set({ isSlowMotion: false });
          }, 5000);
      }
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  setStatus: (status) => set({ status }),
}));

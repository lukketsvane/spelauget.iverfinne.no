/**
 * voice-player.js — vanilla JS, no dependencies.
 * Same idea as useCharacterVoice.tsx but plain Web Audio.
 *
 *   import { CharacterVoicePlayer } from './voice-player.js';
 *   const vp = new CharacterVoicePlayer('/audio/voices', {
 *     cleaner: { pool: 'pixel_lowest', pitchRange: [0.95, 1.05], volume: 0.55 },
 *   });
 *   await vp.load();
 *   document.addEventListener('click', () => vp.resume()); // unlock audio
 *   vp.speak('cleaner');
 */
export class CharacterVoicePlayer {
  constructor(basePath, profiles, { maxClipsPerPool = 30 } = {}) {
    this.basePath = basePath;
    this.profiles = profiles;
    this.maxClipsPerPool = maxClipsPerPool;
    this.ctx = null;
    this.pools = {};
    this.lastPlayedAt = {};
  }

  async load() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const poolNames = new Set(Object.values(this.profiles).map(p => p.pool));
    await Promise.all([...poolNames].map(async (pool) => {
      const buffers = [];
      for (let i = 1; i <= this.maxClipsPerPool; i++) {
        const url = `${this.basePath}/${pool}/talk_${String(i).padStart(2, '0')}.ogg`;
        try {
          const r = await fetch(url);
          if (!r.ok) break;
          const ab = await r.arrayBuffer();
          buffers.push(await this.ctx.decodeAudioData(ab));
        } catch { break; }
      }
      this.pools[pool] = buffers;
    }));
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  speak(characterId) {
    const profile = this.profiles[characterId];
    if (!profile || !this.ctx) return;
    const cooldown = profile.cooldownMs ?? 120;
    const now = performance.now();
    if (now - (this.lastPlayedAt[characterId] ?? 0) < cooldown) return;
    this.lastPlayedAt[characterId] = now;

    const pool = this.pools[profile.pool];
    if (!pool?.length) return;
    const buf = pool[Math.floor(Math.random() * pool.length)];

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const [pmin, pmax] = profile.pitchRange ?? [0.95, 1.05];
    src.playbackRate.value = pmin + Math.random() * (pmax - pmin);

    const gain = this.ctx.createGain();
    gain.gain.value = profile.volume ?? 0.5;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }
}

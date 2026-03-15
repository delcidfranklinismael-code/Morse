/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class MorseAudioService {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async start() {
    this.init();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.oscillator = this.audioCtx.createOscillator();
    this.gainNode = this.audioCtx.createGain();

    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(600, this.audioCtx.currentTime);
    
    this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.01);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);

    this.oscillator.start();
  }

  stop() {
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.01);
      setTimeout(() => {
        if (this.oscillator) {
          this.oscillator.stop();
          this.oscillator.disconnect();
        }
        if (this.gainNode) {
          this.gainNode.disconnect();
        }
      }, 20);
    }
  }
}

class MusicService {
  private currentAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private currentTrack: string | null = null;

  play(url: string, loop: boolean = true) {
    if (this.currentTrack === url) return;
    
    this.stop();
    
    this.currentTrack = url;
    this.currentAudio = new Audio(url);
    this.currentAudio.loop = loop;
    this.currentAudio.volume = 0.3;
    this.currentAudio.muted = this.isMuted;
    
    this.currentAudio.play().catch(e => console.log("Audio play blocked by browser policy", e));
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.currentTrack = null;
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.currentAudio) {
      this.currentAudio.muted = muted;
    }
  }
}

export const morseAudio = new MorseAudioService();
export const musicService = new MusicService();

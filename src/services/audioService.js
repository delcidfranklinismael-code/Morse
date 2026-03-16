/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class MorseAudioService {
  audioCtx = null;
  gainNode = null;
  oscillator = null;

  init() {
    if (this.audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.value = 0;
      }
    } catch (e) {
      console.error("Failed to initialize AudioContext:", e);
    }
  }

  async start() {
    this.init();
    if (!this.audioCtx || !this.gainNode) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // If an oscillator is already running, don't create another one
      if (this.oscillator) return;

      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(600, this.audioCtx.currentTime);
      this.oscillator.connect(this.gainNode);
      
      // Use a small ramp to avoid clicks
      this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.01);

      this.oscillator.start();
    } catch (e) {
      console.error("Error starting morse sound:", e);
    }
  }

  stop() {
    if (!this.audioCtx || !this.oscillator || !this.gainNode) return;

    try {
      this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.01);

      const osc = this.oscillator;
      this.oscillator = null;

      // Stop the oscillator after the ramp completes
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
      }, 50);
    } catch (e) {
      console.error("Error stopping morse sound:", e);
    }
  }
}

class MusicService {
  audio = null;
  isMuted = false;
  currentTrack = null;
  playTimeout = null;

  init() {
    if (this.audio) return;
    try {
      this.audio = new Audio();
      this.audio.volume = 0.2;
    } catch (e) {
      console.error("Failed to create Audio element:", e);
    }
  }

  play(url, loop = true) {
    if (this.currentTrack === url) return;
    
    this.init();
    if (!this.audio) return;

    try {
      this.currentTrack = url;
      this.audio.pause();
      
      if (this.playTimeout) clearTimeout(this.playTimeout);
      
      this.playTimeout = setTimeout(() => {
        try {
          if (this.currentTrack !== url) return;
          
          this.audio.removeAttribute('src');
          this.audio.load();
          
          this.audio.src = url;
          this.audio.loop = loop;
          this.audio.muted = this.isMuted;
          
          const playPromise = this.audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn("Music play prevented:", error);
            });
          }
        } catch (e) {
          console.error("Error in music play timeout:", e);
        }
      }, 150); // Small delay to prevent spamming during navigation
    } catch (e) {
      console.error("Error playing music:", e);
    }
  }

  stop() {
    if (this.playTimeout) clearTimeout(this.playTimeout);
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch (e) {
        console.error("Error stopping music:", e);
      }
      this.currentTrack = null;
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.audio) {
      this.audio.muted = muted;
    }
  }
}

export const morseAudio = new MorseAudioService();
export const musicService = new MusicService();

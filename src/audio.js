export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.running = false;
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.brakeOsc = null;
    this.brakeGain = null;
    this.nextBeepAt = 0;

    // Car Radio MP3 player
    this.radioAudio = new Audio();
    this.radioAudio.loop = true;
    this.radioAudio.volume = 0.48;
    this.radioLoaded = false;
    this.radioEnabled = true;
    this.radioTrackName = '';
    this.radioObjectUrl = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Engine hum (sawtooth + triangle filtered)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 26;

    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 220;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(engineFilter);
    this.engineSubOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
    this.engineSubOsc.start();

    // Brake groan/squeal oscillator
    this.brakeOsc = this.ctx.createOscillator();
    this.brakeOsc.type = 'triangle';
    this.brakeOsc.frequency.value = 180;

    const brakeFilter = this.ctx.createBiquadFilter();
    brakeFilter.type = 'bandpass';
    brakeFilter.frequency.value = 460;
    brakeFilter.Q.value = 2.5;

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0;

    this.brakeOsc.connect(brakeFilter);
    brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.ctx.destination);
    this.brakeOsc.start();

    this.running = true;
  }

  setMuted(muted) {
    this.muted = muted;
    this.radioAudio.muted = muted;
    if (muted && this.ctx) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      if (this.brakeGain) this.brakeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }

  async checkDefaultRadio(urls = ['radio.mp3', 'audio/radio.mp3']) {
    const candidates = Array.isArray(urls) ? urls : [urls];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          this.setRadioSource(url, 'radio.mp3');
          return true;
        }
      } catch {
        // Try next candidate
      }
    }
    return false;
  }

  loadRadioFile(file) {
    if (!file) return false;
    if (this.radioObjectUrl) {
      URL.revokeObjectURL(this.radioObjectUrl);
    }
    this.radioObjectUrl = URL.createObjectURL(file);
    this.setRadioSource(this.radioObjectUrl, file.name);
    this.radioEnabled = true;
    return true;
  }

  setRadioSource(src, trackName) {
    this.radioAudio.src = src;
    this.radioAudio.load();
    this.radioLoaded = true;
    this.radioTrackName = trackName;
  }

  startRadio() {
    if (!this.radioLoaded || !this.radioEnabled) return;
    this.radioAudio.muted = this.muted;
    this.radioAudio.play().catch(() => {});
  }

  pauseRadio() {
    this.radioAudio.pause();
  }

  toggleRadio() {
    if (!this.radioLoaded) return false;
    this.radioEnabled = !this.radioEnabled;
    if (this.radioEnabled) {
      this.startRadio();
    } else {
      this.pauseRadio();
    }
    return this.radioEnabled;
  }

  update(speedMs, throttle, brakeDemand, brakeActual, brakeEfficiency, inCarpark) {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      this.brakeGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const absSpeed = Math.abs(speedMs);
    const rpmFactor = Math.min(1.6, absSpeed / 24);
    const baseFreq = 46 + rpmFactor * 82 + throttle * 18;

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);

    const engVol = 0.03 + Math.min(0.055, absSpeed * 0.0018) + throttle * 0.025 + (inCarpark ? 0.015 : 0);
    this.engineGain.gain.setTargetAtTime(engVol, now, 0.08);

    // Stiff brake groan/squeal when braking while moving
    const stiffness = 1 - brakeEfficiency; // 0 = fresh, ~0.75 = very stiff
    if (brakeDemand > 0.1 && absSpeed > 0.6) {
      const freq = 140 + stiffness * 420 + (absSpeed / 30) * 140;
      const vol = (0.006 + stiffness * 0.048) * Math.min(1, brakeDemand * 0.7 + brakeActual * 0.5);
      this.brakeOsc.frequency.setTargetAtTime(freq, now, 0.05);
      this.brakeGain.gain.setTargetAtTime(vol, now, 0.04);
    } else {
      this.brakeGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  stopContinuous() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.brakeGain) this.brakeGain.gain.setTargetAtTime(0, now, 0.05);
  }

  playBeep(freq = 880, duration = 0.08, volume = 0.08, type = 'sine') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playCollision(severity = 0.5) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    gain.gain.setValueAtTime(Math.min(0.24, 0.08 + severity * 0.16), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playWarningChime() {
    this.playBeep(620, 0.11, 0.09, 'triangle');
    setTimeout(() => this.playBeep(480, 0.16, 0.09, 'triangle'), 120);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playBeep(n, 0.22, 0.1, 'sine'), idx * 110);
    });
  }

  updateParkingSensor(proximityRatio, timeSec) {
    // proximityRatio: 0 (far) -> 1 (inside bay)
    if (this.muted || !this.ctx || proximityRatio <= 0.1) return;
    const interval = proximityRatio > 0.85 ? 0.12 : (0.7 - proximityRatio * 0.55);
    if (timeSec >= this.nextBeepAt) {
      const freq = proximityRatio > 0.85 ? 1180 : 920;
      this.playBeep(freq, 0.06, 0.06, 'sine');
      this.nextBeepAt = timeSec + interval;
    }
  }
}

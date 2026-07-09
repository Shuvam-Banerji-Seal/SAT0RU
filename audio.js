// ============================================================================
// SAT0RU - Audio module
// ----------------------------------------------------------------------------
// Two independent audio channels:
//   * BGM  — looping background music (HTMLAudioElement)
//   * SFX  — procedural cast sounds + TTS (Web Audio API)
//
// Both are gated behind their own toggles. The SOUND button opens a popup
// that controls each channel independently.
// ============================================================================

const BGM_URL = 'https://opengameart.org/sites/default/files/determination.mp3';

let ctx = null;
let master = null;
let sfxEnabled = false;
let bgmEnabled = false;
let bgmElement = null;
let bgmGain = null; // GainNode for smooth fade (connected to ctx.destination)

// --- Web Audio (SFX) -----------------------------------------------

function initAudioContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    // BGM gain node (separate from SFX master)
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0;
    bgmGain.connect(ctx.destination);
}

export function setSfxEnabled(value) {
    sfxEnabled = value;
    if (sfxEnabled) {
        initAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }
}

export function isSfxEnabled() {
    return sfxEnabled;
}

// --- Background Music -----------------------------------------------

export function setBgmEnabled(value) {
    bgmEnabled = value;
    if (bgmEnabled) {
        initAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        startBgm();
    } else {
        fadeBgm(0);
    }
}

export function isBgmEnabled() {
    return bgmEnabled;
}

function startBgm() {
    if (!bgmElement) {
        bgmElement = new Audio(BGM_URL);
        bgmElement.crossOrigin = 'anonymous';
        bgmElement.loop = true;
        bgmElement.preload = 'auto';
    }
    if (ctx && bgmGain) {
        // Route through Web Audio for smooth fade.
        // If the audio element is already playing, just fade in.
        if (!bgmElement._connected && bgmElement.readyState >= 2) {
            try {
                const src = ctx.createMediaElementSource(bgmElement);
                src.connect(bgmGain);
                bgmElement._connected = true;
            } catch (e) { /* already connected */ }
        }
        bgmElement.play().catch(() => {});
        fadeBgm(0.3);
    } else {
        // Fallback: use element volume directly (no Web Audio).
        bgmElement.volume = 0.3;
        bgmElement.play().catch(() => {});
    }
}

function fadeBgm(target) {
    if (!bgmElement) return;
    if (ctx && bgmGain) {
        const now = ctx.currentTime;
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
        bgmGain.gain.linearRampToValueAtTime(target, now + 0.8);
        if (target === 0) {
            bgmElement.pause();
        }
    } else {
        bgmElement.volume = target;
        if (target === 0) bgmElement.pause();
    }
}

// --- TTS (spoken incantations) --------------------------------------

export function speak(text) {
    if (!sfxEnabled || !('speechSynthesis' in window) || !text) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        u.pitch = 1.0;
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
    } catch (e) { /* speech unsupported */ }
}

// --- SFX primitives -------------------------------------------------

function tone({ freq = 220, type = 'sine', dur = 0.4, gain = 0.3, sweepTo = null, delay = 0 }) {
    if (!sfxEnabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

function layer({ freq = 220, types = ['sine', 'triangle'], detune = 5, dur = 0.5, gain = 0.2, sweepTo = null, delay = 0 }) {
    if (!sfxEnabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    for (let i = 0; i < types.length; i++) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = types[i];
        osc.detune.value = (i - (types.length - 1) / 2) * detune;
        osc.frequency.setValueAtTime(freq, t0);
        if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain / types.length, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }
}

function noiseBurst({ dur = 0.3, gain = 0.3, delay = 0, lowpass = 800, highpass = 0 }) {
    if (!sfxEnabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    src.connect(lp);
    if (highpass > 0) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = highpass;
        lp.connect(hp);
        hp.connect(g);
    } else {
        lp.connect(g);
    }
    g.connect(master);
    src.start(t0);
}

function subBass({ freq = 50, dur = 0.3, gain = 0.35, delay = 0 }) {
    if (!sfxEnabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(20, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

function chargeWhine({ startFreq = 200, endFreq = 2000, dur = 0.8, gain = 0.15, delay = 0 }) {
    if (!sfxEnabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
    g.gain.linearRampToValueAtTime(gain * 1.5, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

// --- Cast sounds per technique --------------------------------------

export function playCast(tech) {
    if (!sfxEnabled || !ctx) return;
    switch (tech) {
        case 'kamehameha':
            chargeWhine({ startFreq: 150, endFreq: 1800, dur: 1.2, gain: 0.18 });
            layer({ freq: 180, types: ['sawtooth', 'square'], detune: 8, dur: 1.4, gain: 0.15, sweepTo: 600, delay: 0.3 });
            noiseBurst({ dur: 1.2, gain: 0.12, lowpass: 2000, delay: 0.5 });
            subBass({ freq: 60, dur: 0.6, gain: 0.25, delay: 0.8 });
            break;
        case 'blackflash':
            layer({ freq: 1200, types: ['square', 'sawtooth'], detune: 12, dur: 0.08, gain: 0.35, sweepTo: 150 });
            noiseBurst({ dur: 0.12, gain: 0.4, lowpass: 4000 });
            subBass({ freq: 80, dur: 0.2, gain: 0.3 });
            break;
        case 'fusion':
            layer({ freq: 330, types: ['triangle', 'sine'], detune: 6, dur: 0.8, gain: 0.2 });
            layer({ freq: 494, types: ['triangle', 'sine'], detune: 4, dur: 0.7, gain: 0.15, delay: 0.1 });
            layer({ freq: 660, types: ['sine'], detune: 0, dur: 0.5, gain: 0.1, delay: 0.2 });
            noiseBurst({ dur: 0.3, gain: 0.08, lowpass: 1200, delay: 0.15 });
            break;
        case 'purple':
            layer({ freq: 60, types: ['sawtooth', 'square'], detune: 10, dur: 1.0, gain: 0.2, sweepTo: 500 });
            chargeWhine({ startFreq: 100, endFreq: 800, dur: 0.6, gain: 0.12, delay: 0.1 });
            noiseBurst({ dur: 0.6, gain: 0.18, lowpass: 3000, delay: 0.2 });
            subBass({ freq: 40, dur: 0.4, gain: 0.3, delay: 0.1 });
            break;
        case 'shrine':
            layer({ freq: 55, types: ['sawtooth', 'square'], detune: 8, dur: 1.2, gain: 0.2, sweepTo: 45 });
            tone({ freq: 110, type: 'sine', dur: 1.0, gain: 0.1, sweepTo: 55, delay: 0.1 });
            noiseBurst({ dur: 0.8, gain: 0.1, lowpass: 600 });
            break;
        case 'void':
            chargeWhine({ startFreq: 300, endFreq: 2400, dur: 1.0, gain: 0.12 });
            layer({ freq: 220, types: ['sine', 'triangle'], detune: 3, dur: 1.2, gain: 0.15, sweepTo: 1600 });
            noiseBurst({ dur: 0.5, gain: 0.08, lowpass: 2000, delay: 0.3 });
            break;
        case 'red':
            layer({ freq: 250, types: ['sawtooth', 'triangle'], detune: 6, dur: 0.5, gain: 0.25, sweepTo: 50 });
            noiseBurst({ dur: 0.2, gain: 0.2, lowpass: 2500 });
            subBass({ freq: 70, dur: 0.3, gain: 0.2 });
            break;
        case 'blue':
            layer({ freq: 500, types: ['sine', 'triangle'], detune: 4, dur: 0.7, gain: 0.2, sweepTo: 60 });
            chargeWhine({ startFreq: 600, endFreq: 100, dur: 0.5, gain: 0.1, delay: 0.1 });
            noiseBurst({ dur: 0.3, gain: 0.1, lowpass: 1500, delay: 0.15 });
            break;
        case 'cursed_speech':
            layer({ freq: 350, types: ['sine', 'triangle'], detune: 2, dur: 0.5, gain: 0.18, sweepTo: 250 });
            tone({ freq: 180, type: 'sine', dur: 0.3, gain: 0.1, delay: 0.05 });
            noiseBurst({ dur: 0.15, gain: 0.06, lowpass: 1000 });
            break;
        default:
            tone({ freq: 200, type: 'sine', dur: 0.4, gain: 0.2 });
    }
}

// ============================================================================
// SAT0RU - Audio module
// ----------------------------------------------------------------------------
// Two independent audio channels:
//   * BGM  — procedural background music (Web Audio oscillators + noise)
//   * SFX  — procedural cast sounds + TTS (Web Audio API)
//
// Both are gated behind their own toggles. The SOUND button opens a popup
// that controls each channel independently.
// ============================================================================

let ctx = null;
let master = null;
let sfxEnabled = false;
let bgmEnabled = false;
let bgmNodes = []; // active BGM oscillators/noise sources
let bgmInterval = null;

// --- Web Audio context ----------------------------------------------

function initAudioContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
}

function ensureCtx() {
    if (!ctx) initAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
}

// --- SFX channel ----------------------------------------------------

export function setSfxEnabled(value) {
    sfxEnabled = value;
    if (sfxEnabled) ensureCtx();
}

export function isSfxEnabled() {
    return sfxEnabled;
}

// --- BGM channel (procedural) --------------------------------------

export function setBgmEnabled(value) {
    bgmEnabled = value;
    if (bgmEnabled) {
        ensureCtx();
        startBgm();
    } else {
        stopBgm();
    }
}

export function isBgmEnabled() {
    return bgmEnabled;
}

// Energetic procedural background music loop.
// Layers: bass drone + rhythmic pulse + hi-hat noise + arpeggio melody.
function startBgm() {
    if (!ctx) return;
    stopBgm(); // clear any existing

    const now = ctx.currentTime;

    // Master BGM gain (for fade).
    const bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0, now);
    bgmGain.gain.linearRampToValueAtTime(0.35, now + 1.5);
    bgmGain.connect(ctx.destination);

    // --- Layer 1: Bass drone (deep sine) ---
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 55; // A1
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.25;
    bass.connect(bassGain);
    bassGain.connect(bgmGain);
    bass.start(now);
    bgmNodes.push(bass, bassGain);

    // --- Layer 2: Rhythmic pulse (square wave, 130 BPM) ---
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = 110;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.08;
    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = 'sine';
    pulseLfo.frequency.value = 130 / 60; // 130 BPM = 2.167 Hz
    const pulseLfoGain = ctx.createGain();
    pulseLfoGain.gain.value = 0.08;
    pulseLfo.connect(pulseLfoGain);
    pulseLfoGain.connect(pulseGain.gain);
    pulse.connect(pulseGain);
    pulseGain.connect(bgmGain);
    pulse.start(now);
    pulseLfo.start(now);
    bgmNodes.push(pulse, pulseGain, pulseLfo, pulseLfoGain);

    // --- Layer 3: Hi-hat noise (filtered noise, rhythmic) ---
    const noiseLen = ctx.sampleRate * 4; // 4 seconds of noise
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.value = 7000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    const noiseLfo = ctx.createOscillator();
    noiseLfo.type = 'square';
    noiseLfo.frequency.value = 130 / 60 * 2; // 8th notes at 130 BPM
    const noiseLfoGain = ctx.createGain();
    noiseLfoGain.gain.value = 0.04;
    noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(noiseGain.gain);
    noiseSrc.connect(noiseHP);
    noiseHP.connect(noiseGain);
    noiseGain.connect(bgmGain);
    noiseSrc.start(now);
    noiseLfo.start(now);
    bgmNodes.push(noiseSrc, noiseHP, noiseGain, noiseLfo, noiseLfoGain);

    // --- Layer 4: Arpeggio melody (sawtooth, cycling notes) ---
    const arpNotes = [220, 277.18, 329.63, 440, 329.63, 277.18]; // Am arpeggio
    let arpIndex = 0;
    const arpGain = ctx.createGain();
    arpGain.gain.value = 0.06;
    const arpFilter = ctx.createBiquadFilter();
    arpFilter.type = 'lowpass';
    arpFilter.frequency.value = 2000;
    arpGain.connect(arpFilter);
    arpFilter.connect(bgmGain);

    function playArpNote() {
        if (!bgmEnabled || !ctx) return;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = arpNotes[arpIndex % arpNotes.length];
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, ctx.currentTime);
        env.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(env);
        env.connect(arpGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        arpIndex++;
    }

    // Play arpeggio notes on a timer (16th notes at 130 BPM ≈ 115ms).
    bgmInterval = setInterval(playArpNote, 115);
    playArpNote(); // start immediately
}

function stopBgm() {
    // Fade out then disconnect.
    if (ctx && bgmNodes.length) {
        const now = ctx.currentTime;
        for (const node of bgmNodes) {
            try {
                if (node.stop) node.stop(now + 0.5);
                if (node.disconnect) {
                    setTimeout(() => { try { node.disconnect(); } catch(e) {} }, 600);
                }
            } catch (e) { /* already stopped */ }
        }
    }
    bgmNodes = [];
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
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

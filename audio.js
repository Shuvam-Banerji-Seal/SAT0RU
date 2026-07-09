// ============================================================================
// SAT0RU - Audio module
// ----------------------------------------------------------------------------
// Procedural sound effects (Web Audio API) + spoken technique names
// (Web Speech API). All sound is generated locally -- no external assets --
// and is gated behind an enable toggle so the experience is silent by default.
// ============================================================================

let ctx = null;
let master = null;
let enabled = false;

export function initAudio() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
}

export function setAudioEnabled(value) {
    enabled = value;
    if (enabled) {
        initAudio();
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }
}

export function isAudioEnabled() {
    return enabled;
}

// Speak a phrase aloud (used for technique incantations).
export function speak(text) {
    if (!enabled || !('speechSynthesis' in window) || !text) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        u.pitch = 1.0;
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
    } catch (e) { /* speech unsupported */ }
}

function tone({ freq = 220, type = 'sine', dur = 0.4, gain = 0.3, sweepTo = null, delay = 0 }) {
    if (!enabled || !ctx) return;
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

function noiseBurst({ dur = 0.3, gain = 0.3, delay = 0 }) {
    if (!enabled || !ctx) return;
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
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 800;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
}

// Play a cast sound tailored to each technique.
export function playCast(tech) {
    if (!enabled || !ctx) return;
    switch (tech) {
        case 'kamehameha':
            tone({ freq: 120, type: 'sawtooth', dur: 1.2, gain: 0.25, sweepTo: 900 });
            noiseBurst({ dur: 1.0, gain: 0.15 });
            break;
        case 'blackflash':
            tone({ freq: 900, type: 'square', dur: 0.12, gain: 0.3, sweepTo: 200 });
            noiseBurst({ dur: 0.15, gain: 0.3 });
            break;
        case 'fusion':
            tone({ freq: 330, type: 'triangle', dur: 0.6, gain: 0.25 });
            tone({ freq: 494, type: 'triangle', dur: 0.6, gain: 0.2, delay: 0.05 });
            break;
        case 'purple':
            tone({ freq: 80, type: 'sawtooth', dur: 0.8, gain: 0.3, sweepTo: 600 });
            noiseBurst({ dur: 0.5, gain: 0.2 });
            break;
        case 'shrine':
            tone({ freq: 60, type: 'sawtooth', dur: 1.0, gain: 0.3 });
            break;
        case 'void':
            tone({ freq: 200, type: 'sine', dur: 1.0, gain: 0.2, sweepTo: 1200 });
            break;
        case 'red':
            tone({ freq: 200, type: 'sawtooth', dur: 0.5, gain: 0.3, sweepTo: 60 });
            break;
        case 'blue':
            tone({ freq: 400, type: 'sine', dur: 0.6, gain: 0.25, sweepTo: 80 });
            break;
        case 'cursed_speech':
            tone({ freq: 300, type: 'sine', dur: 0.4, gain: 0.2 });
            break;
        default:
            tone({ freq: 200, type: 'sine', dur: 0.4, gain: 0.2 });
    }
}

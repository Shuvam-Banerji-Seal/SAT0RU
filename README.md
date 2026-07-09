# SAT0RU — Cursed Technique Visualizer

SAT0RU is an interactive, webcam-driven **cursed technique visualizer** inspired by *Jujutsu Kaisen* (呪術廻戦). It reads your hand (and face) gestures through the camera and renders voluminous, bloom-lit particle techniques in real time with **three.js**.

> Raise your hands, form the signs, and watch cursed energy erupt on screen.

---

## Features

- **10 techniques** — 6 single-hand, 2 two-hand composite, 1 face-triggered, plus neutral state.
- **Round glowing particles** — custom GLSL point shader renders every particle as a soft sphere with per-particle size and circular alpha.
- **Two-hand interaction** — hand distance drives bloom, camera zoom, and screen shake. Extra effects when two hands are detected during Infinite Void.
- **Face detection** — optional MediaPipe FaceLandmarker detects open mouth for Cursed Speech.
- **Procedural audio** — synthesized cast sounds + Web Speech incantations per technique. Independent toggles for BGM and SFX in an on-screen popup.
- **Background music** — procedural ambient loop generated in real time (bass drone, 130 BPM pulse, hi-hat, arpeggio). No external audio files.
- **Smooth animations** — framerate-independent easing, per-technique rotation, shockwave rings, and screen effects.

---

## Techniques & Gestures

### Single Hand
| Technique | Japanese | Gesture | Visual | Notes |
|-----------|----------|---------|--------|-------|
| Cursed Technique Reversal: **Red** | 赫 | Index finger pointing up | Red spiral arms with bright white-hot core; rotates on Z-axis | Explosive repulsion feel |
| Cursed Technique: **Blue** | 蒼 | "Gun" — thumb + index extended, others curled | Blue imploding swirl with tight inner core; rotates on Y+Z axes | Attraction/gravity visual |
| Domain Expansion: **Infinite Void** | 無量空処 | Index + middle crossed (peace-sign) | White event-horizon ring with deep blue cosmos background; slow Y rotation | Two hands triggers domain pulse rings every 0.9s + +1.2 bloom boost |
| Secret Technique: **Hollow Purple** | 虚式「茈」 | Pinch — thumb + index touching | Chaotic purple-white singularity with scattered outliers; fast Z+Y rotation | Most bloom (4.0) |
| Domain Expansion: **Malevolent Shrine** | 伏魔御廚子 | Open hand / all fingers up | Dark ominous aura with bone pillars and skull dome; rotation locked (no spin) | Grounded, static feel |
| **Black Flash** | 黒閃 | Closed fist | White-purple core → vivid purple ring → dark purple-black aura; violent Z rotation | Three-layer design |

### Two Hands (Composite)
| Technique | Japanese | Gesture | Visual | Notes |
|-----------|----------|---------|--------|-------|
| **Kamehameha** | 波 | Both palms pressed together (prayer position) — wrists + fingertips close | Spiraling blue-white beam shooting toward camera; Z+Y rotation | Detected by proximity only (no finger-up check needed) |
| **Fusion / Convergence** | 合 | Both fists (or both pinches) brought close together | Converging golden double spirals merging into one; fast Z rotation | Both hands must be near each other |

### Two-Hand Distance Effects (All Techniques)
With **two hands** on screen, the separation between them drives real-time effects:

| Distance | Effect |
|----------|--------|
| Hands close together | Normal bloom, normal camera position |
| Hands far apart | +1.5 bloom boost, camera pushes in by 12 units, +0.5 screen shake |

During **Infinite Void**, an extra +1.2 bloom is added when two hands are present, the rotation speed triples (0.02→0.06), and a domain pulse ring fires every 0.9s.

### Face
| Technique | Japanese | Trigger | Visual |
|-----------|----------|---------|--------|
| **Cursed Speech** | 呪言 | Open mouth (FaceLandmarker, lip gap > 0.05) | Concentric violet rings radiating outward; medium Y rotation |

---

## Audio Controls

Click **SOUND** (bottom-right) to open the popup with two independent toggles:

| Toggle | Controls |
|--------|----------|
| **BGM** | Procedural ambient background music (bass drone + 130 BPM pulse + filtered hi-hat + Am arpeggio) |
| **SFX** | Cast sounds (synthesized per technique) + TTS incantations spoken aloud |

Sound starts **off by default**. First click on the button opens the popup without activating anything. Click the individual toggle switches to enable each channel.

---

## Architecture

```
webcam ──► MediaPipe tasks-vision (HandLandmarker + optional FaceLandmarker)
               │  classify poses → technique + glow + metrics
               ▼
            cv.js  ──(onTechnique / onMetrics)──►  index.html (three.js scene)
               │                                        │
               └── audio.js ◄── playCast() / speak() ───┘
```

- **`cv.js`** — all MediaPipe inference on one `@mediapipe/tasks-vision` bundle (shared wasm fileset, no collision). `HandLandmarker` classifies each hand; `FaceLandmarker` (optional) detects mouth-open. Returns `onTechnique(tech, glow)` on changes and `onMetrics({hands, distance})` every frame.
- **`index.html`** — the three.js renderer. Per-technique particle generators, custom sphere-shader bloom, shockwave ring, camera dolly, screen shake.
- **`audio.js`** — procedural cast audio + SpeechSynthesis TTS + procedural ambient BGM. All generated locally, zero external files.

---

## Getting Started

### Prerequisites
- A modern browser (Chrome, Edge, or Firefox).
- A webcam.
- (Optional) A microphone is **not** required — speech is *output* only.

### Run
1. Clone this repository:
   ```bash
   git clone https://github.com/Shuvam-Banerji-Seal/SAT0RU.git
   cd SAT0RU
   ```
2. Serve the folder over HTTP (webcam + ES modules require it):
   ```bash
   ./start.sh           # defaults to port 8000
   # or
   ./start.sh 8080      # custom port
   ```
   Or manually:
   ```bash
   python3 -m http.server 8000
   ```
3. Open **http://localhost:8000** in your browser.
4. Allow camera access and start forming signs.
5. Click **SOUND** → enable **BGM** and/or **SFX** via the toggle switches.

---

## Roadmap
- More two-hand integration signs (circular binding seals, domain amp).
- True 3D instanced-sphere particle alternative.
- Tunable gesture sensitivity / calibration UI.
- Additional face expressions (eyes closed, smile).
- Configurable key bindings for accessibility.

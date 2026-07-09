# SAT0RU — Cursed Technique Visualizer

SAT0RU is an interactive, webcam-driven **cursed technique visualizer** inspired by *Jujutsu Kaisen* (呪術廻戦). It reads your hand (and face) gestures through the camera and renders voluminous, bloom-lit particle techniques in real time with **three.js**.

> Raise your hands, form the signs, and watch cursed energy erupt on screen.

---

## What's New in This Build

This iteration expands the original visualizer into a richer, multi-modal experience:

- **Sphere particles** — particles are now rendered as soft, round glowing orbs (custom GLSL point shader with per-particle size + circular alpha) instead of flat squares.
- **Two new single-hand techniques** — **Blue (蒼)** and **Black Flash (黒閃)**, each with its own gesture, color palette, bloom profile, and motion.
- **Two-hand composite techniques** — when **two hands** are visible the system detects combined poses:
  - **Kamehameha (波)** — both palms open and brought together.
  - **Fusion / Convergence (合)** — both fists (or both pinches) brought together.
  - **Distance-driven "screen" effects** — the separation between your two hands modulates bloom intensity, camera push-in, and screen shake in real time (hands apart = bigger, more violent effect).
- **Face-driven technique** — **MediaPipe tasks-vision FaceLandmarker** detects an open mouth and triggers **Cursed Speech (呪言)**, a radiating violet incantation. It shares the same wasm fileset as the hand model, so there is no global collision and face failures can never break hand tracking.
- **Procedural audio + spoken incantations** — a local **Web Audio** engine synthesizes a cast sound per technique, and the **Web Speech API** speaks the technique name aloud. Sound is **off by default** and toggled with an on-screen button.
- **Richer UI** — Japanese technique glyphs, color-synced titles, descriptive subtitles, custom fonts, a vignette, and a shockwave ring on every activation.
- **Smoother animation** — framerate-independent easing and per-technique rotation/spin behavior.

---

## Techniques & Gestures

### Single Hand
| Technique | Japanese | Gesture |
|-----------|----------|---------|
| Reverse Cursed Technique: **Red** | 赫 | Index finger pointing up |
| Cursed Technique: **Blue** | 蒼 | "Gun" — thumb + index extended, other fingers down |
| Domain Expansion: **Infinite Void** | 無量空処 | Index + middle crossed (peace-sign cross) |
| Secret Technique: **Hollow Purple** | 虚式「茈」 | Pinch — thumb + index touching |
| Domain Expansion: **Malevolent Shrine** | 伏魔御廚子 | Open hand / all fingers up |
| **Black Flash** | 黒閃 | Closed fist |

### Two Hands (Composite)
| Technique | Japanese | Gesture |
|-----------|----------|---------|
| **Kamehameha** | 波 | Both palms open, brought together |
| **Fusion / Convergence** | 合 | Both fists (or both pinches) brought together |

> With two hands on screen, the **distance between them** scales the bloom, camera dolly, and shake — push your hands apart for a bigger blast.

### Face
| Technique | Japanese | Trigger |
|-----------|----------|---------|
| **Cursed Speech** | 呪言 | Open mouth (detected via FaceMesh) |

---

## How It Works

```
webcam ──► MediaPipe tasks-vision (HandLandmarker + optional FaceLandmarker)
               │  classify poses → technique + glow + metrics
               ▼
            cv.js  ──(onTechnique / onMetrics)──►  index.html (three.js scene)
               │                                        │
               └── audio.js ◄── playCast() / speak() ───┘
```

- **`cv.js`** — owns the camera feed and **all** MediaPipe inference, built on a single `@mediapipe/tasks-vision` bundle (one shared wasm fileset, so the hand and face models never collide). It runs `HandLandmarker` and `FaceLandmarker` each frame, classifies each hand into a technique, aggregates two hands into composite techniques, and (optionally) detects an open mouth. It reports `onTechnique(tech, glow)` on changes and `onMetrics({hands, distance})` every frame. Landmark drawing is done with the canvas 2D API (no legacy `drawing_utils`).
- **`index.html`** — the three.js renderer. Particle generators (`getRed`, `getBlue`, `getVoid`, `getPurple`, `getShrine`, `getBlackFlash`, `getKamehameha`, `getFusion`, `getCursedSpeech`) feed target positions/colors/sizes; a custom shader draws them as glowing spheres; bloom + shockwave + camera effects respond to the active technique and hand metrics.
- **`audio.js`** — a self-contained sound engine. No external audio files: cast sounds are synthesized with oscillators/noise, and incantations are spoken with the browser's speech synthesis. Everything is gated behind the **SOUND** toggle.

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
   - **VS Code:** install the *Live Server* extension, right-click `index.html`, and choose **Open with Live Server**.
   - **Or** from the terminal: `python3 -m http.server 8000`, then open `http://localhost:8000`.
3. Allow camera access and start forming signs.
4. Click **SOUND: OFF** (bottom-right) to enable audio + spoken incantations.

---

## Roadmap
- More two-hand integration signs (e.g. circular "binding" seals).
- True 3D instanced-sphere particles as an alternative to shader points.
- Tunable gesture sensitivity / calibration UI.
- Additional face expressions (eyes closed, smile) as technique triggers.

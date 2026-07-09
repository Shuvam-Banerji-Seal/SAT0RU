// ============================================================================
// SAT0RU - Computer Vision module
// ----------------------------------------------------------------------------
// Built entirely on @mediapipe/tasks-vision (a single, self-contained wasm
// fileset) so the Hands and Face models NEVER collide on a shared global
// Emscripten `Module` the way the legacy @mediapipe/* script packages do.
//
//   * HandLandmarker -> single-hand + two-hand composite techniques
//   * FaceLandmarker -> "Cursed Speech" on open mouth (optional)
//
// Reports:
//   - onTechnique(technique, glow)    : fired when the detected technique changes
//   - onMetrics({ hands, distance })  : fired every frame
// ============================================================================

const TASKS_VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const TECH_GLOW = {
    neutral:        '#00ffff',
    red:            '#ff3333',
    void:           '#00ffff',
    blue:           '#3366ff',
    purple:         '#bb00ff',
    shrine:         '#ff0000',
    blackflash:     '#aa33ff',
    kamehameha:     '#66ffff',
    fusion:         '#ffaa00',
    cursed_speech:  '#cc66ff',
};

// Higher index = higher priority when aggregating across hands / modalities.
const TECH_PRIORITY = [
    'neutral', 'red', 'void', 'blue', 'shrine', 'blackflash', 'purple',
    'fusion', 'kamehameha', 'cursed_speech',
];

let glowColor = TECH_GLOW.neutral;

export function getGlowColor() {
    return glowColor;
}

// Standard MediaPipe hand skeleton connection pairs.
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
];

function drawHand(ctx, lm, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
        ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Classify a single hand's landmarks into one technique.
function classifyHand(lm) {
    const isUp = (tip, pip) => lm[tip].y < lm[pip].y;
    const pinch = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y);

    const fist      = !isUp(8, 6) && !isUp(12, 10) && !isUp(16, 14) && !isUp(20, 18);
    const allUp     = isUp(8, 6) && isUp(12, 10) && isUp(16, 14) && isUp(20, 18);
    const indexOnly = isUp(8, 6) && !isUp(12, 10) && !isUp(16, 14) && !isUp(20, 18);
    const gun       = isUp(8, 6) && isUp(4, 3) && !isUp(12, 10) && !isUp(16, 14) && !isUp(20, 18);
    const cross     = isUp(8, 6) && isUp(12, 10) && !isUp(16, 14) && !isUp(20, 18);

    if (pinch < 0.04) return 'purple';    // thumb + index pinch   -> Hollow Purple
    if (fist)         return 'blackflash'; // closed fist            -> Black Flash
    if (allUp)        return 'shrine';    // open hand              -> Malevolent Shrine
    if (gun)          return 'blue';      // thumb + index (gun)    -> Blue
    if (cross)        return 'void';      // index + middle cross   -> Infinite Void
    if (indexOnly)    return 'red';       // index only             -> Red
    return 'neutral';
}

// Combine two hands into a composite technique, else aggregate by priority.
function classifyTwoHands(a, b, dist) {
    const ca = classifyHand(a);
    const cb = classifyHand(b);

    const fists   = ca === 'blackflash' && cb === 'blackflash';
    const pinches = ca === 'purple' && cb === 'purple';

    // Kamehameha: two hands pressed together (palms touching).
    // Detect by wrist proximity + fingertip proximity — no finger "up" check
    // needed, so it works even when overlapping palms hide individual fingers.
    const wristDist = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y);
    const tipIds = [8, 12, 16, 20];
    let tipAvg = 0;
    for (const id of tipIds) {
        tipAvg += Math.hypot(a[id].x - b[id].x, a[id].y - b[id].y);
    }
    tipAvg /= tipIds.length;
    if (wristDist < 0.2 && tipAvg < 0.2) return 'kamehameha';

    // Fusion: both fists or both pinches close together.
    if (dist < 0.32 && (fists || pinches)) return 'fusion';

    let best = 'neutral';
    [ca, cb].forEach((t) => {
        if (TECH_PRIORITY.indexOf(t) > TECH_PRIORITY.indexOf(best)) best = t;
    });
    return best;
}

// Create a landmarker, trying GPU then falling back to CPU.
async function createLandmarker(fileset, Cls, extra) {
    const withDelegate = (delegate) => ({ ...extra, baseOptions: { ...extra.baseOptions, delegate } });
    try {
        return await Cls.createFromOptions(fileset, withDelegate('GPU'));
    } catch (e) {
        return await Cls.createFromOptions(fileset, withDelegate('CPU'));
    }
}

export async function setupCV({ onTechnique, onMetrics } = {}) {
    const videoElement = document.querySelector('.input_video');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement.getContext('2d');

    // Load the single tasks-vision bundle (one wasm fileset for everything).
    let vision, fileset;
    try {
        vision = await import(`${TASKS_VISION}/vision_bundle.mjs`);
        fileset = await vision.FilesetResolver.forVisionTasks(`${TASKS_VISION}/wasm`);
    } catch (e) {
        console.error('[SAT0RU] Failed to load MediaPipe tasks-vision.', e);
        return;
    }
    const { HandLandmarker, FaceLandmarker } = vision;

    let handLandmarker;
    try {
        handLandmarker = await createLandmarker(fileset, HandLandmarker, {
            baseOptions: { modelAssetPath: HAND_MODEL },
            runningMode: 'VIDEO',
            numHands: 2,
        });
    } catch (e) {
        console.error('[SAT0RU] HandLandmarker failed to initialize.', e);
        return;
    }

    let faceLandmarker = null;
    try {
        faceLandmarker = await createLandmarker(fileset, FaceLandmarker, {
            baseOptions: { modelAssetPath: FACE_MODEL },
            runningMode: 'VIDEO',
            numFaces: 1,
        });
    } catch (e) {
        console.warn('[SAT0RU] FaceLandmarker unavailable, face gestures disabled.', e);
    }

    // Webcam
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }, audio: false,
        });
        videoElement.srcObject = stream;
        await videoElement.play();
    } catch (e) {
        console.error('[SAT0RU] Camera access denied.', e);
        return;
    }

    let currentTech = 'neutral';
    let faceOpen = false;

    function process() {
        requestAnimationFrame(process);
        if (videoElement.readyState < 2) return;

        const w = videoElement.videoWidth;
        const h = videoElement.videoHeight;
        canvasElement.width = w;
        canvasElement.height = h;
        canvasCtx.clearRect(0, 0, w, h);

        const ts = performance.now();
        let detected = 'neutral';
        let distance = 0;
        let handCount = 0;

        try {
            const hres = handLandmarker.detectForVideo(videoElement, ts);
            const lms = hres.landmarks || [];
            handCount = lms.length;
            if (lms.length) {
                lms.forEach((lm) => drawHand(canvasCtx, lm, w, h, glowColor));
                if (lms.length === 2) {
                    const c0 = lms[0][9];
                    const c1 = lms[1][9];
                    distance = Math.hypot(c0.x - c1.x, c0.y - c1.y);
                    detected = classifyTwoHands(lms[0], lms[1], distance);
                } else {
                    detected = classifyHand(lms[0]);
                }
            }
        } catch (e) { /* transient hand error */ }

        if (faceLandmarker) {
            try {
                const fres = faceLandmarker.detectForVideo(videoElement, ts);
                if (fres.faceLandmarks && fres.faceLandmarks.length) {
                    const fl = fres.faceLandmarks[0];
                    faceOpen = Math.hypot(fl[13].x - fl[14].x, fl[13].y - fl[14].y) > 0.05;
                } else {
                    faceOpen = false;
                }
            } catch (e) { /* transient face error */ }
        }

        if (faceOpen && detected !== 'cursed_speech') detected = 'cursed_speech';

        if (detected !== currentTech) {
            currentTech = detected;
            glowColor = TECH_GLOW[detected] ?? TECH_GLOW.neutral;
            onTechnique && onTechnique(detected, glowColor);
        }
        onMetrics && onMetrics({ hands: handCount, distance });
    }

    process();
}

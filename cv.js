// ============================================================================
// SAT0RU - Computer Vision module
// ----------------------------------------------------------------------------
// Encapsulates the MediaPipe pipelines:
//   * Hands   -> single-hand techniques + two-hand composite techniques
//   * FaceMesh (optional) -> "Cursed Speech" when the mouth is open
//
// It owns the webcam feed, classifies poses into techniques, and reports:
//   - onTechnique(technique, glow) : fired when the detected technique changes
//   - onMetrics({ hands, distance }) : fired every frame (hand count + normalized
//     distance between the two hands, used by the renderer for "screen" effects)
// ============================================================================

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
    const close = dist < 0.32;

    const openHands  = ca === 'shrine'     && cb === 'shrine';
    const fists      = ca === 'blackflash' && cb === 'blackflash';
    const pinches    = ca === 'purple'     && cb === 'purple';

    if (close && openHands) return 'kamehameha'; // two open palms together
    if (close && (fists || pinches)) return 'fusion'; // fists/pinches together

    // No special composite -> strongest single-hand pose wins.
    let best = 'neutral';
    [ca, cb].forEach((t) => {
        if (TECH_PRIORITY.indexOf(t) > TECH_PRIORITY.indexOf(best)) best = t;
    });
    return best;
}

export function setupCV({ onTechnique, onMetrics } = {}) {
    const videoElement = document.querySelector('.input_video');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement.getContext('2d');

    let currentTech = 'neutral';
    let faceOpen = false;

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7 });

    hands.onResults((results) => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const lms = results.multiHandLandmarks || [];
        let detected = 'neutral';
        let distance = 0;

        if (lms.length) {
            lms.forEach((lm) => {
                drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: glowColor, lineWidth: 5 });
                drawLandmarks(canvasCtx, lm, { color: '#fff', lineWidth: 1, radius: 2 });
            });

            if (lms.length === 2) {
                const c0 = lms[0][9];
                const c1 = lms[1][9];
                distance = Math.hypot(c0.x - c1.x, c0.y - c1.y);
                detected = classifyTwoHands(lms[0], lms[1], distance);
            } else {
                detected = classifyHand(lms[0]);
            }
        }

        // Face modality overrides when the mouth is clearly open.
        if (faceOpen && detected !== 'cursed_speech') detected = 'cursed_speech';

        if (detected !== currentTech) {
            currentTech = detected;
            glowColor = TECH_GLOW[detected] ?? TECH_GLOW.neutral;
            onTechnique && onTechnique(detected, glowColor);
        }
        onMetrics && onMetrics({ hands: lms.length, distance });
    });

    // --- Optional FaceMesh (Cursed Speech) ---
    if (typeof FaceMesh !== 'undefined') {
        const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.7 });
        faceMesh.onResults((res) => {
            if (res.multiFaceLandmarks && res.multiFaceLandmarks.length) {
                const lm = res.multiFaceLandmarks[0];
                const d = Math.hypot(lm[13].x - lm[14].x, lm[13].y - lm[14].y);
                faceOpen = d > 0.05;
            } else {
                faceOpen = false;
            }
        });

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                await Promise.all([
                    hands.send({ image: videoElement }),
                    faceMesh.send({ image: videoElement }),
                ]);
            },
            width: 640,
            height: 480,
        });
        camera.start();
        return;
    }

    // --- Hands only ---
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480,
    });
    camera.start();
}

// ============================================================================
// SAT0RU - Computer Vision module
// ----------------------------------------------------------------------------
// Encapsulates the MediaPipe hand-tracking + gesture-recognition pipeline.
// It owns the webcam feed, runs the Hands model, classifies a hand pose into
// one of the cursed techniques, and reports changes back via a callback.
//
// The rendering layer (three.js) lives in index.html and only needs to call
// `setupCV(onTechniqueChange)` to start the vision pipeline.
// ============================================================================

// Glow accent colour per technique, shared with the renderer for visual sync.
const TECH_GLOW = {
    neutral: '#00ffff',
    red:     '#ff3333',
    void:    '#00ffff',
    purple:  '#bb00ff',
    shrine:  '#ff0000',
};

let glowColor = TECH_GLOW.neutral;

export function getGlowColor() {
    return glowColor;
}

/**
 * Start the computer-vision pipeline.
 * @param {(technique: string, glow: string) => void} onTechniqueChange
 *        Called whenever the detected technique changes.
 */
export function setupCV(onTechniqueChange) {
    const videoElement = document.querySelector('.input_video');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement.getContext('2d');

    // --- MediaPipe Hands model ---
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
    });

    let currentTech = 'neutral';

    hands.onResults((results) => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        let detected = 'neutral';

        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((lm) => {
                drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, {
                    color: glowColor,
                    lineWidth: 5,
                });
                drawLandmarks(canvasCtx, lm, {
                    color: '#fff',
                    lineWidth: 1,
                    radius: 2,
                });

                const isUp = (tip, pip) => lm[tip].y < lm[pip].y;
                const pinch = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y);

                if (pinch < 0.04) detected = 'purple';
                else if (isUp(8, 6) && isUp(12, 10) && isUp(16, 14) && isUp(20, 18)) detected = 'shrine';
                else if (isUp(8, 6) && isUp(12, 10) && !isUp(16, 14)) detected = 'void';
                else if (isUp(8, 6) && !isUp(12, 10)) detected = 'red';
            });
        }

        if (detected !== currentTech) {
            currentTech = detected;
            glowColor = TECH_GLOW[detected] ?? TECH_GLOW.neutral;
            onTechniqueChange(detected, glowColor);
        }
    });

    // --- Webcam capture (MediaPipe Camera utility) ---
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

    return { hands, camera };
}

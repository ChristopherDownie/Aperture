// Classic worker: MediaPipe's WASM loader uses importScripts.
// The published CommonJS bundle is self-contained; expose its exports locally.
self.exports = {};
importScripts('./vision-assets/vision_bundle.js');
const { FilesetResolver, HandLandmarker } = self.exports;
let tracker;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(new URL('./vision-assets/wasm', self.location.href).href);
      const options = {
        baseOptions: { modelAssetPath: new URL('./vision-assets/hand_landmarker.task', self.location.href).href, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
      };
      try { tracker = await HandLandmarker.createFromOptions(files, options); }
      catch { options.baseOptions.delegate = 'CPU'; tracker = await HandLandmarker.createFromOptions(files, options); }
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  } else if (data.type === 'frame') {
    try {
      const result = tracker.detectForVideo(data.frame, data.timestamp);
      self.postMessage({ type: 'result', timestamp: data.timestamp, landmarks: result.landmarks, worldLandmarks: result.worldLandmarks, handedness: result.handedness });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.frame.close(); }
  }
};

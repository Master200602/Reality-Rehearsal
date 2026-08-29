// Ported from team's interview-face-analysis project (useFaceLandmarker.js).
// One change: numFaces raised from 1 -> 2 so multi-face detection/warnings
// (required by the integration spec) are actually possible.
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export async function createFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
    },
    runningMode: 'VIDEO',
    numFaces: 2,
  });

  return faceLandmarker;
}

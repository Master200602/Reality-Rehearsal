# CHANGES.md — Voice + Camera/Face-Detection Integration

## Summary

Merged your team's `interview-face-analysis` project (React + MediaPipe
FaceLandmarker, 100% client-side) into your existing Reality-Rehearsal voice
interview app, so the candidate's camera runs face detection continuously and
independently alongside the voice interview — one website, one interview
flow.

## Architecture decision

**Problem:** Two separate React apps, each with their own `App.jsx`, routing,
and build.

**Why it happens:** The face-detection project was built as a standalone demo
with its own entry point.

**Options considered:**
1. Run them as two separate deployed apps (rejected — spec explicitly asked
   for one website, one interview interface).
2. Wrap the face-detection app in an iframe inside the interview page
   (rejected — loses shared state, adds postMessage complexity, feels bolted
   on rather than native).
3. Extract the face-detection project's actual logic (hooks + utils, no UI
   shell) and mount it as a component inside the existing interview page.

**Recommended & implemented solution:** Option 3. The face-detection project
turned out to be pure logic wrapped in a demo `App.jsx` — camera access,
MediaPipe model loading, and calculation utilities, with no backend and no
routing of its own. That logic was ported as-is into your project's
structure and given a proper React hook + component shell that matches your
existing patterns (compare `useSpeech.js` to the new `useFaceMonitor.js`).

## Files added

```
frontend/src/utils/faceAnalysis/
  calculateHeadDirection.js     — ported as-is
  calculateFacePosition.js      — ported as-is
  calculateEyeContact.js        — ported as-is
  calculateBlink.js             — ported as-is
  calculateSmile.js             — ported as-is
  calculateInterviewScore.js    — ported as-is
  drawLandmarks.js              — ported, re-themed (cyan dots instead of lime)
  calculateFaceCount.js         — NEW (see "Justified additions" below)
  createFaceLandmarker.js       — ported, numFaces: 1 -> 2 (see below)
  sessionRecorder.js            — ported + extended (see below)

frontend/src/hooks/useFaceMonitor.js   — NEW: orchestrates camera + model +
                                          throttled detection loop + cleanup

frontend/src/components/CameraMonitor.jsx  — NEW: PIP camera UI
frontend/src/components/CameraMonitor.css  — NEW: matches existing glass theme
```

## Files modified

```
frontend/package.json
  + "@mediapipe/tasks-vision": "^1.0.0"

frontend/src/pages/InterviewSession.jsx
  + import CameraMonitor
  + cameraActive state, started/stopped alongside the interview session
  + camera ref wired so its report/metrics can be read on completion
  + camera included in navigation state passed to /report
  + layout: avatar + camera now sit side by side in a new .session-top-row

frontend/src/pages/InterviewSession.css
  + .session-top-row layout (side-by-side desktop, stacked on mobile)

frontend/src/pages/Report.jsx
  + optional "Camera & Body Language" section — only renders if faceReport
    data exists in navigation state, so older/camera-less sessions are
    completely unaffected
  + calls the existing customAnalyzeBehavior() API when behaviorMetrics
    are present, to surface coaching feedback from your rule engine

frontend/src/pages/Report.css
  + styles for the new face-metrics card
```

## Backend / database

**No backend files were changed.** `backend/routes/mockmirrorApi.js` and
`backend/services/ruleEngine.js` are byte-for-byte identical to your
original project.

Why: `POST /v1/behavior/analyze` already existed, already called
`evaluateBehaviorMetrics()`, and already expected `eyeContactPct` and
`faceCenteringPct` on a 0–100 scale — which is exactly the shape
`sessionRecorder.toBehaviorMetrics()` now produces from the camera data. It
was fully built but never called from the frontend until now.

No database schema changes were made or needed — face data is generated
client-side per session and passed through React Router navigation state to
the report page, the same way `responses` already was. Nothing is persisted
server-side beyond what the existing report generation already does.

## Justified deviations from a literal port

1. **`numFaces: 1 → 2`** in the MediaPipe config (`createFaceLandmarker.js`).
   Your integration spec explicitly asks for a "multiple faces detected"
   warning, which is impossible if the model is only configured to look for
   one face. This is a one-line config change, not new detection logic.

2. **`calculateFaceCount.js`** — new, minimal (2 lines). Just reads
   `results.faceLandmarks.length`, which MediaPipe already returns. Needed to
   actually implement the multi-face warning called for above.

3. **Detection throttling** — the original project ran detection on every
   `requestAnimationFrame` (~60 times/sec). `useFaceMonitor.js` throttles this
   to roughly every 150ms (~6-7 times/sec) so it doesn't compete with speech
   recognition for CPU, per the spec's performance requirements. The
   detection *logic itself* (which utils run, in what order) is unchanged —
   only how often it's called.

4. **`sessionRecorder.js` extended, not replaced** — added `noFaceFrames` /
   `multiFaceFrames` tracking (for the report's "no face / multiple faces"
   warning) and a `toBehaviorMetrics()` method that reshapes the existing
   report into the `{eyeContactPct, faceCenteringPct}` payload your backend
   already expects. The original scoring math (`generateReport()`) is
   unchanged.

## How voice and camera run simultaneously

- They're started from the same place (`handleStartSession` in
  `InterviewSession.jsx`) but are otherwise **fully decoupled**: camera
  permission requests, MediaPipe loading, and the detection loop all live
  inside `useFaceMonitor`, with their own status state machine
  (`FACE_STATUS`) completely separate from the voice `phase` state machine.
- A camera failure (permission denied, model load error) only ever updates
  `FACE_STATUS` and shows a message in the camera panel — it never touches
  `phase`, `isListening`, or any speech state, and cannot block or crash the
  voice interview.
- Both mic and camera streams are stopped independently on interview
  completion, manual "End Interview", and component unmount, so no stale
  media tracks are left running.

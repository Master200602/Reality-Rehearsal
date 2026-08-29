# Camera & Face-Detection Integration — Setup Guide

This project now runs the **voice interview** and **real-time face detection**
(from your team's `interview-face-analysis` project) together, in one app.

## What changed at a glance

- **Frontend only.** The face-detection library (MediaPipe FaceLandmarker) runs
  100% client-side in the browser — no new backend service was needed.
- **Backend is untouched.** Your existing `/v1/behavior/analyze` endpoint and
  rule engine (`evaluateBehaviorMetrics`) were already built to accept exactly
  the eye-contact / face-centering data the camera now produces — it was just
  never wired up until now.

See `CHANGES.md` for the full file-by-file breakdown.

---

## 1. Install dependencies

From the project root:

```bash
cd frontend
npm install
```

This pulls in the one new dependency: `@mediapipe/tasks-vision`.

```bash
cd ../backend
npm install
```

(Backend dependencies are unchanged — this is only needed if you haven't
installed them before.)

## 2. Environment variables

No new environment variables were introduced. Use your existing
`backend/.env` (see `backend/.env.example` if you need to recreate it).

## 3. Run the backend

```bash
cd backend
npm start
```

Or check `backend/package.json` / `SETUP.md` for the exact dev script if
different.

## 4. Run the frontend

```bash
cd frontend
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in
**Google Chrome** (the existing voice interview requires the Web Speech API,
which is Chrome-only — this hasn't changed).

## 5. Try it out

1. Go to the candidate info page, fill it in, and start an interview.
2. On the "Ready to begin" screen, click **Start Interview**.
3. The browser will ask for **two permissions**: microphone (existing) and
   camera (new). Allow both.
4. You'll see the camera preview appear next to the AI interviewer avatar,
   with a status badge (Monitoring / No face detected / Multiple faces).
5. Finish or end the interview — camera and mic both stop automatically.
6. On the report page, scroll to the new **"Camera & Body Language"** section.

## Notes

- If camera permission is denied, the interview still proceeds normally on
  voice alone — the camera panel just shows a permission-denied message.
- If you deny the camera specifically but allow the mic, nothing about the
  voice flow changes.
- Face detection runs at a throttled ~6-7 checks per second (not every video
  frame) to leave CPU headroom for speech recognition — see `CHANGES.md`
  for why.
- The first time MediaPipe loads, it downloads its model files from Google's
  CDN (`storage.googleapis.com`) and the WASM runtime from `jsdelivr.net`.
  This requires an internet connection on the machine running the browser —
  same as the original team project.

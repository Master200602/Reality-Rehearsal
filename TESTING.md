# TESTING.md — Verification status & manual test checklist

## Important: what I could and couldn't verify here

This sandbox has **no network access to the npm registry** (confirmed — even
plain `npm view react` returns a 403), so I was not able to run `npm install`
or `npm run build` to get a true end-to-end compile check. I want to be
upfront about that rather than claim a build pass that didn't happen.

**What I did verify, thoroughly:**

- Every `.js`/`.jsx` file under `frontend/src` (23 files, old + new) was
  parsed with `@babel/parser` in JSX mode — the same class of parser Vite's
  toolchain uses under the hood — and **all parse without syntax errors**.
- `frontend/package.json` and `backend/package.json` are valid JSON.
- `backend/routes/mockmirrorApi.js` and `backend/services/ruleEngine.js` are
  byte-for-byte identical to your original upload — confirming no backend
  regressions were introduced.
- Manual line-by-line review of every modified file for: balanced
  braces/JSX tags, correct import/export names, no unused imports, and
  consistent data shapes between `useFaceMonitor` → `CameraMonitor` →
  `InterviewSession` → `Report`.

**What I could NOT verify (needs to happen on your machine):**

- A real `npm install` (dependency resolution, version conflicts)
- `npm run build` (Vite bundling, tree-shaking, the MediaPipe WASM asset
  handling)
- Actually running the app in a browser — camera permission flow, MediaPipe
  model loading from Google's CDN, the detection loop, and the report page
  rendering with real data

Please run the steps below before considering this done — this is real,
uncompiled code that I'm confident is correct, but "confident" isn't the
same as "verified running."

## Setup

```bash
cd frontend
npm install
npm run build       # should complete with no errors (a chunk-size warning
                     # about MediaPipe's ~1MB gzipped WASM bundle is expected
                     # and fine)
npm run dev
```

```bash
cd backend
npm install
npm start
```

## Manual test checklist

- [ ] **Camera + mic both allowed** — camera preview appears next to avatar,
      status badge shows "Monitoring", voice interview proceeds normally,
      both work at the same time without one blocking the other.
- [ ] **Camera permission denied** — clear message in the camera panel
      ("Camera access is required..."), voice interview is completely
      unaffected, no crash.
- [ ] **Mic permission denied** — existing mic error handling still works
      as before (unchanged by this integration).
- [ ] **No face in frame** (step out of camera view) — status badge changes
      to "No face detected", warning message shown, voice interview
      continues uninterrupted.
- [ ] **Two people in frame** — status badge changes to "Multiple faces",
      voice interview continues uninterrupted.
- [ ] **Complete an interview normally** — on the report page, confirm the
      new "Camera & Body Language" card appears with eye contact / face
      centering / looking forward / smiling / blink count, and (if the
      backend is running) a behavior score + coaching notes from
      `/v1/behavior/analyze`.
- [ ] **End interview early** via the exit button — camera and mic both stop
      (check the browser's camera/mic indicator turns off), report page
      still shows face data collected so far.
- [ ] **Refresh and start a new interview** — camera can be re-requested and
      works again; no stale "camera in use" errors from a previous session.
- [ ] **Skip the camera entirely** (deny it) and complete an interview — the
      report page should NOT show the "Camera & Body Language" section at
      all (it's conditional on `faceReport` being present), and everything
      else on the report should look exactly as it did before this
      integration.

If any of these fail, the most likely places to look first are
`frontend/src/hooks/useFaceMonitor.js` (camera/model lifecycle) and
`frontend/src/pages/InterviewSession.jsx` (where it's wired into the
session).

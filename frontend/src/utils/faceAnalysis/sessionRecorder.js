// Ported from team's interview-face-analysis project (sessionRecorder.js),
// extended with:
//   - noFace / multiFace frame tracking (for the interview report)
//   - toBehaviorMetrics(), which reshapes the recorded session into the
//     { eyeContactPct, faceCenteringPct, ... } shape that the existing
//     backend endpoint POST /v1/behavior/analyze (evaluateBehaviorMetrics)
//     already expects.
class SessionRecorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalFrames = 0;
    this.eyeContactFrames = 0;
    this.faceCenteredFrames = 0;
    this.headForwardFrames = 0;
    this.smileFrames = 0;
    this.lookingAwayFrames = 0;
    this.noFaceFrames = 0;
    this.multiFaceFrames = 0;
    this.blinkCount = 0;
    this.startTime = Date.now();
  }

  update(data) {
    this.totalFrames++;

    if (data.faceCount === 0) this.noFaceFrames++;
    if (data.faceCount > 1) this.multiFaceFrames++;

    if (data.eyeContact === '👁 Excellent Eye Contact' || data.eyeContact === '👁 Good Eye Contact') {
      this.eyeContactFrames++;
    }

    if (data.facePosition === '🎯 Face Centered') this.faceCenteredFrames++;
    if (data.headDirection === '👀 Looking Forward') this.headForwardFrames++;
    if (data.smileStatus === '😊 Smiling') this.smileFrames++;
    if (data.headDirection !== '👀 Looking Forward') this.lookingAwayFrames++;

    this.blinkCount = data.blinkCount;
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    const total = this.totalFrames || 1;

    return {
      interviewDuration: duration.toFixed(1),
      eyeContact: (this.eyeContactFrames / total) * 100,
      faceCentered: (this.faceCenteredFrames / total) * 100,
      headForward: (this.headForwardFrames / total) * 100,
      smile: (this.smileFrames / total) * 100,
      lookingAway: (this.lookingAwayFrames / total) * 100,
      noFacePct: (this.noFaceFrames / total) * 100,
      multiFacePct: (this.multiFaceFrames / total) * 100,
      blinkCount: this.blinkCount,
      totalFrames: this.totalFrames,
    };
  }

  /**
   * Reshapes the recorded session into the metrics payload the existing
   * backend rule engine (evaluateBehaviorMetrics) already expects:
   * eyeContactPct and faceCenteringPct on a 0-100 scale.
   */
  toBehaviorMetrics() {
    const report = this.generateReport();
    return {
      eyeContactPct: Math.round(report.eyeContact),
      faceCenteringPct: Math.round(report.faceCentered),
    };
  }
}

export default SessionRecorder;

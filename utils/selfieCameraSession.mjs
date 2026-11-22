/** Owns only the explicitly opened selfie camera; construction never probes devices. */
export function createSelfieCameraSession() {
  let generation = 0;
  let activeStream = null;
  const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());

  function stop() {
    generation++;
    stopTracks(activeStream);
    activeStream = null;
  }

  async function start(mediaDevices, constraints, { onStream, onDevices, onError }) {
    stop();
    const request = generation;
    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      // Closing the modal / navigating away cannot cancel the OS prompt, but
      // its eventual result must never leave a camera running on another page.
      if (request !== generation) {
        stopTracks(stream);
        return;
      }
      activeStream = stream;
      await onStream(stream);
      if (request !== generation) return;

      // Probe for a flip-camera button only after the user has opened the
      // camera and granted access. Some native WebViews intercept this probe.
      try {
        const devices = await mediaDevices.enumerateDevices();
        if (request === generation) onDevices(devices);
      } catch { /* Camera switching is optional. */ }
    } catch (error) {
      if (request !== generation) return;
      stop();
      onError(error);
    }
  }

  return { start, stop };
}

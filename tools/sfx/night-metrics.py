"""Deterministic spectral QA; no credentials or generation. Requires numpy."""
import json
import subprocess
import sys
import numpy as np


def measure(ffmpeg, path):
    result = subprocess.run([ffmpeg, '-v', 'error', '-i', path, '-f', 'f32le',
                             '-ac', '1', '-ar', '24000', '-'], capture_output=True, check=True)
    samples = np.frombuffer(result.stdout, dtype='<f4').astype(float)
    frames = np.lib.stride_tricks.sliding_window_view(samples, 1024)[::240]
    power = np.abs(np.fft.rfft(frames * np.hanning(1024), axis=1)) ** 2
    freq = np.fft.rfftfreq(1024, 1 / 24000)
    band = power[:, (freq >= 1000) & (freq <= 10000)] + 1e-15
    flatness = np.exp(np.mean(np.log(band), axis=1)) / np.mean(band, axis=1)
    chirps = power[:, (freq >= 3500) & (freq <= 5500)].sum(axis=1)
    # Hysteresis identifies distinct chirp phrases, not every carrier pulse.
    high, low = np.percentile(chirps, [80, 35])
    active, last, peaks = False, -1000, []
    for i, energy in enumerate(chirps):
        if active and energy < low:
            active = False
        if not active and energy > high and i - last >= 15:
            peaks.append(round(i * .01, 2))
            active, last = True, i
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    return dict(file=path.replace('\\', '/').split('/')[-1], duration=len(samples)/24000,
                flatness_mean=float(flatness.mean()), flatness_p90=float(np.percentile(flatness,90)),
                chirp_band_contrast_db=float(10*np.log10((high+1e-15)/(low+1e-15))),
                chirp_phrases=len(peaks), chirp_onsets_seconds=peaks,
                quiet_frame_rms_db=float(20*np.log10(np.percentile(rms,10)+1e-15)))


if __name__ == '__main__':
    print(json.dumps([measure(sys.argv[1], path) for path in sys.argv[2:]], indent=2))

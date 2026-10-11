"""Reconstruct the CC0 score only. Capture v3 product footage separately."""
from pathlib import Path
import math
import shutil
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
# 120 BPM, Cmaj7 / Am7 / Fmaj7 / G6. Every sound is an oscillator, no samples.
rate = 24000
seconds = 68
chords = [(48, 52, 55, 59), (45, 48, 52, 55), (41, 45, 48, 52), (43, 47, 50, 52)]
def hz(note):
    return 440 * 2 ** ((note - 69) / 12)

audio = bytearray()
peak = 0
for i in range(rate * seconds):
    t = i / rate
    beat = int(t * 2)
    phase = t % .5
    chord = chords[int(t / 4) % 4]
    # Soft bell arpeggio, warm bass, restrained kick and closed hat.
    note = chord[beat % 4] + 24
    bell = .15 * math.exp(-phase * 8) * (math.sin(2 * math.pi * hz(note) * phase) + .18 * math.sin(2 * math.pi * hz(note) * 2 * phase))
    bass = .12 * math.sin(2 * math.pi * hz(chord[0] - 12) * t) * min(1, phase * 40) * math.exp(-phase * 3)
    kick = .18 * math.sin(2 * math.pi * (48 * phase + 7 * (1 - math.exp(-phase * 25)))) * math.exp(-phase * 18)
    hp = (t + .25) % .5
    hat = .024 * math.sin(i * 78.233) * math.sin(i * 12.9898) * math.exp(-hp * 90)
    pad = sum(math.sin(2 * math.pi * hz(n + 12) * t) for n in chord) * .013
    value = (bell + bass + kick + hat + pad) * min(1, t / 1.5, (seconds - t) / 2)
    peak = max(peak, abs(value))
    audio += struct.pack('<h', round(value * 32767))
target = PUBLIC / 'audio/village-original.wav'
target.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(target), 'wb') as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(rate)
    out.writeframes(audio)
print(f'Prepared original 68s CC0 score, peak={peak:.3f}')

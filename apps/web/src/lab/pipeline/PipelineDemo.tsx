import { useEffect, useState } from 'react';
import { CachedHead } from './CachedHead';
import { Turntable } from './Turntable';
import './demo.css';
import { useDemoMedia, DemoPhoto, PLACEHOLDER } from './runtimeMedia';

export const AVATAR_STEPS = ['Source photo', 'Segmentation', 'Extracted traits', 'Gemini stylize → villager', 'Gaussian head', 'Talking head'];
export const OBJECT_STEPS = ['Object source', 'Object segmentation', 'Generated mesh', 'In-game prop'];
const avatarInfo = [
  ['Consented source', 'Browser · cached photograph', 'No inference', 'Member-only media loads from the existing avatar. Otherwise an illustrated sample explains the same steps.'],
  ['Find the person, preserve the details', 'SAM 3 · Modal GPU', '3.3–3.5 s warm', 'Toggle available cached masks on the matching full-body crop. Missing masks use a labeled illustration. Hair and clothing regions become the color palette for a recognizable villager.'],
  ['A palette from your photograph', 'SAM 3 + color extraction · Modal GPU', 'Included in segmentation', 'These swatches come from the runtime avatar manifest, or the illustrated preset. Unobserved pants and shoes use preset colors.'],
  ['A little more you', 'Gemini image stylize → Hunyuan3D head · Modal GPU', 'Stylize + mesh', 'Gemini restyles your face crop into a chibi version that keeps your features; Hunyuan3D turns that image into a textured 3D head on the villager body, tinted with your palette. Drag to inspect.'],
  ['From a photograph to a 3D face', 'LAM · Modal GPU', '~20 s warm', 'A Gaussian-splat head reconstructed from a photograph. When a cached package is unavailable, this stage shows an illustrated reference.'],
  ['Give your villager a voice', 'ElevenLabs · cloud; Audio2Expression + LAM · Modal GPU', '182 frames / 30 fps¹', 'Play an available cached voice line with the portrait. Audio starts only when you press play. No synthesis or voice cloning runs here.'],
];
const objectInfo = [
  ['A real object, a tiny prop', 'Input photo / prompt · browser', 'No inference', 'Source prompt: mug. Follow this cached example from photograph to a placeable village decoration.'],
  ['Keep just the mug', 'SAM 3 → Gemini image stylize · Modal GPU + cloud', '0.96 confidence', 'The cached alpha cutout removes the background. Gemini 2.5 Flash Image then stylizes it before meshing.'],
  ['Inspect the generated geometry', 'Hunyuan3D-2mini · Modal GPU', '76 s warm / 204 s cold', 'A textured, 3,000-triangle GLB. Toggle wireframe or surface normals, and drag the turntable.'],
  ['Ready for a friend’s home', 'Cached GLB · browser', '0.60 × 0.39 × 0.45 m', 'The same generated prop placed on a village-green display. It is previewed locally; nothing is added to the live village.'],
];
export default function PipelineDemo() {
  const media = useDemoMedia();
  const [audioFailed, setAudioFailed] = useState(false);
  const [track, setTrack] = useState<'avatar' | 'object'>('avatar');
  const [step, setStep] = useState(0), [auto, setAuto] = useState(false);
  const [opacity, setOpacity] = useState(.5), [regions, setRegions] = useState(['person']);
  const [wireframe, setWireframe] = useState(false), [normals, setNormals] = useState(false);
  const steps = track === 'avatar' ? AVATAR_STEPS : OBJECT_STEPS;
  const info = (track === 'avatar' ? avatarInfo : objectInfo)[step];
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => { if (step === steps.length - 1) setAuto(false); else setStep(step + 1); }, 7000);
    return () => clearTimeout(timer);
  }, [auto, step, steps.length]);
  const move = (amount: number) => { setAuto(false); setStep(s => Math.max(0, Math.min(steps.length - 1, s + amount))); };
  return <section className="lab-demo" aria-label="Pipeline demo"><span className="lab-eyebrow">Demo lab / cached artifacts only</span><h2>From pixels to presence.</h2><p>A look inside the models that make Village personal.</p><p role="status">{media.runtime ? "Runtime source: member-only avatar for Iraj" : "Illustrated fallback: sign in as a village member; unavailable assets use placeholders."}</p><div className="lab-tabs">{(['avatar', 'object'] as const).map(t => <button key={t} aria-pressed={track === t} onClick={() => { setTrack(t); setStep(0); setAuto(false); }}>{t === 'avatar' ? 'Image → avatar' : 'Object → mesh'}</button>)}</div><ol className="lab-steps">{steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol><div className="lab-grid"><div className="lab-stage">
    {track === 'avatar' && step < 3 && <div className="lab-photo"><DemoPhoto src={step === 1 ? media.crop ?? PLACEHOLDER : media.photo} alt={step === 1 ? 'Segmentation source crop or illustrated sample' : 'Runtime portrait or illustrated sample'} />{step === 1 && regions.map(region => media.crop && media.masks[region] ? <div key={region} className="lab-mask" style={{opacity, maskImage: `url(${media.masks[region]})`}} /> : null)}{step === 1 && media.derivedMask && <p className="lab-overlay-note">Approximate person overlay computed from the cutout; white details may be omitted.</p>}{step === 1 && (!media.crop || regions.some(r => !media.masks[r])) && <p className="lab-overlay-note">Illustrated segmentation: exact SAM masks unavailable for one or more selected regions.</p>}</div>}
    {track === 'avatar' && step === 3 && (media.chibi ? <div className="lab-chibi"><figure><DemoPhoto src={media.photo} alt="Real photo" /><figcaption>Photo</figcaption></figure><span aria-hidden="true">→</span><figure><DemoPhoto src={media.chibi} alt="Gemini chibi stylization of the photo" /><figcaption>Gemini chibi</figcaption></figure></div> : <Turntable avatar colors={media.colors} />)}
    {track === 'avatar' && step === 4 && <CachedHead headers={media.headHeaders} packageUrl={media.head} photo={media.photo} />}
    {track === 'avatar' && step === 5 && <div className="lab-voice"><DemoPhoto src={media.photo} alt="Talking head portrait or illustrated sample" />{media.audio && !audioFailed ? <audio src={media.audio} controls preload="metadata" aria-label="Iraj cached voice line" onError={() => setAudioFailed(true)} /> : <p>Illustrated talking head: cached voice unavailable.</p>}<p className="lab-note">Cached clip discovery is unavailable. This stage uses a portrait and an existing voice line when available; no new speech is generated.</p></div>}
    {track === 'object' && step < 2 && <img src={step === 0 ? '/lab/mug.jpg' : '/lab/mug-cutout.png'} alt={step === 0 ? 'Original mug photograph' : 'SAM 3 mug cutout'} />}
    {track === 'object' && step >= 2 && <Turntable wireframe={wireframe} normals={normals} village={step === 3} />}
  </div><div><span className="lab-eyebrow">Step {step + 1} / {steps.length}</span><h3 aria-live="polite">{info[0]}</h3><span className="lab-chip">{info[1]}</span><span className="lab-chip">{info[2]}</span><p>{info[3]}</p>
    {track === 'avatar' && step === 1 && <><label>Mask opacity <output>{Math.round(opacity * 100)}%</output><input type="range" min="0" max="1" step=".05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>{['person', 'hair', 'shirt'].map(r => <label key={r}><input type="checkbox" checked={regions.includes(r)} onChange={() => setRegions(old => old.includes(r) ? old.filter(x => x !== r) : [...old, r])} />{r === 'shirt' ? 'Clothes' : r === 'hair' ? 'Hair' : 'Person'}</label>)}</>}
    {track === 'avatar' && step === 2 && <div className="lab-swatches">{Object.entries(media.colors).slice(0,3).map(([part,color]) => <span key={part}><i style={{background:color}} />{part}<code>{color}</code></span>)}</div>}
    {track === 'object' && step >= 2 && <><label><input type="checkbox" checked={wireframe} onChange={e => setWireframe(e.target.checked)} />Wireframe</label><label><input type="checkbox" checked={normals} onChange={e => setNormals(e.target.checked)} />Surface normals</label></>}
    <p className="lab-note">Deployment: Modal GPU. Historical measurements: RTX 5090, docs/cv/cv004.md and cv006.md. ¹ Voice track length from cv002.md, not synthesis latency; no per-stage voice latency was recorded.</p>
  </div></div><nav className="lab-actions" aria-label="Pipeline steps"><button disabled={step === 0} onClick={() => move(-1)}>Prev</button><button aria-pressed={auto} onClick={() => { if (step === steps.length - 1) setStep(0); setAuto(!auto); }}>{auto ? 'Pause autoplay' : 'Autoplay'}</button><button className="lab-next" disabled={step === steps.length - 1} onClick={() => move(1)}>Next</button></nav></section>;
}


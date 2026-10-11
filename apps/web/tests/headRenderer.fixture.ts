/** A synthetic cartoon head exercises the real audio/expression/control integration without photos. */
import { AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { OrbitControls } from 'three-stdlib';
import type { ExprData, LamHead, MountOptions } from '../../../packages/lam-renderer/src';

export async function mountLamHead(host: HTMLElement, options: MountOptions): Promise<LamHead> {
  const renderer = new WebGLRenderer({antialias: true});
  renderer.setClearColor(options.backgroundColor === '0x121720' ? '#121720' : '#f0f3e7');
  renderer.setSize(host.clientWidth, host.clientHeight); host.append(renderer.domElement);
  const scene = new Scene(), camera = new PerspectiveCamera(45, host.clientWidth / host.clientHeight, .01, 10);
  camera.position.set(0, 1.66, .62);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.66, 0); controls.update();
  scene.add(new AmbientLight('#ffffff', 2));
  const light = new DirectionalLight('#fff2dc', 3); light.position.set(-2, 3, 4); scene.add(light);
  const sphere = (color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const mesh = new Mesh(new SphereGeometry(1, 32, 24), new MeshStandardMaterial({color, roughness: .7}));
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); scene.add(mesh); return mesh;
  };
  sphere('#ddac70', 0, 1.66, 0, .135, .175, .11);
  sphere('#252b33', -.047, 1.70, .102, .013, .017, .008);
  sphere('#252b33', .047, 1.70, .102, .013, .017, .008);
  sphere('#b97b47', 0, 1.66, .116, .016, .025, .012);
  const mouth = sphere('#5b2630', 0, 1.615, .101, .034, .006, .01);
  let audio: HTMLAudioElement | null = null, expr: ExprData | null = null;
  let raf = 0, disposed = false;
  const render = () => {
    if (disposed) return;
    const speaking = !!audio && !audio.paused && !audio.ended;
    const frame = Math.min((expr?.frames.length ?? 1) - 1, Math.floor((audio?.currentTime ?? 0) * (expr?.metadata?.fps ?? 30)));
    const jaw = expr?.frames[frame]?.weights[expr.names.indexOf('jawOpen')] ?? 0;
    mouth.scale.y = .006 + (speaking ? jaw * .055 : 0);
    renderer.domElement.dataset.jaw = String(jaw);
    renderer.domElement.dataset.expressionFrames = String(expr?.frames.length ?? 0);
    renderer.domElement.dataset.speaking = String(speaking);
    renderer.domElement.dataset.distance = camera.position.distanceTo(controls.target).toFixed(3);
    renderer.domElement.dataset.cameraX = camera.position.x.toFixed(3);
    controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(render);
  }; render();
  const observer = new ResizeObserver(() => {camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();renderer.setSize(host.clientWidth, host.clientHeight);}); observer.observe(host);
  return {setAudio(value) {audio = value;}, setExpr(value) {expr = value;}, state: () => audio && !audio.paused ? 'Responding' : 'Idle',
    _renderer: {viewer: {camera, controls}}, dispose() {disposed = true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(o => {if(o instanceof Mesh) {o.geometry.dispose();(o.material as MeshStandardMaterial).dispose();}});renderer.dispose();renderer.domElement.remove();}};
}

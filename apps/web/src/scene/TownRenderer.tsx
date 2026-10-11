import {useEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Color, DepthTexture, HalfFloatType, Mesh, MeshPhysicalMaterial, WebGLRenderTarget} from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Keep transmission and main passes in linear space. Otherwise every material
 * alternates tone-mapping/color-space programs twice per frame (PERF-002 trace).
 * OutputPass applies the renderer's existing tone mapping and color conversion once. */
export function TownRenderer({low = false}: {low?: boolean}) {
  const {gl, scene, camera, size, viewport} = useThree();
  const simplified = useMemo(() => new WeakMap<MeshPhysicalMaterial, {transmission: number; opacity: number; transparent: boolean}>(), []);
  const elapsed = useRef(1);
  useEffect(() => () => {
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        const original = simplified.get(material);
        if (original) {Object.assign(material, original); material.needsUpdate = true;}
      }
    });
  }, [scene, simplified]);
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {type: HalfFloatType, samples: 4});
    target.depthTexture = new DepthTexture(1, 1);
    const next = new EffectComposer(gl, target);
    next.addPass(new RenderPass(scene, camera));
    const output = new OutputPass();
    // Three's solid background bypasses tone mapping in the direct renderer.
    // Preserve that behavior for untouched background pixels after compositing.
    const backgroundUniforms = {tDepth: {value: next.readBuffer.depthTexture}, background: {value: new Color()}};
    Object.assign(output.uniforms, backgroundUniforms);
    output.material.fragmentShader = output.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec3 background;')
      .replace('// color space', 'if (texture2D(tDepth, vUv).r == 1.0) gl_FragColor.rgb = background;\n// color space');
    output.material.onBeforeRender = () => {
      if (scene.background instanceof Color) backgroundUniforms.background.value.copy(scene.background);
      backgroundUniforms.tDepth.value = next.readBuffer.depthTexture;
    };
    next.addPass(output);
    return next;
  }, [gl, scene, camera]);
  // The profile animates the canvas width. Keep its offscreen allocation at the
  // window width so closing it does not repeatedly recreate HDR/MSAA buffers.
  // The current camera projection is still used, then fitted to the canvas.
  const renderWidth = Math.max(size.width, window.innerWidth);
  useEffect(() => {
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(renderWidth, size.height);
  }, [composer, renderWidth, size.height, viewport.dpr]);
  useEffect(() => () => {
    composer.passes.forEach(pass => pass.dispose());
    composer.dispose();
  }, [composer]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (low && elapsed.current >= .5) {
      elapsed.current = 0;
      // Low tier avoids a second full-scene refraction pass. Use alpha glass;
      // the default tier keeps the authored physical materials untouched.
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!(material instanceof MeshPhysicalMaterial) || !material.transmission) continue;
          simplified.set(material, {transmission:material.transmission, opacity:material.opacity, transparent:material.transparent});
          material.opacity *= 1 - material.transmission;
          material.transparent = true;
          material.transmission = 0;
          material.needsUpdate = true;
        }
      });
    }
    // With refraction disabled, low quality needs only the ordinary scene pass.
    // Avoid an HDR resolve and output quad on devices already under pressure.
    if (low) {gl.setRenderTarget(null); gl.render(scene, camera);}
    else composer.render(delta);
  }, 1);
  return null;
}

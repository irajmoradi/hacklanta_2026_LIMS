import {_roots} from '@react-three/fiber';
/** Keep the real town rendering, at lower raster resolution on the software GPU.
 * HTML dialogue remains at the full viewport resolution. */
export function lowerRenderCost(){
  const canvas=document.querySelector<HTMLCanvasElement>('.scene canvas');
  if(canvas) _roots.get(canvas)?.store.getState().setDpr(.5);
}

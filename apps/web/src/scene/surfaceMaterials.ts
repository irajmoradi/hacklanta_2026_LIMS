import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';
import recipes from '../../../../assets/materials/library.json' with { type: 'json' };
import type { HouseMaterials } from './houseOptions';

const textures = new Map<string, DataTexture>();
/** Same neutral tile recipes as assets/materials/generate.py; no network dependency. */
function texture(kind: string) {
  if (textures.has(kind)) return textures.get(kind)!;
  const pixels = new Uint8Array(128*128*4);
  for (let y=0; y<128; y++) for (let x=0; x<128; x++) {
    const noise=((x*73+y*139+x*y*17)%31)/31;
    let value = .8;
    if (kind === 'wood') value=x%32<1 ? .49 : .78+.13*Math.sin(x*Math.PI*2/16+1.4*Math.sin(y*Math.PI*2/128))+.05*noise;
    else if (['brick','shingle','tile'].includes(kind)) {
      const u=(x+(Math.floor(y/32)%2)*32)%64;
      value=y%32<3 || u<3 ? kind==='shingle' ? .48 : .61 : .81+.12*noise;
      if (kind==='tile') value*=.83+.17*Math.sin(u*Math.PI/64);
    } else if (kind==='stone') value=.58+.33*noise+.06*Math.sin((x+y)*Math.PI*2/32);
    else if (kind==='metal') value=.91+.07*noise;
    const i=(y*128+x)*4; pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(value*255); pixels[i+3]=255;
  }
  const map = new DataTexture(pixels,128,128,RGBAFormat);
  map.magFilter=LinearFilter; map.minFilter=LinearMipmapLinearFilter; map.generateMipmaps=true;
  map.wrapS=map.wrapT=RepeatWrapping; map.colorSpace=SRGBColorSpace; map.needsUpdate=true;
  textures.set(kind,map); return map;
}
export function applyHouseSurface(material: MeshStandardMaterial, choices?: HouseMaterials) {
  const kind=choices?.[material.name as keyof HouseMaterials];
  if (!kind) return;
  const recipe=recipes[kind];
  material.roughness=recipe.roughness; material.metalness=recipe.metalness;
  material.map='pattern' in recipe ? texture(recipe.pattern) : null;
  material.needsUpdate=true;
}

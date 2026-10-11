import base from '../vite.config';
import { mergeConfig } from 'vite';
import { readFileSync } from 'node:fs';
const sources: Record<string,string> = JSON.parse(readFileSync(new URL('./web047-before.json',import.meta.url),'utf8'));
export default mergeConfig(base,{plugins:[{name:'web047-original-sources',enforce:'pre',load(id:string){
  const entry=Object.entries(sources).find(([suffix])=>id.replaceAll('\\','/').endsWith(suffix));
  return entry?.[1];
}}]});

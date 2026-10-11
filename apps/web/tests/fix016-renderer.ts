export async function mountLamHead(host:HTMLElement){
  await new Promise(r=>setTimeout(r,Number(new URLSearchParams(location.search).get('delay')??1800)));
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;canvas.style.cssText='width:100%;height:100%';host.append(canvas);
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#263c3b';ctx.fillRect(0,0,200,200);ctx.fillStyle='#e6bb85';ctx.beginPath();ctx.ellipse(100,95,55,70,0,0,7);ctx.fill();ctx.fillStyle='#283430';ctx.fillRect(74,76,8,9);ctx.fillRect(119,76,8,9);ctx.fillRect(90,124,22,5);
  (window as any).mounts=((window as any).mounts??0)+1;
  return {setAudio(){},setExpr(){},state:()=> 'Idle',dispose(){canvas.remove();}};
}

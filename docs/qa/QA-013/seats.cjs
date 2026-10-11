const {setup,shot,inspect,close,report,save,chromium,devices}=require('./audit.cjs');
async function main(){const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const seat of ['Lance','Stefanny','Maya','Mario']){
 for(const mobile of [false,true]){const {c,p}=await setup(b,seat,mobile?{...devices['iPhone 14'],viewport:{width:390,height:844}}:{viewport:{width:1440,height:900}});
 for(const width of mobile?[390]:[1440,1280]){if(!mobile)await p.setViewportSize({width,height:width===1440?900:720});const s={seat,width};report.steps.push(s);console.log('START',seat,width);try{
 s.town={...await inspect(p),screenshot:await shot(p,seat+'-'+width+'-town')};
 s.header=await p.locator('.topbar').evaluate(e=>[...e.querySelectorAll('button,select')].map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label')||b.textContent,rect:r.toJSON(),hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}));await p.getByRole('button',{name:/^Members,/}).click();s.members=await inspect(p);await close(p);
 await p.getByRole('button',{name:'Check in',exact:true}).click();await p.locator('.scene-choices').waitFor();s.checkin=await inspect(p);await close(p);
 await p.getByRole('button',{name:'My profile',exact:true}).click();await p.getByRole('tab',{name:'Accomplishments',exact:true}).click();s.accomplishments=await inspect(p);s.profileClose=await p.getByRole('button',{name:'Close profile',exact:true}).evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {color:s.color,opacity:s.opacity,background:s.backgroundColor,disabled:e.disabled,rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}});
 if(width===(seat==='Lance'?1440:seat==='Stefanny'?1280:390)){await p.getByRole('tab',{name:'House',exact:true}).click();await p.getByRole('button',{name:'Go inside',exact:true}).click();await p.locator('[data-interior-walk]').waitFor();await p.waitForTimeout(500);s.interior={...await inspect(p),screenshot:await shot(p,seat+'-'+width+'-interior')};await p.getByRole('button',{name:'Decorate',exact:true}).click();s.decor=await inspect(p);await p.getByRole('button',{name:'Cancel decor',exact:true}).click();await p.getByRole('button',{name:'Back to village',exact:true}).click();}
 await close(p);s.status='observed';}catch(e){s.status='harness-error';s.error=e.message.slice(0,1000);s.screenshot=await shot(p,seat+'-'+width+'-seat-failure').catch(()=>null);await close(p)}save();console.log('END',seat,width,s.status)}await c.close();}
}
await b.close();report.finished=new Date().toISOString();save();if(report.steps.some(s=>s.status==='harness-error'))process.exitCode=1;}
main().catch(e=>{console.error(e);save();process.exit(1)});

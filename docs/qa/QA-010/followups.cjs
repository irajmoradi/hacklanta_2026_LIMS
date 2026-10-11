// Recheck the settings save with identity pinned after the seat transition.
const {chromium,expect}=require(process.env.QA_PLAYWRIGHT||'C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');
async function checkNewHouseFields(seat,index){
 const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(30000);
 const uid=`13370000-0000-4000-8000-00000000000${index}`,vid='13370000-0000-4000-8000-000000000000',log={seat,blocked:[]};let restore;
 const keys=['village_id','house_style','house_colors','house_variant','house_materials'];
 await p.route('**/api/**',route=>{const r=route.request(),url=new URL(r.url()).pathname;let body;try{body=r.postDataJSON()}catch{}const appearance=url==='/api/me'&&r.method()==='PATCH'&&r.headers()['x-demo-user']===uid&&body&&Object.keys(body).every(k=>keys.includes(k));if(['GET','HEAD','OPTIONS'].includes(r.method())||/\/demo\/seat$|\/presence\/heartbeat$/.test(url)||appearance)return route.continue();log.blocked.push(url);return route.abort('blockedbyclient');});
 try{
  await p.goto('http://127.0.0.1:4173');await p.locator('.demo-seat-grid button').filter({hasText:seat}).click();await expect(p.getByLabel('Play as')).toHaveValue(uid,{timeout:30000});
  const person=await p.evaluate(async({uid,vid})=>(await(await fetch(`/api/villages/${vid}`,{headers:{'X-Demo-User':uid}})).json()).villagers.find(v=>v.user_id===uid),{uid,vid});restore={village_id:vid,...Object.fromEntries(keys.filter(k=>k!=='village_id').map(k=>[k,person[k]??null]))};log.original=restore;
  await p.getByRole('button',{name:'My profile',exact:true}).click();await p.getByRole('tab',{name:'House',exact:true}).click();await p.getByRole('button',{name:'Modern',exact:true}).click();await p.getByRole('button',{name:'Preset palette 2',exact:true}).click();const response=p.waitForResponse(r=>r.url().endsWith('/api/me')&&r.request().method()==='PATCH'),start=Date.now();await p.getByRole('button',{name:'Save house',exact:true}).click();log.http=(await response).status();await p.getByText('House saved. Welcome home!',{exact:true}).waitFor();log.interactionMs=Date.now()-start;log.result='pass';await p.screenshot({path:path.join(__dirname,`${seat}-house-verified.png`),style:'img,.portrait canvas,[data-lam-host]{visibility:hidden!important}'});
 }finally{if(restore)log.restoreStatus=await p.evaluate(async({uid,restore})=>(await fetch('/api/me',{method:'PATCH',headers:{'X-Demo-User':uid,'Content-Type':'application/json'},body:JSON.stringify(restore)})).status,{uid,restore});fs.writeFileSync(path.join(__dirname,`${seat}-house-results.json`),JSON.stringify(log,null,2));await b.close();}
 console.log(log);
}
async function checkStefannyGoal(){
 const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(20000);
 const uid='13370000-0000-4000-8000-000000000003',log={failures:[],blocked:[]};
 await p.route('**/api/**',route=>{const r=route.request(),url=new URL(r.url()).pathname;if(['GET','HEAD','OPTIONS'].includes(r.method())||/\/demo\/seat$|\/presence\/heartbeat$/.test(url)||(url.endsWith('/goals')&&r.method()==='POST'&&r.headers()['x-demo-user']===uid))return route.continue();log.blocked.push(url);return route.abort('blockedbyclient');});
 p.on('requestfailed',r=>log.failures.push({method:r.method(),url:new URL(r.url()).pathname,error:r.failure()?.errorText}));
 try{
  await p.goto('http://127.0.0.1:4173');await p.locator('.demo-seat-grid button').filter({hasText:'Stefanny'}).click();await expect(p.getByLabel('Play as')).toHaveValue(uid,{timeout:25000});await p.getByRole('button',{name:'My goal',exact:true}).click();
  const before=await p.locator('#goal-title').inputValue();if(!before)throw Error('Refusing to create a new goal');const start=Date.now(),response=p.waitForResponse(r=>r.url().endsWith('/goals')&&r.request().method()==='POST');await p.getByRole('button',{name:'Save my goal',exact:true}).click();log.http=(await response).status();await expect(p.locator('#goal-title')).toHaveCount(0,{timeout:20000});log.interactionMs=Date.now()-start;log.result='pass';
  await p.screenshot({path:path.join(__dirname,'Stefanny-goal-retry.png'),style:'img,.portrait canvas,[data-lam-host]{visibility:hidden!important}'});
 }finally{fs.writeFileSync(path.join(__dirname,'goal-retry-results.json'),JSON.stringify(log,null,2));await b.close();}
 console.log(log);
}
(async()=>{
 if(process.env.QA_FOLLOWUP==='house')return await checkNewHouseFields('Maya',4);
 const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}});
 p.setDefaultTimeout(20000);const uid='13370000-0000-4000-8000-000000000002';let original;
 const log={blocked:[],identity:null};
 await p.route('**/api/**',async route=>{const r=route.request(),url=new URL(r.url()).pathname;let body;try{body=r.postDataJSON()}catch{}
  const privacy=['display_name','phone_e164','roast_ok','agent_msgs_ok','allow_voice_by_friends','receive_villagergrams'];
  const settings=url==='/api/me'&&r.method()==='PATCH'&&r.headers()['x-demo-user']===uid&&original&&Object.keys(body).every(k=>['idle_activity',...privacy].includes(k))&&privacy.every(k=>!(k in body)||(body[k]??null)===(original[k]??null));
  if(['GET','HEAD','OPTIONS'].includes(r.method())||/\/demo\/seat$|\/presence\/heartbeat$/.test(url)||settings)return route.continue();
  log.blocked.push({method:r.method(),url});return route.abort('blockedbyclient');
 });
 try{
  await p.goto('http://127.0.0.1:4173');await p.locator('.demo-seat-grid button').filter({hasText:'Lance'}).click();await expect(p.getByLabel('Play as')).toHaveValue(uid,{timeout:25000});log.identity=await p.getByLabel('Play as').inputValue();
  original=await p.evaluate(async uid=>(await(await fetch('/api/me',{headers:{'X-Demo-User':uid}})).json()).user,uid);
  await p.getByRole('button',{name:'Open Settings',exact:true}).click();await p.locator('.idle-picker select').selectOption(original.idle_activity==='reading'?'home':'reading');const start=Date.now();const post=p.waitForResponse(r=>r.url().endsWith('/api/me')&&r.request().method()==='PATCH');await p.getByRole('button',{name:'Save settings',exact:true}).click();log.http=(await post).status();await p.getByText('Settings saved.',{exact:true}).waitFor();log.interactionMs=Date.now()-start;
  await p.screenshot({path:path.join(__dirname,'Lance-settings-verified.png'),style:'img,.portrait canvas,[data-lam-host],input[type="tel"]{visibility:hidden!important}'});
  await p.getByRole('button',{name:'Close dialog',exact:true}).click();await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(__dirname,'Lance-deep-mobile-town.png'),style:'img,.portrait canvas,[data-lam-host]{visibility:hidden!important}'});
  log.result='pass';
 }finally{
  if(original){log.restoreStatus=await p.evaluate(async({uid,idle})=>(await fetch('/api/me',{method:'PATCH',headers:{'X-Demo-User':uid,'Content-Type':'application/json'},body:JSON.stringify({idle_activity:idle})})).status,{uid,idle:original.idle_activity??'home'});}
  fs.writeFileSync(path.join(__dirname,'lance-settings-results.json'),JSON.stringify(log,null,2));await b.close();
 }
 console.log(log);
 await checkStefannyGoal();
 await checkNewHouseFields('Maya',4);
})().catch(e=>{console.error(e);process.exitCode=1;});

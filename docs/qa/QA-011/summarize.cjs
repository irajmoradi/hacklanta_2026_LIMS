const fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const exists=name=>fs.existsSync(path.join(__dirname,name));
const audit=read('desktop-main.json');
const mario=exists('screenshots/mario-results.json')?read('screenshots/mario-results.json'):null;
const attempts=[...audit.steps,...(mario?.steps||[])];
const latest=new Map();for(const s of attempts)latest.set(`${s.seat}:${s.width}:${s.stage}`,s);
const steps=[...latest.values()],network=[...audit.network,...(mario?.network||[])],logs=[...audit.console,...(mario?.console||[])];
const summary={started:audit.started,completionFinished:mario?.finished,attemptedStages:attempts.length,distinctStages:steps.length,seats:[...new Set(steps.map(s=>s.seat))],coverage:Object.fromEntries([...new Set(steps.map(s=>s.seat))].map(seat=>[seat,{stages:steps.filter(s=>s.seat===seat).length,failures:steps.filter(s=>s.seat===seat&&s.status==='failed').map(s=>({width:s.width,stage:s.stage,error:s.error}))}])),escapeSnapshots:steps.filter(s=>s.escapeClosed===false).map(s=>({seat:s.seat,width:s.width,stage:s.stage})),focusFailures:steps.filter(s=>s.focusReturned===false).map(s=>({seat:s.seat,width:s.width,stage:s.stage})),slowOpens:steps.filter(s=>s.openMs>1000).map(s=>({seat:s.seat,width:s.width,stage:s.stage,ms:s.openMs})),httpErrors:network.filter(n=>n.status>=400),failedRequests:network.filter(n=>n.failure),consoleErrors:logs.filter(c=>c.type==='error'),pageErrors:logs.filter(c=>c.type==='pageerror'),blocked:[...audit.blocked,...(mario?.blocked||[])]};
for(const [key,file] of [['details','details.json'],['detailsRest','details-rest.json'],['detailsFinal','details-final.json'],['followups','followups.json']])if(exists('screenshots/'+file)){const d=read('screenshots/'+file);summary[key]={stages:d.steps.length,failures:d.steps.filter(s=>s.status==='failed'),errors:d.errors,blocked:d.blocked,purchases:d.purchases,purchaseResponses:d.purchaseResponses};}
if(exists('screenshots/toasts.json'))summary.toasts=read('screenshots/toasts.json');
fs.writeFileSync(path.join(__dirname,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({distinctStages:summary.distinctStages,coverage:summary.coverage,slowOpens:summary.slowOpens,details:summary.details,detailsRest:summary.detailsRest,followups:summary.followups,toasts:summary.toasts}));

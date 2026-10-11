const {spawnSync}=require('node:child_process');
for(const file of ['audit.cjs','performance.cjs']) {
 const r=spawnSync(process.execPath,['../../docs/qa/QA-012/'+file],{stdio:'inherit'});
 console.log(file+' exit='+r.status);
 if(r.status!==0)process.exitCode=1;
}

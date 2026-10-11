const {spawnSync}=require('node:child_process');
for(const [file,result] of [['cafe.cjs','cafe.json'],['dismissal.cjs','dismissal.json']]){const r=spawnSync(process.execPath,['../../docs/qa/QA-013/'+file],{stdio:'inherit',env:{...process.env,QA_RESULT:result,QA_FAST:'1'}});console.log(file+' exit='+r.status);if(r.status!==0)process.exitCode=1;}

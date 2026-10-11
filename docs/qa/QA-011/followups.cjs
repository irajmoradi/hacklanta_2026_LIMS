const {spawnSync}=require('node:child_process');const path=require('node:path');
let failed=false;
for(const [file,extra] of [['details.cjs',{QA_SEATS:'Iraj,Lance',QA_STEPS:'arena,profile-details,chorus-readiness,catalog-render',QA_OUTPUT:'followups.json'}],['toasts.cjs',{}]]){
 const r=spawnSync(process.execPath,[path.join(__dirname,file)],{env:{...process.env,...extra},stdio:'inherit'});if(r.status!==0)failed=true;
}
process.exitCode=failed?1:0;

// Invoke from apps/web on the RTX host. Test execution stays on the configured runner.
// The ephemeral Playwright endpoint travels only in process env and encrypted SSH stdin.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const ip=process.env.RUNNER_IP || readFileSync('../../docs/infra/runner.env','utf8').match(/^RUNNER_IP=(.+)$/m)?.[1].trim();
if(!ip || !/^[A-Za-z0-9.:-]+$/.test(ip))throw new Error('Configure RUNNER_IP');
const key=process.env.RUNNER_SSH_KEY || join(homedir(),'.ssh/village_vultr');
const ssh=process.platform==='win32'?'C:/Program Files/Git/usr/bin/ssh.exe':'ssh';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const integ018=process.env.PERF_INTEG==='018';
const ports=integ018?[16474,16475,16477,16487,16497]:[15474,15475,15477,15487,15497];
const browserPort=integ018?16499:15499;
let tunnel, command;
const server=await chromium.launchServer({headless:false,host:'127.0.0.1',port:browserPort,args:['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try {
  const probe=await chromium.connect(server.wsEndpoint());
  try {
    const page=await probe.newPage();
    const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
    if(!renderer.includes('RTX 5090'))throw new Error('The hardware suite requires RTX 5090');
    const artifactDir=integ018?'artifacts/integ018':'artifacts/integ015';
    mkdirSync(artifactDir,{recursive:true});
    writeFileSync(`${artifactDir}/hardware-host.json`,JSON.stringify({renderer,headed:true,syntheticCamera:true,driver:'remote runner'},null,2));
    console.log(`Verified renderer: ${renderer}`);
  } finally {await probe.close();}
  tunnel=spawn(ssh,['-i',key,'-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3',
    ...ports.flatMap(port=>['-L',`${port}:127.0.0.1:${port}`]),'-R',`${browserPort}:127.0.0.1:${browserPort}`,`runner@${ip}`,'-N'],{stdio:['ignore','inherit','inherit'],windowsHide:true});
  let tunnelFailure; tunnel.on('error',error=>{tunnelFailure=error;});
  await delay(2000);
  if(tunnelFailure || tunnel.exitCode!==null)throw tunnelFailure || new Error('SSH forwarding failed');
  console.log('Headed GPU browser ready; starting tests through the remote wrapper.');
  command=spawn(bash,['../../ops/remote_run.sh','--env','PW_TEST_CONNECT_WS_ENDPOINT','bunx','playwright','test','--config',integ018?'playwright.integ018.config.ts':'playwright.integ015-hardware.config.ts',...process.argv.slice(2)],
    {stdio:'inherit',windowsHide:true,env:{...process.env,PW_TEST_CONNECT_WS_ENDPOINT:server.wsEndpoint()}});
  process.exitCode=await new Promise((resolve,reject)=>{command.on('error',reject);command.on('exit',code=>resolve(code??1));});
} finally {
  if(command && command.exitCode===null)command.kill();
  tunnel?.kill();
  await server.close();
}

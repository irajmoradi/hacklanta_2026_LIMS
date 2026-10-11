// Serve a captured production build locally; API is deliberately unavailable.
import {createServer} from 'node:http';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]), port=Number(process.argv[3] || 5186);
const compressed=process.argv[4]==='gzip';
const publicRoot=resolve('public');
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"ok":false}');return;}
 const base=url.pathname.startsWith('/models/')?publicRoot:root;
 let path=resolve(base,'.'+decodeURIComponent(url.pathname));
 if(!path.startsWith(base+sep)){path=resolve(root,'index.html');}
 if(!existsSync(path)||!statSync(path).isFile()){const asset=resolve(publicRoot,'.'+url.pathname);path=asset.startsWith(publicRoot+sep)&&existsSync(asset)&&statSync(asset).isFile()?asset:resolve(root,'index.html');}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml','.json':'application/json'};
 let data=readFileSync(path);
 const headers={'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'};
 if(compressed&&/\.(js|css|glb|json|svg)$/.test(path)){
  headers.Vary='Accept-Encoding';
  if(url.pathname.startsWith('/assets/')||url.searchParams.has('v'))headers['Cache-Control']='public, max-age=31536000, immutable';
  if(req.headers['accept-encoding']?.includes('gzip')){data=gzipSync(data,{level:9});headers['Content-Encoding']='gzip';}
 }
 headers.ETag='W/\"'+createHash('sha1').update(data).digest('hex')+'\"';
 if(req.headers['if-none-match']===headers.ETag){res.writeHead(304,headers);res.end();return;}
 headers['Content-Length']=String(data.length);res.writeHead(200,headers);res.end(data);
}).listen(port,'127.0.0.1',()=>console.log(`Fixture-only production server on ${port}`));

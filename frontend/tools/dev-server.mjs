/** Lightweight Vite-free frontend development server. Node.js built-ins only. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
await import('./build.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist=path.join(root,'dist');
const port=Number(process.env.ILS_FRONTEND_PORT || 5173);
const api=process.env.ILS_API_ORIGIN || 'http://127.0.0.1:8000';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/',`http://127.0.0.1:${port}`);
  if(u.pathname.startsWith('/api/')) {
    try {
      const chunks=[];
      for await(const c of req)chunks.push(c);
      const result=await fetch(api+u.pathname+u.search,{method:req.method,headers:{'content-type':req.headers['content-type']||'application/json','x-ils-role':req.headers['x-ils-role']||'PROGRAMME_REVIEWER'},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
      res.writeHead(result.status,{'content-type':result.headers.get('content-type')||'application/json'});
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch(e){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({detail:'FastAPI unavailable. Start uvicorn on port 8000 first.'}));}
    return;
  }
  const target=path.resolve(dist,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!target.startsWith(dist+path.sep)&&target!==path.join(dist,'index.html')){res.writeHead(403);res.end();return;}
  try{
    const st=fs.statSync(target);
    if(!st.isFile())throw Error('not file');
    res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-cache'});
    fs.createReadStream(target).pipe(res);
  }catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`ILS Vite-free frontend: http://127.0.0.1:${port} (API proxy: ${api})`));

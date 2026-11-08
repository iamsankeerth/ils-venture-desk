/**
 * Dependency-free ILS frontend build, without Vite or npm packages.
 * Converts source JSX to browser-ready JavaScript using vendored TypeScript,
 * bundles the project's own modules, and generates Tailwind utility CSS.
 * Run: node frontend/tools/build.mjs (or cd frontend && npm run build).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const dist = path.join(root, 'dist');
const vendor = path.join(root, 'tools', 'vendor');
const ts = require(path.join(vendor, 'typescript.js'));
const tw = require(path.join(vendor, 'tailwind-compiler.js'));

function allFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const absolute = path.join(dir, e.name);
    return e.isDirectory() ? allFiles(absolute) : [absolute];
  });
}
const sourceFiles = allFiles(sourceRoot);
fs.mkdirSync(dist, {recursive:true});
fs.mkdirSync(path.join(dist,'vendor'), {recursive:true});

// All JSX modules import the compatible React facade, not a runtime CDN.
let bundle = `/* ILS Venture Desk: dependency-free offline bundle */\n(function(){\n'use strict';\nconst modules = Object.create(null);\nconst cache = Object.create(null);\nfunction load(id, from) {\n if (id==='react') return window.ILSReactCompat;\n if (id==='react-dom/client') return {createRoot:(el)=>({render:(v)=>window.ReactDOM.render(v,el),unmount:()=>window.ReactDOM.unmountComponentAtNode(el)})};\n if (id==='lucide-react') return window.ILSLucideLite;\n if (id.endsWith('.css')) return {};\n let key = id;\n if (id.startsWith('.')) {\n   const bits = from.split('/').slice(0,-1).concat(id.split('/'));\n   const clean = [];\n   for(const b of bits){if(b==='.'||b==='')continue; if(b==='..') clean.pop(); else clean.push(b);}\n   key=clean.join('/');\n }\n if(!modules[key] && modules[key+'.js']) key+='.js';\n if(!modules[key] && modules[key+'.jsx']) key+='.jsx';\n if(!modules[key]) throw Error('Missing frontend module: '+key+' (from '+from+')');\n if(cache[key]) return cache[key].exports;\n const m={exports:{}}; cache[key]=m;\n modules[key](m,m.exports,(name)=>load(name,key));\n return m.exports;\n}\n`;
let jsCount = 0;
for (const filename of sourceFiles.filter(f=>/\.(jsx|js)$/.test(f))) {
  const key = path.relative(root, filename).split(path.sep).join('/');
  let contents = fs.readFileSync(filename,'utf8');
  if(filename.endsWith('.jsx')) contents = `import * as React from 'react';\n` + contents;
  const { outputText, diagnostics } = ts.transpileModule(contents, {fileName:key,reportDiagnostics:true,compilerOptions:{
    target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,
    jsxFactory:'React.createElement', jsxFragmentFactory:'React.Fragment',
    esModuleInterop:true, allowJs:true, isolatedModules:true
  }});
  const errors = (diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length) throw new Error(key+': '+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('; '));
  bundle += `modules[${JSON.stringify(key)}]=function(module,exports,require){\n${outputText}\n};\n`;
  jsCount++;
}
bundle += `load('src/main.jsx', 'src/main.jsx');\n})();\n`;
fs.writeFileSync(path.join(dist, 'app.bundle.js'), bundle);

const base = fs.readFileSync(path.join(sourceRoot,'styles.css'),'utf8');
const theme = fs.readFileSync(path.join(vendor,'tailwind-theme.css'),'utf8');
const preflight = fs.readFileSync(path.join(vendor,'tailwind-preflight.css'),'utf8');
const custom = base.replace(/@import\s+url\([^\n]*\);\s*/g,'').replace(/@import\s+["']tailwindcss["'];?/g,'');
const cssSource = theme+'\n'+preflight+'\n@tailwind utilities;\n'+custom;
const twCompile = await tw.compile(cssSource);
const rawSource = sourceFiles.filter(f=>/\.(jsx|js)$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
// Request generated rules only for utility candidates present in source strings.
const candidates = [...new Set(rawSource.match(/[!@\w\-\/#%\.\[\]:]+/g) || [])];
const outputCSS = twCompile.build(candidates);
fs.writeFileSync(path.join(dist,'styles.css'),outputCSS);

for (const fname of ['react16.min.js','react-dom16.min.js','react-hooks-compat.js','lucide-lite.js']) {
  fs.copyFileSync(path.join(vendor,fname),path.join(dist,'vendor',fname));
}
// Vendored React bundles are React 16 MIT; retain runtime/version notices.
const publicDir=path.join(root,'public');
if(fs.existsSync(publicDir)) for (const f of allFiles(publicDir)){
  const dest = path.join(dist,path.relative(publicDir,f));
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(f,dest);
}
const html=`<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ILS Venture Desk</title><link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./styles.css"></head>\n<body><div id="root"></div>\n<script src="./vendor/react16.min.js"></script>\n<script src="./vendor/react-dom16.min.js"></script>\n<script src="./vendor/react-hooks-compat.js"></script>\n<script src="./vendor/lucide-lite.js"></script>\n<script src="./app.bundle.js"></script>\n</body></html>\n`;
fs.writeFileSync(path.join(dist, 'index.html'),html);
console.log(`ILS offline build complete: ${jsCount} JS modules; ${candidates.length} candidate utilities; ${(outputCSS.length/1024).toFixed(0)} KiB CSS; ${(bundle.length/1024).toFixed(0)} KiB JS.`);

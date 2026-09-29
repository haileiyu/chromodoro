// Local-only store asset preview. No demo code or data is packaged in the extension.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `
import { initialState, dayKey, toggle, validateSettings } from '/timer.js';
const state = initialState();
for (let i=350; i>=0; i--) {
  const date = new Date(); date.setDate(date.getDate()-i);
  if (date.getDay()===0 || (i*17)%11<3) continue;
  const count = 1+(i*7)%8; state.days[dayKey(date)]={count,minutes:count*25};
}
state.lastCompletion = {id:'demo',phase:'focus',endedAt:Date.now(),minutes:25};
state.nextPhase='shortBreak';
window.chrome = {
  runtime: {async sendMessage(message) {
    if (message.type==='settings') state.settings=validateSettings(message.settings);
    if (message.type==='toggle') toggle(state);
    if (message.type==='startFocus') {state.timer=null;state.nextPhase='focus';toggle(state);}
    return {ok:true,state:structuredClone(state)};
  }}
};
await import('/'+document.body.dataset.page+'.js');
`;
http.createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/store-fixture.js') {
      response.setHeader('Content-Type','text/javascript'); response.end(fixture); return;
    }
    const relative = pathname.slice(1);
    if (!/^(?:[a-z-]+\.(?:html|js|css)|icons\/icon\d+\.png|store\/(?:promo|history-screenshot|settings-screenshot)\.html)$/.test(relative)) {
      response.writeHead(404); response.end(); return;
    }
    let body = await readFile(join(root, relative));
    response.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.gs':'text/plain'}[extname(relative)]);
    if (['history.html','options.html','alert.html'].includes(relative)) {
      const page = relative.replace('.html','');
      body = body.toString().replace(`<script type="module" src="${page}.js"></script>`, '<script type="module" src="/store-fixture.js"></script>').replace('<body>',`<body data-page="${page}">`);
    }
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
}).listen(8137,'127.0.0.1',()=>console.log('Store preview: http://127.0.0.1:8137/store/history-screenshot.html'));

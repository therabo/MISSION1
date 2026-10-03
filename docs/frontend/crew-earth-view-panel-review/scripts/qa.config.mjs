// Disposable QA server only. Never imported by the application or production build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from '../../../../frontend/node_modules/vite/dist/node/index.js';
import base from '../../../../frontend/vite.config.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.resolve(directory, '../../../crew/rest-api-validation/crew-response.json')));
const person = JSON.parse(fs.readFileSync(path.resolve(directory, '../../../crew/rest-api-validation/person-response.json')));
const observer = fs.readFileSync(path.join(directory, 'observer.js'), 'utf8');
const attempts = new Map();

export default mergeConfig(base, {
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
  plugins: [{
    name: 'disposable-crew-qa',
    transformIndexHtml(html) { return html.replace('<head>', `<head><script>${observer}</script>`); },
    transform(code, id) {
      // Read-only viewer observation; the checked-in EarthView source stays byte-identical.
      if (id.endsWith('/src/cesium/EarthView.tsx')) return code.replace('viewer.current = instance;', "viewer.current = instance; document.dispatchEvent(new CustomEvent('crew-qa-viewer', {detail: instance}));");
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        const state = url.searchParams.get('crewQa');
        if (!state || !url.pathname.startsWith('/api/iss/crew')) return next();
        response.setHeader('content-type', 'application/json');
        const attemptKey = `${state}:${url.pathname}`;
        attempts.set(attemptKey, (attempts.get(attemptKey) ?? 0) + 1);
        if (state === 'API_503' || (state === 'API_503_ONCE' && attempts.get(attemptKey) === 1) || (state.startsWith('DETAIL_') && url.pathname !== '/api/iss/crew')) {
          response.statusCode = state.startsWith('API_503') ? 503 : Number(state.slice(7));
          return response.end(JSON.stringify({code:'QA_FIXTURE_ERROR'}));
        }
        if (url.pathname !== '/api/iss/crew') return response.end(JSON.stringify(person));
        const data = structuredClone(fixture);
        if (state !== 'SLOW' && !state.startsWith('DETAIL_') && !state.startsWith('API_')) data.reconciliation.status = state;
        if (['STALE', 'PRIMARY_UNAVAILABLE', 'VERIFICATION_UNAVAILABLE'].includes(state)) {
          if(state !== 'PRIMARY_UNAVAILABLE') data.counts.officialAboard = null;
          data.freshness.stale = state === 'STALE';
          data.freshness.structuredSource.stale = state === 'STALE';
          data.freshness.verification.stale = state === 'STALE';
          if (state === 'PRIMARY_UNAVAILABLE') data.freshness.structuredSource.lastRefreshFailed = true;
          if (state === 'VERIFICATION_UNAVAILABLE') data.freshness.verification.lastRefreshFailed = true;
          if(state !== 'PRIMARY_UNAVAILABLE') {
            data.counts.resolvedAboard = 0; data.counts.unidentifiedAboard = data.counts.lastKnownOfficialAboard;
            for(const member of data.members) { member.presence.lastKnownState = member.presence.state; member.presence.state = state === 'STALE' ? 'STALE' : 'UNVERIFIED'; }
          }
        }
        const respond = () => response.end(JSON.stringify(data));
        if (state === 'SLOW') setTimeout(respond, 1800); else respond();
      });
    },
  }],
});

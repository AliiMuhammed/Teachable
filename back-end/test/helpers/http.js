'use strict';
const http = require('node:http');
async function withHttp(app, run) {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
      headers = { 'content-type': 'application/json', ...headers }; body = JSON.stringify(body);
    }
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers, body });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  };
  try { return await run(request); }
  finally { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
module.exports = { withHttp };

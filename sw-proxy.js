// Service Worker 代理脚本
let targetUrl = '';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SET_TARGET_URL') {
    targetUrl = event.data.url;
    console.log('目标URL已设置:', targetUrl);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/proxy/') || url.pathname === '/proxy') {
    event.respondWith(handleProxyRequest(event.request));
  }
});

async function handleProxyRequest(request) {
  if (!targetUrl) {
    return new Response('目标URL未设置', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    const originalUrl = new URL(request.url);
    const targetUrlObj = new URL(targetUrl);
    
    let proxyUrl = targetUrl;
    if (originalUrl.pathname !== '/proxy/' && originalUrl.pathname !== '/proxy') {
      const path = originalUrl.pathname.replace('/proxy/', '').replace('/proxy', '');
      proxyUrl = targetUrl.replace(/\/$/, '') + '/' + path + originalUrl.search;
    }

    const proxyHeaders = new Headers();
    for (let [key, value] of request.headers) {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        proxyHeaders.set(key, value);
      }
    }

    const proxyRequest = new Request(proxyUrl, {
      headers: proxyHeaders,
      method: request.method,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
      redirect: 'manual'
    });

    const response = await fetch(proxyRequest);
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    let body = await response.text();
    
    if (responseHeaders.get('content-type')?.includes('text/html')) {
      body = body.replace(
        new RegExp(targetUrlObj.origin, 'g'),
        self.location.origin + '/proxy/'
      );
      
      body = body.replace(
        /<head(.*?)>/i,
        `<head$1><base href="${self.location.origin}/proxy/"><meta name="referrer" content="no-referrer">`
      );
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(`代理错误: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

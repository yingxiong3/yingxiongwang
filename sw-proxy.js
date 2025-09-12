// Service Worker 代理脚本
let targetUrl = '';

self.addEventListener('install', (event) => {
  debugLog('Service Worker 安装中...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  debugLog('Service Worker 激活中...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SET_TARGET_URL') {
    targetUrl = event.data.url;
    debugLog('目标URL已设置: ' + targetUrl);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  debugLog('拦截请求: ' + url.pathname);
  
  // 拦截所有请求
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (!targetUrl) {
    debugLog('错误：目标URL未设置');
    return new Response('目标URL未设置', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    const originalUrl = new URL(request.url);
    
    // 如果是根路径，直接代理到目标URL
    if (originalUrl.pathname === '/' || originalUrl.pathname === '/yingxiongwang/') {
      debugLog('代理根路径到: ' + targetUrl);
      return fetch(targetUrl);
    }

    // 构建代理URL
    let proxyUrl = targetUrl;
    if (originalUrl.pathname !== '/' && !originalUrl.pathname.includes('ink.htm')) {
      const targetUrlObj = new URL(targetUrl);
      const path = originalUrl.pathname;
      proxyUrl = targetUrlObj.origin + path + originalUrl.search;
    }

    debugLog('代理请求: ' + request.url + ' -> ' + proxyUrl);

    const proxyHeaders = new Headers();
    for (let [key, value] of request.headers) {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        proxyHeaders.set(key, value);
      }
    }

    // 添加一些基本头信息
    proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    proxyHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    proxyHeaders.set('Accept-Language', 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3');

    const proxyRequest = new Request(proxyUrl, {
      headers: proxyHeaders,
      method: request.method,
      redirect: 'follow'
    });

    const response = await fetch(proxyRequest);
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    // 获取响应内容
    const buffer = await response.arrayBuffer();
    
    return new Response(buffer, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    debugLog('代理错误: ' + error.message);
    return new Response(`代理错误: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

function debugLog(message) {
  console.log('[SW] ' + message);
}

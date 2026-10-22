import { createBrowserStore } from './browser-store.mjs';

// Classic-script bundle for file://, where fetch(file://) and module imports fail.
// HTTP/HTTPS keeps the normal lazy module and data loading path.
if (location.protocol === 'file:') {
  const data = window.POKETOUR_FILE_DATA;
  delete window.POKETOUR_FILE_DATA;
  const base = new URL('./', document.baseURI);
  const networkFetch = globalThis.fetch.bind(globalThis);
  const fileFetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI);
    if (url.protocol !== 'file:') return networkFetch(input, options);
    const name = decodeURIComponent(url.pathname.slice(base.pathname.length));
    if (!url.pathname.startsWith(base.pathname) || !Object.hasOwn(data, name)) return new Response('Local data not found', { status: 404 });
    return new Response(data[name], { headers: { 'Content-Type': 'application/json' } });
  };
  globalThis.fetch = fileFetch;
  window.PoketourFileRuntime = {
    createBrowserStore: (options = {}) => createBrowserStore({ ...options, baseUrl: base, fetcher: fileFetch }),
  };
}

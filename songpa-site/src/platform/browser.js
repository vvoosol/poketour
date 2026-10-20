'use strict';
window.createPoketourPlatform = function createPoketourPlatform(overrides = {}) {
  const config = overrides.config || window.POKETOUR_CONFIG || {};
  const fetcher = overrides.fetch || ((...args) => fetch(...args));
  const geolocation = Object.hasOwn(overrides, 'geolocation') ? overrides.geolocation : globalThis.navigator?.geolocation;
  const lifecycleDocument = overrides.document || document;
  const lifecycleWindow = overrides.window || window;
  const base = (config.apiBaseUrl || '').replace(/\/$/, '');
  if (base && (!/^https:\/\//.test(base) || new URL(base).username || new URL(base).password)) throw Error('API base URL must use HTTPS without embedded credentials.');
  return {
    apiFetch(path, options) {
      if (!path.startsWith('/api/')) throw Error('Expected an API path');
      return fetcher(base + path, options);
    },
    assets: { fetch: (path, options) => fetcher('./' + path, options) },
    auth: {
      loginUrl: config.auth?.loginUrl || '/signin-with-chatgpt?return_to=%2F',
      loginLabel: config.auth?.loginLabel || 'ChatGPT로 로그인',
    },
    location: {
      available: !!geolocation,
      watchPosition: (...args) => geolocation?.watchPosition(...args),
      clearWatch: id => geolocation?.clearWatch(id),
    },
    lifecycle: {
      onResume(callback) {
        const handler = () => { if (!lifecycleDocument.hidden) callback(); };
        lifecycleDocument.addEventListener('visibilitychange', handler);
        return () => lifecycleDocument.removeEventListener('visibilitychange', handler);
      },
      onPageHide(callback) { lifecycleWindow.addEventListener('pagehide', callback); },
    },
  };
};
window.PoketourPlatform = window.createPoketourPlatform();

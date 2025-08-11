export function logAsyncErrors() {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[async] unhandledrejection', e.reason);
  });
  window.addEventListener('error', (e) => {
    if (e.error) console.error('[async] error', e.error);
  });
}
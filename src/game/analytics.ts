declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let gaInitialized = false;

export function initAnalytics(): void {
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!gaId || gaInitialized) return;

  gaInitialized = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', gaId, {
    page_title: document.title,
    page_location: window.location.href,
  });
}

export function trackGameEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GA_MEASUREMENT_ID?.trim());
}

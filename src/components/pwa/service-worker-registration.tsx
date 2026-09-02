"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    workbox: { register: () => void };
  }
}

async function clearDevServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      void clearDevServiceWorkers();
      return;
    }

    if ("serviceWorker" in navigator && window.workbox !== undefined) {
      window.workbox.register();
    }
  }, []);

  return null;
}

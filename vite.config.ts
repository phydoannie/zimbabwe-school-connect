// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    strategies: 'generateSW',
    outDir: 'dist/client',
    registerType: 'autoUpdate',
    injectRegister: null,
    devOptions: { enabled: false },
    manifest: {
      id: '/', name: 'SchoolSys Pro', short_name: 'SchoolSys', start_url: '/app', scope: '/',
      display: 'standalone', theme_color: '#243957', background_color: '#f8fafc',
      icons: [
        { src: '/icons/schoolsys-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/schoolsys-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/schoolsys-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globDirectory: 'dist/client',
      globPatterns: ['**/*.{js,css,woff2,png,ico,webmanifest}'],
      additionalManifestEntries: [{ url: '/offline.html', revision: '1' }],
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_server/],
      runtimeCaching: [
        {
          urlPattern: ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin && !/^\/(~oauth|api\/|_server)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: { cacheName: 'schoolsys-pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [200] }, precacheFallback: { fallbackURL: '/offline.html' } },
        },
        {
          urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]{8,}\.(js|css|woff2|png)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'schoolsys-assets', expiration: { maxEntries: 200 } },
        },
      ],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

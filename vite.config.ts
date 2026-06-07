import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages has no SPA fallback: a direct request to /g/<scene> has no
// matching file and returns 404. Emitting a 404.html identical to the built
// index.html makes any unknown path boot the SPA so React Router can resolve
// the route on the client, keeping clean URLs (no redirect round-trip).
function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexHtml = bundle['index.html']
      if (indexHtml?.type === 'asset') {
        this.emitFile({
          type: 'asset',
          fileName: '404.html',
          source: indexHtml.source,
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/insta-graphics/',
  plugins: [react(), githubPagesSpaFallback()],
})

import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Monta a página do app: src/app.html é a mesma página publicada no Claude,
// e dados/rota.json tem a rota inteira (trajeto, paradas, perfil, épocas).
// No APK o d3 e as fontes vão junto, então o app abre sem internet.
function paginaDoApp() {
  return {
    name: 'pagina-do-app',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const dados = readFileSync('dados/rota.json', 'utf8');
        const app = readFileSync('src/app.html', 'utf8')
          .replace(/<meta name="claude:[^>]*>\s*/g, '')
          .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
          .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
          .replace(/<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/[^>]*>/, () => `<style>${readFileSync('public/vendor/leaflet.css', 'utf8')}</style>`)
          .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/[^"]+"><\/script>/, '<script src="./vendor/leaflet.js"></script>')
          .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^"]+"><\/script>/, '<script src="./vendor/d3.min.js"></script>')
          .replace('__DATA__', () => dados);
        return html.replace('<!--APP-->', () => app);
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [paginaDoApp()],
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 4000 }
});

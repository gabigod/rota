// Fontes do app (vão dentro do APK, funcionam sem internet)
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';

// Ponte com o Android (Capacitor). No navegador nada daqui roda.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('nativo');

  // GPX: grava o arquivo no cache do app e abre o menu de compartilhar do Android
  // (Salvar em Arquivos, Drive, ou abrir direto no Organic Maps, OsmAnd, komoot, Strava…)
  const salvarGPX = async (nome, texto) => {
    const { uri } = await Filesystem.writeFile({ path: nome, data: texto, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: nome, files: [uri], dialogTitle: 'Salvar ou abrir o GPX' });
  };
  window.dispatchEvent(new CustomEvent('rotas:nativo', { detail: { salvarGPX } }));

  // Botão voltar: fecha a parada aberta, limpa a busca, volta pra aba Paradas
  // e pra rota inteira; só então minimiza o app.
  App.addListener('backButton', () => {
    const r = window.__rotas;
    if (r && r.voltar()) return;
    App.minimizeApp();
  });
}

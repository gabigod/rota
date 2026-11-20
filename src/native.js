// Ponte com o Android (Capacitor). No navegador comum cai para o download normal.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const nativo = Capacitor.isNativePlatform();

export function iniciarNativo(voltar) {
  if (!nativo) return;
  document.documentElement.classList.add('nativo');
  App.addListener('backButton', () => { if (!voltar()) App.minimizeApp(); });
}

// Abre o menu de compartilhar do Android (Drive, WhatsApp, e-mail…). Devolve true se o arquivo saiu.
export async function salvarArquivo(nome, texto, mime = 'application/json') {
  if (nativo) {
    try {
      const r = await Filesystem.writeFile({ path: nome, data: texto, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: nome, dialogTitle: 'Salvar ou enviar', files: [r.uri] });
      return true;
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(new Blob([texto], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

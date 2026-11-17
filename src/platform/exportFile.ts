/**
 * Entrega um arquivo de texto ao jogador (a carreira exportada).
 *
 * No navegador é um download. No aplicativo não existe download: o arquivo vai para a pasta
 * temporária e o sistema abre a folha de compartilhamento (salvar em Arquivos, enviar por
 * mensagem ou e-mail).
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './native';

export type ExportOutcome = 'downloaded' | 'shared' | 'cancelled';

export async function deliverTextFile(name: string, text: string, type = 'application/json'): Promise<ExportOutcome> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
  const { uri } = await Filesystem.writeFile({ path: name, directory: Directory.Cache, encoding: Encoding.UTF8, data: text });
  try {
    await Share.share({ title: name, files: [uri], dialogTitle: 'Exportar carreira' });
    return 'shared';
  } catch {
    // O jogador fechou a folha de compartilhamento sem escolher um destino.
    return 'cancelled';
  }
}

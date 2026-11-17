/** Pasta de saves do aplicativo, pelo Capacitor Filesystem (ver `persistence/deviceStorage.ts`). */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { DeviceFiles } from '@/persistence/deviceStorage';

const FOLDER = 'saves';
/** Dados do aplicativo: fora do alcance do usuário, mantidos pelo sistema e incluídos no backup do aparelho. */
const directory = Directory.Data;
const pathOf = (name: string) => `${FOLDER}/${name}`;

export function capacitorFiles(): DeviceFiles {
  return {
    async read(name) {
      try {
        const { data } = await Filesystem.readFile({ path: pathOf(name), directory, encoding: Encoding.UTF8 });
        return typeof data === 'string' ? data : await data.text();
      } catch {
        return null;
      }
    },
    async write(name, data) {
      await Filesystem.writeFile({ path: pathOf(name), directory, encoding: Encoding.UTF8, data, recursive: true });
    },
    async rename(from, to) {
      // A troca de nome não substitui um arquivo existente em todos os sistemas: tira o destino antes.
      try {
        await Filesystem.deleteFile({ path: pathOf(to), directory });
      } catch {
        // Não havia arquivo antigo.
      }
      await Filesystem.rename({ from: pathOf(from), to: pathOf(to), directory, toDirectory: directory });
    },
    async remove(name) {
      try {
        await Filesystem.deleteFile({ path: pathOf(name), directory });
      } catch {
        // Já não existia.
      }
    },
    async list() {
      try {
        const { files } = await Filesystem.readdir({ path: FOLDER, directory });
        return files.filter((file) => file.type === 'file').map((file) => file.name);
      } catch {
        // A pasta só passa a existir na primeira gravação.
        return [];
      }
    },
  };
}

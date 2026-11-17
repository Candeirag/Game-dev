/**
 * O aplicativo é 100% local: nenhum arquivo do jogo pode buscar fonte, imagem, estilo ou dado na rede.
 * Endereços que aparecem só como texto (crédito dos traçados, comentários) não contam.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Formas de um arquivo pedir algo de fora: recurso remoto em HTML ou CSS, ou chamada de rede no código. */
const REMOTE = [
  /(?:src|href)\s*=\s*["'](?:https?:)?\/\//, // <script src>, <link href>, <img src>
  /url\(\s*["']?(?:https?:)?\/\//, // url() no CSS
  /@import\s+(?:url\()?["'](?:https?:)?\/\//, // @import remoto
  /\bfetch\s*\(/, // chamadas de rede
  /\bXMLHttpRequest\b/,
  /\bnew\s+WebSocket\b/,
  /\bimport\s*\(\s*["']https?:/, // módulo remoto
];

describe('aplicativo 100% local', () => {
  const files = [join(ROOT, 'index.html'), ...walk(join(ROOT, 'src')).filter((file) => /\.(ts|tsx|css|html)$/.test(file))];

  it('nenhum arquivo do jogo busca recursos na rede', () => {
    const found: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        // O único lugar que pode falar com a rede é o relatório de travamentos, que fica desligado.
        if (file.endsWith('crashReporting.ts')) return;
        if (REMOTE.some((pattern) => pattern.test(line))) found.push(`${file.slice(ROOT.length + 1)}:${index + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(found).toEqual([]);
  });

  it('as fontes estão embutidas no projeto', () => {
    const fonts = readdirSync(join(ROOT, 'src/assets/fonts')).filter((name) => name.endsWith('.woff2'));
    expect(fonts.length).toBeGreaterThanOrEqual(8);
    expect(readFileSync(join(ROOT, 'src/ui/tokens.css'), 'utf8')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });

  it('só a pasta src/platform conhece o Capacitor', () => {
    const outside = walk(join(ROOT, 'src'))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(`${join('src', 'platform')}`))
      .filter((file) => /from\s+['"]@capacitor\//.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(ROOT.length + 1));
    expect(outside).toEqual([]);
  });
});

import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAREER_SCHEMA_VERSION, CareerStateSchema } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { IndexedDbStorage, LocalStorageAdapter, MemoryStorage } from '@/persistence/storage';
import {
  NewerSaveError,
  SaveError,
  createEnvelope,
  deleteSave,
  exportCareer,
  exportOriginalCopy,
  importCareer,
  listOriginalCopies,
  listSaves,
  loadCareer,
  parseEnvelope,
  saveCareer,
} from '@/persistence/saveService';
import { canonicalStringify, checksumOf } from '@/persistence/checksum';
import { F1_TEAM_NAMES, initialTeams } from '@/data/teams';
import { renameStoredText } from '@/persistence/migrateV3';
import { MIGRATIONS, migrateCareerData, migrateStep } from '@/persistence/migrations';
import {
  buildRaceContext,
  completeWeekend,
  computeCareerStats,
  createWeekendRace,
  driverStandings,
  getPlayer,
  isSeasonComplete,
  simulateRemainingRace,
  startNextSeason,
} from './engineApi';
import { NOW, newCareer, pickBestOffer, playRound, playSeason, resolvePending } from './helpers';

describe('checksum', () => {
  it('não depende da ordem das chaves', () => {
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(checksumOf({ b: 1, a: 2 })).toBe(checksumOf({ a: 2, b: 1 }));
    expect(checksumOf({ a: 1 })).not.toBe(checksumOf({ a: 2 }));
  });
});

describe('saves', () => {
  const career = playRound(playRound(newCareer(31)));

  it('salva e carrega preservando os dados exatamente', async () => {
    const storage = new MemoryStorage();
    await saveCareer(storage, 'slot1', career, NOW);
    const { career: loaded, recoveredFromBackup } = await loadCareer(storage, 'slot1');
    expect(recoveredFromBackup).toBe(false);
    expect(loaded).toEqual({ ...career, updatedAt: NOW });
    expect(loaded.rounds).toHaveLength(2);
  });

  it('funciona com IndexedDB', async () => {
    const storage = new IndexedDbStorage(indexedDB, 'teste-apex');
    await saveCareer(storage, 'auto', career, NOW);
    const { career: loaded } = await loadCareer(storage, 'auto');
    expect(loaded.rounds).toEqual(career.rounds);
    const slots = await listSaves(storage);
    expect(slots.find((s) => s.slot === 'auto')!.status).toBe('ok');
    expect(slots.find((s) => s.slot === 'slot1')!.status).toBe('empty');
    await deleteSave(storage, 'auto');
    expect((await listSaves(storage)).find((s) => s.slot === 'auto')!.status).toBe('empty');
  });

  it('detecta adulteração pelo checksum', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.reputation = 100;
    expect(() => parseEnvelope(envelope)).toThrow(/checksum/);
  });

  it('recusa dados estruturalmente inválidos mesmo com checksum coerente', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.drivers[0].attributes.pace = 140;
    envelope.checksum = checksumOf(envelope.career);
    expect(() => parseEnvelope(envelope)).toThrow(SaveError);
  });

  it('recusa dados inconsistentes (integridade referencial)', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.rounds.pop();
    envelope.checksum = checksumOf(envelope.career);
    expect(() => parseEnvelope(envelope)).toThrow(/inconsistentes/);
  });

  it('recupera do backup quando o arquivo principal está corrompido', async () => {
    const storage = new MemoryStorage();
    await saveCareer(storage, 'slot2', newCareer(31), NOW);
    await saveCareer(storage, 'slot2', career, NOW);
    storage.rawSet('slot2', { format: 'apex-motorsport-dynasty-save', checksum: 'x', career: {} });
    const { career: loaded, recoveredFromBackup } = await loadCareer(storage, 'slot2');
    expect(recoveredFromBackup).toBe(true);
    expect(loaded.rounds).toHaveLength(0);
    expect((await listSaves(storage)).find((s) => s.slot === 'slot2')!.status).toBe('corrupted');
  });

  it('exporta e importa como JSON', () => {
    const json = exportCareer(career, NOW);
    expect(importCareer(json).rounds).toEqual(career.rounds);
    expect(() => importCareer('não é json')).toThrow(SaveError);
    expect(() => importCareer('{"format":"outro"}')).toThrow(/não é um save/);
  });

  it('recusa saves de versões futuras do schema', () => {
    expect(() => migrateCareerData({ schemaVersion: 99 })).toThrow(/mais nova/);
  });

  it('um save de versão mais nova não é dado como danificado nem trocado pela cópia de segurança', async () => {
    const storage = new MemoryStorage();
    await saveCareer(storage, 'slot1', newCareer(31), NOW);
    await saveCareer(storage, 'slot1', career, NOW);
    // O slot passa a ter um save do "futuro" (o build de uma fase seguinte), com a cópia de segurança de hoje ao lado.
    const future = { ...career, schemaVersion: CAREER_SCHEMA_VERSION + 1, campoNovo: true };
    storage.rawSet('slot1', {
      format: 'apex-motorsport-dynasty-save',
      schemaVersion: CAREER_SCHEMA_VERSION + 1,
      savedAt: NOW,
      checksum: checksumOf(future),
      career: future,
    });
    await expect(loadCareer(storage, 'slot1')).rejects.toThrow(NewerSaveError);
    await expect(loadCareer(storage, 'slot1')).rejects.toThrow(/versão mais nova do jogo.*Atualize/);
    const slot = (await listSaves(storage)).find((s) => s.slot === 'slot1')!;
    expect(slot.status).toBe('newer');
    // Jogar outra carreira neste build não apaga o save mais novo: a gravação é recusada, quantas vezes for.
    for (let i = 0; i < 3; i++) await expect(saveCareer(storage, 'slot1', career, NOW)).rejects.toThrow(/não foi sobrescrito/);
    expect(await storage.get('slot1')).toMatchObject({ career: { schemaVersion: CAREER_SCHEMA_VERSION + 1, campoNovo: true } });
    // Só sai quando o jogador apaga o slot; daí em diante grava normalmente.
    await deleteSave(storage, 'slot1');
    await expect(saveCareer(storage, 'slot1', career, NOW)).resolves.toMatchObject({ schemaVersion: CAREER_SCHEMA_VERSION });
    expect(slot.error).toContain(`formato ${CAREER_SCHEMA_VERSION + 1}; esta versão lê até o ${CAREER_SCHEMA_VERSION}`);
  });

  it('não salva uma carreira inconsistente', async () => {
    const broken = { ...career, nextRoundIndex: 5 };
    await expect(saveCareer(new MemoryStorage(), 'slot3', broken, NOW)).rejects.toThrow(SaveError);
  });

  it('preserva os sistemas da Fase 2 (contrato, finanças, eventos, fechamento de temporada)', async () => {
    const storage = new MemoryStorage();
    const season = playSeason(newCareer(64));
    await saveCareer(storage, 'slot1', season, NOW);
    const { career: loaded } = await loadCareer(storage, 'slot1');
    expect(loaded.offseason).toEqual(season.offseason);
    expect(loaded.contract).toEqual(season.contract);
    expect(loaded.finance).toEqual(season.finance);
    expect(loaded.eventLog).toEqual(season.eventLog);
    // A carreira carregada continua jogável.
    const next = startNextSeason(loaded, pickBestOffer(loaded));
    expect(validateCareerIntegrity(next)).toEqual([]);
  });
});

/**
 * Compatibilidade: saves reais gravados pelo código da Fase 1 (schema 1),
 * guardados em tests/fixtures/v1, precisam abrir e continuar jogáveis.
 */
describe('compatibilidade com saves da Fase 1', () => {
  const load = (name: string) => importCareer(readFileSync(`tests/fixtures/v1/${name}.json`, 'utf8'));
  const raw = (name: string) =>
    JSON.parse(readFileSync(`tests/fixtures/v1/${name}.json`, 'utf8')) as {
      career: { schemaVersion: number; rounds: unknown[]; reputation: number; drivers: { id: string; attributes: unknown }[]; history: unknown[] };
    };

  it('os arquivos são mesmo da versão 1', () => {
    for (const name of ['mid-weekend', 'season-complete', 'second-season']) expect(raw(name).career.schemaVersion).toBe(1);
  });

  it('save no meio de um fim de semana: migra, valida e a corrida pode ser disputada', () => {
    const original = raw('mid-weekend').career;
    const c = load('mid-weekend');
    expect(c.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(CareerStateSchema.safeParse(c).success).toBe(true);
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(c.categoryId).toBe('kart-regional');
    expect(c.rounds).toHaveLength(original.rounds.length);
    expect(c.weekend).toMatchObject({ phase: 'race', playerParticipates: true });
    expect(c.weekend!.entrants).toHaveLength(20);
    // Os atributos e resultados do jogador não mudam na migração.
    expect(getPlayer(c).attributes).toEqual(original.drivers.find((d) => d.id === 'player')!.attributes);
    expect(computeCareerStats(c, 'player').starts).toBe(3);
    // Sistemas novos no estado inicial.
    expect(c.contract.teamId).toBe(getPlayer(c).teamId);
    expect(c.finance.cash).toBeGreaterThan(0);
    expect(c.drivers.filter((d) => d.role === 'reserve')).toHaveLength(10);
    // Continua do ponto em que parou: termina a etapa e o resto da temporada.
    const finished = playSeason(continueWeekend(c));
    expect(finished.rounds).toHaveLength(10);
    expect(validateCareerIntegrity(finished)).toEqual([]);
  });

  it('save com a temporada terminada: ganha o fechamento e as propostas', () => {
    const original = raw('season-complete').career;
    const c = load('season-complete');
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(isSeasonComplete(c)).toBe(true);
    expect(c.offseason).not.toBeNull();
    expect(c.offseason!.reputationBefore).toBe(original.reputation);
    expect(c.offseason!.playerPosition).toBe(driverStandings(c).find((s) => s.driverId === 'player')!.position);
    expect(c.license.history).toHaveLength(1);
    const next = startNextSeason(c, pickBestOffer(c));
    expect(next.season).toBe(2);
    expect(validateCareerIntegrity(playRound(next))).toEqual([]);
  });

  it('save na segunda temporada: o histórico arquivado é mantido e convertido', () => {
    const c = load('second-season');
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(c.season).toBe(2);
    expect(c.history).toHaveLength(1);
    expect(c.history[0]).toMatchObject({ categoryId: 'kart-regional', season: 1 });
    expect(c.history[0]!.rounds).toHaveLength(10);
    expect(c.history[0]!.playerTeamName.length).toBeGreaterThan(0);
    expect(c.license.history).toHaveLength(1);
    expect(computeCareerStats(c, 'player').starts).toBe(11);
    const finished = playSeason(c);
    expect(finished.offseason).not.toBeNull();
    expect(validateCareerIntegrity(finished)).toEqual([]);
  });

  it('um save migrado pode ser regravado e relido na versão nova', async () => {
    const storage = new MemoryStorage();
    const c = load('second-season');
    await saveCareer(storage, 'slot1', c, NOW);
    const { career: again } = await loadCareer(storage, 'slot1');
    expect(again).toEqual({ ...c, updatedAt: NOW });
  });
});

/** Termina a etapa de um save carregado com o fim de semana em andamento. */
function continueWeekend(c: Parameters<typeof playRound>[0]) {
  const race = simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), { mode: 'balanced', auto: true });
  return resolvePending(completeWeekend(c, race));
}

/**
 * Degrau 3 → 4 (Fase 0): os nomes próprios das categorias e das equipes entram no lugar dos de
 * marcas reais em tudo o que o save traz escrito, sem mexer em mais nada.
 */
describe('migração da versão 3 para a 4', () => {
  const V3 = ['fase0-monoposto-com-academia', 'fase0-topo-fim-de-temporada', 'fase0-dirigente-dono-de-equipe'] as const;
  const rawCareer = (name: string) => (JSON.parse(readFileSync(`tests/fixtures/v3/${name}.json`, 'utf8')) as { career: Record<string, unknown> }).career;
  const OLD_NAMES = /\bF[1-4]\b|Fórmula [1-4]\b|Azure F1 Team|Stallion F1/;

  /** Todas as folhas de texto de um save, com o caminho de cada uma. */
  function strings(value: unknown, path = '', out: [string, string][] = []): [string, string][] {
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((inner, index) => void strings(inner, `${path}[${index}]`, out));
    else if (value !== null && typeof value === 'object') for (const [key, inner] of Object.entries(value)) strings(inner, `${path}.${key}`, out);
    return out;
  }

  /** O save sem os textos: estrutura, números, booleanos e nulos. */
  const withoutStrings = (value: unknown): unknown =>
    typeof value === 'string'
      ? '§'
      : Array.isArray(value)
        ? value.map(withoutStrings)
        : value !== null && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, withoutStrings(inner)]))
          : value;

  it('troca os nomes nas frases, com a contração no gênero do nome novo', () => {
    const cases: [string, string][] = [
      ['Você se formou na Academia Emerald GP: chegou à Fórmula 1.', 'Você se formou na Academia Emerald GP: chegou ao Grand Prix Mundial.'],
      [
        'Você segue na Fórmula 1, pela Albion Grand Prix, como primeiro piloto.',
        'Você segue no Grand Prix Mundial, pela Albion Grand Prix, como primeiro piloto.',
      ],
      ['Você vai disputar a Fórmula 1, pela Massif Racing.', 'Você vai disputar o Grand Prix Mundial, pela Massif Racing.'],
      [
        'Olheiros da Corsa Imperiale, da Fórmula 1, acompanham a sua temporada.',
        'Olheiros da Corsa Imperiale, do Grand Prix Mundial, acompanham a sua temporada.',
      ],
      ['Você subiu para a Fórmula 2, pela Sterling Motorsport.', 'Você subiu para a Fórmula Elite, pela Sterling Motorsport.'],
      [
        'Você comanda a Castilla Racing na Fórmula 2. Meta: terminar entre as 7 primeiras.',
        'Você comanda a Castilla Racing na Fórmula Elite. Meta: terminar entre as 7 primeiras.',
      ],
      ['Regulamento técnico novo na F1: as equipes refizeram o projeto.', 'Regulamento técnico novo no Grand Prix Mundial: as equipes refizeram o projeto.'],
      ['Bia terminou a F3 em 2º.', 'Bia terminou a Fórmula Sprint em 2º.'],
      ['Na F4, a vaga custa caro.', 'Na Fórmula Júnior, a vaga custa caro.'],
      ['Temporada 2038: F1', 'Temporada 2038: GP Mundial'],
      ['Temporada 2033: F4', 'Temporada 2033: F. Júnior'],
      ['Filho(a): F3, Prisma Racing. Perfil: disciplinado.', 'Filho(a): F. Sprint, Prisma Racing. Perfil: disciplinado.'],
      ['Callum Whitaker troca a Orion Grand Prix pela Stallion F1.', 'Callum Whitaker troca a Orion Grand Prix pela Stallion Autosport.'],
      ['Apoio da Academia Azure F1 Team', 'Apoio da Academia Azure Motorsport'],
    ];
    for (const [before, after] of cases) expect(renameStoredText(before)).toBe(after);
  });

  it('acerta a concordância que as versões antigas erravam nos campeonatos de kart', () => {
    expect(renameStoredText('Você subiu para a Campeonato Mundial de Kart, pela Scuderia Aurora.')).toBe(
      'Você subiu para o Campeonato Mundial de Kart, pela Scuderia Aurora.',
    );
    expect(renameStoredText('Você segue na Campeonato Regional de Kart, pela Cerrado Kart Club.')).toBe(
      'Você segue no Campeonato Regional de Kart, pela Cerrado Kart Club.',
    );
    expect(renameStoredText('Ana Teste é o campeão da Kart Regional.')).toBe('Ana Teste é o campeão do Kart Regional.');
    expect(renameStoredText('Léo terminou a Kart Nacional em 4º.')).toBe('Léo terminou o Kart Nacional em 4º.');
  });

  it('não mexe em ids, em nomes parecidos nem no que já está certo', () => {
    for (const text of [
      'f1-azure-f1-team',
      'offer-s12-f1:f1-stallion-f1',
      'Albion Grand Prix',
      'Serra Kart Team',
      'Você é o novo piloto da Cerrado Kart Club no Campeonato Regional de Kart de 2027.',
      'Você subiu para o Grand Prix Mundial, pela Azure Motorsport.',
      'AF1',
      'F10',
    ]) {
      expect(renameStoredText(text)).toBe(text);
    }
  });

  it('preserva o que o jogador digitou, mesmo dentro das frases', () => {
    const typed = ['Scuderia F1'];
    expect(renameStoredText('Scuderia F1', typed)).toBe('Scuderia F1');
    expect(renameStoredText('Você fundou a Scuderia F1, que estreia na Fórmula 4.', typed)).toBe('Você fundou a Scuderia F1, que estreia na Fórmula Júnior.');
    // Numa carreira inteira: o nome da equipe fundada e o sobrenome da família ficam como estão.
    const raw = rawCareer('fase0-dirigente-dono-de-equipe');
    const teams = raw.teams as { id: string; name: string }[];
    const own = { ...teams[0]!, id: 'own-abc', name: 'Equipe F1 do Zé' };
    const inbox = raw.inbox as { id: string; title: string; body: string }[];
    const custom = {
      ...raw,
      teams: [own, ...teams.slice(1)],
      inbox: [{ ...inbox[0]!, title: 'Temporada 2043: F2', body: 'Você fundou a Equipe F1 do Zé, que estreia na Fórmula 2.' }, ...inbox.slice(1)],
    };
    const migrated = migrateStep(custom, 3) as typeof custom;
    expect(migrated.teams[0]!.name).toBe('Equipe F1 do Zé');
    expect(migrated.inbox[0]).toMatchObject({ title: 'Temporada 2043: F. Elite', body: 'Você fundou a Equipe F1 do Zé, que estreia na Fórmula Elite.' });
  });

  it('uma equipe fundada com sigla "F1" continua abrindo: nome e sigla não são texto para reescrever', () => {
    // O dono rebatiza a equipe do save de exemplo como se a tivesse fundado: id próprio, nome "Força 1", sigla "F1".
    const file = JSON.parse(
      readFileSync('tests/fixtures/v3/fase0-dirigente-dono-de-equipe.json', 'utf8')
        .replaceAll('f2-castilla-racing', 'own-1a2b')
        .replaceAll('Castilla Racing', 'Força 1'),
    ) as { checksum: string; career: { teams: { id: string; name: string; shortName: string }[] } };
    const own = file.career.teams.find((t) => t.id === 'own-1a2b')!;
    own.shortName = 'F1';
    file.checksum = checksumOf(file.career);
    // Passa pelo caminho inteiro de leitura, schema incluído (a sigla tem no máximo quatro letras).
    const career = importCareer(JSON.stringify(file));
    expect(career.teams.find((t) => t.id === 'own-1a2b')).toMatchObject({ name: 'Força 1', shortName: 'F1' });
    expect(career.inbox.some((m) => m.body.includes('Você comanda a Força 1 na Fórmula Elite.'))).toBe(true);
    expect(validateCareerIntegrity(career)).toEqual([]);
  });

  it('o nome de uma equipe fundada é preservado mesmo depois de ela sair do grid', () => {
    const raw = rawCareer('fase0-dirigente-dono-de-equipe');
    const history = raw.history as Record<string, unknown>[];
    const finance = raw.finance as { transactions: Record<string, unknown>[] };
    const inbox = raw.inbox as { title: string; body: string }[];
    const custom = {
      ...raw,
      // A equipe "Scuderia F1" só existe no passado: histórico, retrospecto de dirigente, participações e extrato.
      history: [{ ...history[0], playerTeamId: 'own-9f', playerTeamName: 'Scuderia F1' }, ...history.slice(1)],
      executiveLog: [{ season: 3, teamId: 'own-9f', teamName: 'Scuderia F1' }],
      finance: {
        ...finance,
        stakes: [{ id: 'stake-1', teamId: 'own-9f', teamName: 'Scuderia F1' }],
        transactions: [{ ...finance.transactions[0], label: 'Fundação da equipe Scuderia F1' }, ...finance.transactions.slice(1)],
      },
      inbox: [
        { ...inbox[0]!, title: 'Temporada 2030: F4', body: 'Você fundou a Scuderia F1, que estreia na Fórmula 4. Você comanda a Scuderia F1 na Fórmula 4.' },
        ...inbox.slice(1),
      ],
    };
    const migrated = migrateStep(custom, 3) as typeof custom;
    expect(migrated.history[0]).toMatchObject({ playerTeamName: 'Scuderia F1' });
    expect(migrated.executiveLog[0]).toMatchObject({ teamName: 'Scuderia F1' });
    expect(migrated.finance.stakes[0]).toMatchObject({ teamName: 'Scuderia F1' });
    expect(migrated.finance.transactions[0]).toMatchObject({ label: 'Fundação da equipe Scuderia F1' });
    expect(migrated.inbox[0]).toMatchObject({
      title: 'Temporada 2030: F. Júnior',
      body: 'Você fundou a Scuderia F1, que estreia na Fórmula Júnior. Você comanda a Scuderia F1 na Fórmula Júnior.',
    });
  });

  it('um nome digitado igual a um nome antigo não impede a troca dos nomes de verdade', () => {
    const raw = rawCareer('fase0-monoposto-com-academia');
    const drivers = raw.drivers as { id: string; isPlayer: boolean; firstName: string; lastName: string }[];
    const inbox = raw.inbox as { title: string; body: string }[];
    const custom = {
      ...raw,
      // Piloto de sobrenome "F1", numa família "F1".
      drivers: drivers.map((d) => (d.isPlayer ? { ...d, firstName: 'Zé', lastName: 'F1' } : d)),
      dynasty: { ...(raw.dynasty as object), surname: 'F1' },
      inbox: [
        { ...inbox[0]!, title: 'Temporada 2040: F1', body: 'Zé F1 subiu para a Fórmula 1, pela Stallion F1. Regulamento técnico novo na F1.' },
        ...inbox.slice(1),
      ],
    };
    const migrated = migrateStep(custom, 3) as typeof custom & { academy: { name: string } };
    // O nome do piloto fica como foi digitado, nos campos e nas frases...
    expect(migrated.drivers.find((d) => d.isPlayer)).toMatchObject({ firstName: 'Zé', lastName: 'F1' });
    expect(migrated.dynasty).toMatchObject({ surname: 'F1' });
    // ...e a categoria, a equipe e a academia de verdade são trocadas mesmo assim.
    expect(migrated.inbox[0]).toMatchObject({
      title: 'Temporada 2040: GP Mundial',
      body: 'Zé F1 subiu para o Grand Prix Mundial, pela Stallion Autosport. Regulamento técnico novo no Grand Prix Mundial.',
    });
    expect(migrated.academy.name).toBe('Academia Stallion Autosport');
  });

  it.each(V3)('%s: só os textos com nomes antigos mudam; estrutura, números e ids ficam iguais', (name) => {
    const before = rawCareer(name);
    const after = migrateStep(before, 3);
    expect(after.schemaVersion).toBe(4);
    expect(withoutStrings({ ...after, schemaVersion: 3 })).toEqual(withoutStrings(before));
    const was = strings(before);
    const now = new Map(strings(after));
    const changed = was.filter(([path, text]) => now.get(path) !== text);
    expect(changed.length).toBeGreaterThan(0);
    // Tudo o que mudou citava um nome antigo (ou a sigla de uma das duas equipes rebatizadas)...
    for (const [path, text] of changed) expect(OLD_NAMES.test(text) || /\.shortName$/.test(path), `${path}: ${text}`).toBe(true);
    // ...e nada do que citava ficou para trás.
    expect(strings(after).filter(([, text]) => OLD_NAMES.test(text))).toEqual([]);
    // Ids e referências não são texto de exibição: continuam idênticos.
    const ids = (career: Record<string, unknown>) => strings(career).filter(([path]) => /(\.id|Id|\.driverId|\.teamId)$/.test(path));
    expect(ids(after)).toEqual(ids(before));
    // Rodar a migração de novo não muda mais nada.
    expect(migrateStep({ ...after, schemaVersion: 3 }, 3)).toEqual(after);
  });

  it('as equipes rebatizadas mantêm o id e ganham o nome e a sigla novos', () => {
    const career = importCareer(readFileSync('tests/fixtures/v3/fase0-topo-fim-de-temporada.json', 'utf8'));
    expect(career.teams.find((t) => t.id === 'f1-azure-f1-team')).toMatchObject({ name: 'Azure Motorsport', shortName: 'AM' });
    expect(career.teams.find((t) => t.id === 'f1-stallion-f1')).toMatchObject({ name: 'Stallion Autosport', shortName: 'SA' });
    // O save aberto é igual ao que o jogo de hoje criaria: as equipes batem com os dados atuais.
    const today = Object.fromEntries(initialTeams('f1').map((t) => [t.id, { name: t.name, shortName: t.shortName }]));
    for (const team of career.teams) expect({ name: team.name, shortName: team.shortName }).toEqual(today[team.id]);
  });

  it('a academia gravada com o nome antigo continua reconhecida', () => {
    const career = importCareer(readFileSync('tests/fixtures/v3/fase0-monoposto-com-academia.json', 'utf8'));
    expect(career.academy).toMatchObject({ f1TeamId: 'f1-stallion-f1', name: 'Academia Stallion Autosport' });
    expect(F1_TEAM_NAMES.some((team) => career.academy?.name === `Academia ${team}`)).toBe(true);
    expect(career.finance.transactions.filter((t) => t.label === 'Apoio da Academia Stallion Autosport').length).toBeGreaterThan(0);
  });

  it('a lista de saves mostra o resumo com os nomes de hoje, mesmo de um arquivo antigo', async () => {
    const storage = new MemoryStorage();
    const envelope = JSON.parse(readFileSync('tests/fixtures/v3/fase0-topo-fim-de-temporada.json', 'utf8')) as { summary: { categoryName: string } };
    expect(envelope.summary.categoryName).toBe('F1');
    storage.rawSet('slot1', envelope);
    const slot = (await listSaves(storage)).find((s) => s.slot === 'slot1')!;
    expect(slot).toMatchObject({ status: 'ok', summary: { categoryName: 'GP Mundial', teamName: 'Rheingold Racing' } });
  });

  it('um save da versão 1 passa por todos os degraus até a atual', () => {
    let data = (JSON.parse(readFileSync('tests/fixtures/v1/second-season.json', 'utf8')) as { career: Record<string, unknown> }).career;
    const seen = [data.schemaVersion];
    while ((data.schemaVersion as number) < CAREER_SCHEMA_VERSION) {
      data = migrateStep(data, data.schemaVersion as number);
      seen.push(data.schemaVersion);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Object.keys(MIGRATIONS).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => migrateStep(data, CAREER_SCHEMA_VERSION)).toThrow(/Não há migração/);
  });
});

describe('migração da versão 5 para a 6 (nascimento)', () => {
  const files = readdirSync('tests/fixtures/v5').filter((name) => name.endsWith('.json'));

  it.each(files)('%s: só acrescenta o nascimento vazio e sobe a versão', (name) => {
    const before = (JSON.parse(readFileSync(`tests/fixtures/v5/${name}`, 'utf8')) as { career: Record<string, unknown> }).career;
    expect(before.schemaVersion).toBe(5);
    expect('birth' in before).toBe(false);
    const after = migrateStep(before, 5);
    expect(after).toEqual({ ...before, schemaVersion: 6, birth: null });
    // Rodar de novo sobre o resultado não muda nada.
    expect(migrateStep({ ...after, schemaVersion: 5 }, 5)).toEqual(after);
  });

  it.each(files)('%s: abre na versão atual, sem nascimento, e joga igual ao que jogaria antes', (name) => {
    const career = importCareer(readFileSync(`tests/fixtures/v5/${name}`, 'utf8'));
    expect(career.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(career.birth).toBeNull();
    expect(validateCareerIntegrity(career)).toEqual([]);
  });

  it('um nascimento já gravado (save da versão 6 relido) passa intacto', () => {
    const career = newCareer(77);
    expect(career.birth).not.toBeNull();
    const raw = { ...(JSON.parse(JSON.stringify(career)) as Record<string, unknown>), schemaVersion: 5 };
    expect(migrateStep(raw, 5).birth).toEqual(career.birth);
  });
});

describe('migração da versão 6 para a 7 (economia e polos)', () => {
  const files = readdirSync('tests/fixtures/v6').filter((name) => name.endsWith('.json'));
  const hubs: Record<string, string> = {
    'kart-regional': 'sao-paulo',
    'kart-national': 'sao-paulo',
    'kart-international': 'italia',
    f4: 'sao-paulo',
    f3: 'inglaterra',
    f2: 'inglaterra',
    f1: 'inglaterra',
  };

  it.each(files)('%s: só acrescenta o polo do campeonato e os vínculos vazios, e sobe a versão', (name) => {
    const before = (JSON.parse(readFileSync(`tests/fixtures/v6/${name}`, 'utf8')) as { career: Record<string, unknown> }).career;
    expect(before.schemaVersion).toBe(6);
    expect('hub' in before).toBe(false);
    const after = migrateStep(before, 6);
    expect(after).toEqual({
      ...before,
      schemaVersion: 7,
      hub: { id: hubs[before.categoryId as string], arrivedSeason: 0 },
      investor: null,
      crowdfund: null,
      sideJob: 'none',
      noDoorSeasons: 0,
    });
    // Rodar de novo sobre o resultado não muda nada.
    expect(migrateStep({ ...after, schemaVersion: 6 }, 6)).toEqual(after);
  });

  it.each(files)('%s: abre na versão atual, sem investidor, vaquinha nem trabalho paralelo, e sem ano de idioma a cumprir', (name) => {
    const career = importCareer(readFileSync(`tests/fixtures/v6/${name}`, 'utf8'));
    expect(career.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(career).toMatchObject({ hub: { id: hubs[career.categoryId], arrivedSeason: 0 }, investor: null, crowdfund: null, sideJob: 'none', noDoorSeasons: 0 });
    expect(validateCareerIntegrity(career)).toEqual([]);
  });
});

describe('cópia intacta do save de formato anterior', () => {
  const file = (version: string, name: string) => JSON.parse(readFileSync(`tests/fixtures/${version}/${name}.json`, 'utf8')) as Record<string, unknown>;
  const V3 = file('v3', 'fase0-topo-fim-de-temporada');
  /** A versão anterior do jogo só aceita o save se o conteúdo e o checksum forem os que ela gravou. */
  const opensInTheVersionThatWroteIt = (raw: unknown) => {
    const envelope = raw as { schemaVersion: number; checksum: string; career: { schemaVersion: number } };
    return envelope.career.schemaVersion === envelope.schemaVersion && checksumOf(envelope.career) === envelope.checksum;
  };

  it('converter um save do formato 3 guarda o original, que continua lá depois de muitas gravações e de apagar o slot', async () => {
    const storage = new MemoryStorage();
    storage.rawSet('slot1', V3);
    // Abrir converte só na memória: o slot ainda guarda o formato 3 e não há cópia para fazer.
    const { career } = await loadCareer(storage, 'slot1');
    expect(career.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(await listOriginalCopies(storage)).toEqual([]);

    // A primeira gravação troca o formato do slot e guarda o original numa chave separada.
    await saveCareer(storage, 'slot1', career, NOW);
    expect(await storage.get('slot1')).toMatchObject({ schemaVersion: CAREER_SCHEMA_VERSION });
    expect(await storage.get('slot1.original-v3')).toEqual(V3);

    // Várias gravações depois, a cópia de segurança comum já é do formato novo; a do formato 3 está intacta.
    for (let i = 0; i < 4; i++) await saveCareer(storage, 'slot1', career, NOW);
    expect(await storage.get('slot1.backup')).toMatchObject({ schemaVersion: CAREER_SCHEMA_VERSION });
    expect(await storage.get('slot1.original-v3')).toEqual(V3);

    // Apagar o slot, gravar outra carreira nele e gravar nos outros slots também não a tocam.
    await deleteSave(storage, 'slot1');
    expect(await storage.get('slot1')).toBeUndefined();
    await saveCareer(storage, 'slot1', playRound(newCareer(7)), NOW);
    await saveCareer(storage, 'auto', career, NOW);
    expect(await storage.get('slot1.original-v3')).toEqual(V3);
    expect((await storage.keys()).filter((key) => key.includes('original'))).toEqual(['slot1.original-v3']);
  });

  it('a cópia ainda abre: na versão que a gravou (conteúdo e checksum originais) e nesta, pela migração', async () => {
    const storage = new MemoryStorage();
    storage.rawSet('auto', V3);
    const { career } = await loadCareer(storage, 'auto');
    await saveCareer(storage, 'auto', career, NOW);
    await saveCareer(storage, 'auto', career, NOW);

    const text = await exportOriginalCopy(storage, 'auto', 3);
    // O arquivo exportado é o save do formato 3 tal como foi gravado.
    expect(JSON.parse(text)).toEqual(V3);
    expect(opensInTheVersionThatWroteIt(JSON.parse(text))).toBe(true);
    // E esta versão o abre de novo, chegando à mesma carreira que a conversão deu da primeira vez.
    expect(importCareer(text)).toEqual(career);

    // A lista mostra de onde a cópia veio, com o resumo já nos nomes de hoje.
    const [copy, ...others] = await listOriginalCopies(storage);
    expect(others).toEqual([]);
    expect(copy).toMatchObject({
      slot: 'auto',
      version: 3,
      savedAt: V3.savedAt,
      summary: { playerName: (V3.summary as { playerName: string }).playerName, categoryName: 'GP Mundial' },
    });
    await expect(exportOriginalCopy(storage, 'slot2', 3)).rejects.toThrow(/não está mais guardada/);
  });

  it('gravar outra carreira por cima de um save antigo que nem foi aberto também guarda o original', async () => {
    const storage = new MemoryStorage();
    storage.rawSet('auto', V3);
    await saveCareer(storage, 'auto', playRound(newCareer(11)), NOW);
    expect(await storage.get('auto.original-v3')).toEqual(V3);
  });

  it('se o slot já foi convertido e o formato 3 só resta na cópia de segurança, a gravação seguinte o guarda', async () => {
    const storage = new MemoryStorage();
    const converted = importCareer(JSON.stringify(V3));
    // Estado deixado por um build que convertia sem guardar o original: slot no formato novo, cópia de segurança no antigo.
    storage.rawSet('slot2', createEnvelope(converted, NOW));
    storage.rawSet('slot2.backup', V3);
    await saveCareer(storage, 'slot2', converted, NOW);
    expect(await storage.get('slot2.backup')).toMatchObject({ schemaVersion: CAREER_SCHEMA_VERSION });
    expect(await storage.get('slot2.original-v3')).toEqual(V3);
  });

  it('com o slot danificado, o original guardado é o que ainda abre (a cópia de segurança)', async () => {
    const storage = new MemoryStorage();
    storage.rawSet('slot3', { ...V3, checksum: 'adulterado' });
    storage.rawSet('slot3.backup', V3);
    const { career, recoveredFromBackup } = await loadCareer(storage, 'slot3');
    expect(recoveredFromBackup).toBe(true);
    await saveCareer(storage, 'slot3', career, NOW);
    expect(await storage.get('slot3.original-v3')).toEqual(V3);
  });

  it('vale para qualquer formato anterior, e cada um tem a sua cópia', async () => {
    const storage = new MemoryStorage();
    const v1 = file('v1', 'second-season');
    const v2 = file('v2', 'formula-mid-season');
    storage.rawSet('slot1', v1);
    await saveCareer(storage, 'slot1', (await loadCareer(storage, 'slot1')).career, NOW);
    storage.rawSet('slot1', v2);
    await saveCareer(storage, 'slot1', (await loadCareer(storage, 'slot1')).career, NOW);
    expect(await storage.get('slot1.original-v1')).toEqual(v1);
    expect(await storage.get('slot1.original-v2')).toEqual(v2);
    expect((await listOriginalCopies(storage)).map((copy) => [copy.slot, copy.version])).toEqual([
      ['slot1', 2],
      ['slot1', 1],
    ]);
    expect(opensInTheVersionThatWroteIt(await storage.get('slot1.original-v1'))).toBe(true);
  });

  it('save do formato atual não gera cópia nenhuma', async () => {
    const storage = new MemoryStorage();
    const career = playRound(newCareer(31));
    for (let i = 0; i < 3; i++) await saveCareer(storage, 'slot1', career, NOW);
    expect((await storage.keys()).sort()).toEqual(['slot1', 'slot1.backup']);
    expect(await listOriginalCopies(storage)).toEqual([]);
  });

  it('com o armazenamento quase cheio, a gravação abre mão da cópia de segurança, nunca do original nem do progresso', async () => {
    // localStorage com espaço para dois saves e meio: é o que um aparelho sem IndexedDB tem, com slot e cópia de segurança.
    const small = file('v3', 'atual-kart-na-largada');
    const unit = JSON.stringify(small).length;
    const data = new Map<string, string>();
    const limited = {
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
      setItem(key: string, value: string) {
        const used = [...data].reduce((total, [k, v]) => total + (k === key ? 0 : v.length), 0);
        if (used + value.length > unit * 2.5) throw new DOMException('cota excedida', 'QuotaExceededError');
        data.set(key, value);
      },
    } satisfies Storage;
    const storage = new LocalStorageAdapter(limited);
    await storage.setMany({ slot1: small });
    await storage.setMany({ 'slot1.backup': small });

    const { career } = await loadCareer(storage, 'slot1');
    for (const day of ['2031-01-01', '2031-01-02', '2031-01-03']) {
      // Cada gravação cabe e fica: o slot traz a gravação mais recente, e ela abre.
      const now = `${day}T12:00:00.000Z`;
      await saveCareer(storage, 'slot1', career, now);
      expect(await storage.get('slot1')).toMatchObject({ savedAt: now, schemaVersion: CAREER_SCHEMA_VERSION });
      expect((await loadCareer(storage, 'slot1')).career.updatedAt).toBe(now);
      expect(await storage.get('slot1.original-v3')).toEqual(small);
    }
    // Slot, original e cópia de segurança não cabem juntos: quem ficou de fora foi a cópia de segurança.
    expect((await storage.keys()).sort()).toEqual(['slot1', 'slot1.original-v3']);
  });

  it('se nem o essencial puder ser gravado, o erro aparece e o save antigo continua no slot', async () => {
    const storage = new IndexedDbStorage(indexedDB, 'teste-copia-original');
    await storage.setMany({ slot1: V3 });
    const { career } = await loadCareer(storage, 'slot1');
    // Um valor que o IndexedDB não consegue guardar faz a transação inteira falhar.
    const failing = Object.create(storage, {
      setMany: { value: (entries: Record<string, unknown>) => storage.setMany({ ...entries, 'slot1.original-v3': () => 'não clonável' }) },
    }) as IndexedDbStorage;
    await expect(saveCareer(failing, 'slot1', career, NOW)).rejects.toThrow();
    expect(await storage.get('slot1')).toEqual(V3);
    expect(await storage.get('slot1.backup')).toBeUndefined();
  });
});

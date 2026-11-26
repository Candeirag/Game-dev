/**
 * Migração do save da versão 9 para a 10 (Fase 6 da grande atualização): dinastia.
 *
 * A versão 10 acrescenta:
 * - em cada filho, os talentos e defeitos de nascença (`birthTraits`) e o teste no kart (`kartTest`).
 *   Um filho de save antigo fica sem traços; o motor sorteia os dele na próxima virada de ano,
 *   com a semente do próprio filho, e todos começam ocultos;
 * - em cada geração da linhagem, os traços, o parceiro e o caminho (`traits`, `partnerName`,
 *   `path`), vazios nos saves antigos;
 * - na dinastia, os parentes que seguiram outro caminho e os personagens anteriores vivos
 *   (`relatives`, `elders`), vazios;
 * - o ano de transição do personagem (`transition`), nulo, e a temporada em que ele parou de correr
 *   (`retiredSeason`). Ela só é conhecida quando o save está na temporada da aposentadoria: no
 *   fechamento que veio da aposentadoria (o resumo do ano é de piloto) ou no resto de um ano em que
 *   o personagem correu algumas etapas antes de parar. Nos outros saves fica nula (quem parou antes
 *   já passou do primeiro ano fora do carro; o herdeiro que assumiu pelos negócios nunca correu).
 *
 * O filho aparece também dentro do efeito `child` dos eventos pendentes (a escolha de ter um filho):
 * esses recebem os mesmos campos, para o cartão continuar resolvível.
 *
 * É só de dados e pode rodar duas vezes sem mudar nada na segunda.
 */
type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function migrateChild(child: unknown): unknown {
  if (!isObject(child)) return child;
  return { ...child, birthTraits: Array.isArray(child.birthTraits) ? child.birthTraits : [], kartTest: isObject(child.kartTest) ? child.kartTest : null };
}

function migrateEffect(effect: unknown): unknown {
  if (!isObject(effect) || effect.type !== 'child') return effect;
  return { ...effect, child: migrateChild(effect.child) };
}

function migratePendingEvent(event: unknown): unknown {
  if (!isObject(event) || !Array.isArray(event.choices)) return event;
  return {
    ...event,
    choices: event.choices.map((choice) =>
      isObject(choice) && Array.isArray(choice.outcomes)
        ? {
            ...choice,
            outcomes: choice.outcomes.map((outcome) =>
              isObject(outcome) && Array.isArray(outcome.effects) ? { ...outcome, effects: outcome.effects.map(migrateEffect) } : outcome,
            ),
          }
        : choice,
    ),
  };
}

function migrateLineageEntry(entry: unknown): unknown {
  if (!isObject(entry)) return entry;
  return {
    ...entry,
    traits: Array.isArray(entry.traits) ? entry.traits : [],
    partnerName: typeof entry.partnerName === 'string' ? entry.partnerName : null,
    path: entry.path === 'driver' || entry.path === 'executive' ? entry.path : null,
  };
}

/**
 * O personagem atual assumiu pelos negócios: a geração dele começa depois da temporada do save (o
 * herdeiro que assume no fechamento) ou na mesma temporada em que a anterior terminou (o que assume no
 * meio do ano). Ele nunca parou de correr: o resumo de piloto e as etapas com o resultado de um filho
 * que corria são do ano de outra pessoa.
 */
function tookOverBusiness(data: Loose, season: number): boolean {
  const lineage = list(isObject(data.dynasty) ? data.dynasty.lineage : []).filter(isObject);
  const current = lineage[lineage.length - 1];
  const previous = lineage[lineage.length - 2];
  if (!current || typeof current.fromSeason !== 'number') return false;
  return current.fromSeason > season || (previous !== undefined && previous.toSeason === current.fromSeason);
}

/** A temporada da aposentadoria, quando o save está nela (ver o comentário do arquivo). */
function retiredSeasonOf(data: Loose): number | null {
  if (typeof data.retiredSeason === 'number') return data.retiredSeason;
  if (data.mode !== 'executive' || typeof data.season !== 'number') return null;
  if (tookOverBusiness(data, data.season)) return null;
  const off = isObject(data.executiveOffseason) ? data.executiveOffseason : null;
  if (off && isObject(off.summary) && off.summary.mode === 'driver') return data.season;
  // Parou no meio do ano: as etapas da temporada (até o fechamento dela) têm o resultado dele.
  const raced = list(data.rounds).some(
    (round) => isObject(round) && isObject(round.race) && list(round.race.entries).some((entry) => isObject(entry) && entry.driverId === data.playerDriverId),
  );
  return raced ? data.season : null;
}

export function migrateV9(data: Loose): Loose {
  const family = isObject(data.family) ? data.family : {};
  const dynasty = isObject(data.dynasty) ? data.dynasty : {};
  return {
    ...data,
    family: { ...family, children: list(family.children).map(migrateChild) },
    pendingEvents: list(data.pendingEvents).map(migratePendingEvent),
    dynasty: {
      ...dynasty,
      lineage: list(dynasty.lineage).map(migrateLineageEntry),
      relatives: Array.isArray(dynasty.relatives) ? dynasty.relatives : [],
      elders: Array.isArray(dynasty.elders) ? dynasty.elders : [],
    },
    transition: isObject(data.transition) ? data.transition : null,
    retiredSeason: retiredSeasonOf(data),
  };
}

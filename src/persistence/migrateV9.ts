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
 * - o ano de transição do personagem (`transition`), nulo.
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
  };
}

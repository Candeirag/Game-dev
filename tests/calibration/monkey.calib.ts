/**
 * "Macaco": um jogador que aperta botões ao acaso (não é teste de regressão).
 *
 * A cada passo ele chama uma ação pública do motor escolhida por sorteio,
 * com argumentos também sorteados: compra e vende ativos, pede empréstimo,
 * mexe na família, negocia, se aposenta, compra e funda equipes, troca
 * equipe técnica, escala pilotos, resolve eventos e sucessões, e disputa as
 * etapas. Ações recusadas pelas regras (exceções) são esperadas; o que não
 * pode acontecer é uma ação aceita deixar o estado inválido, ou o save não
 * voltar igual.
 */
import { test } from 'vitest';
import {
  CATEGORY_IDS,
  CareerStateSchema,
  DEV_AREAS,
  FACILITY_KEYS,
  LIFESTYLES,
  PRACTICE_PROGRAMS,
  QUALIFYING_APPROACHES,
  RACE_MODES,
  RESEARCH_SPENDS,
  STAFF_ROLES,
  SUPPORT_LEVELS,
  TRAINING_FOCUSES,
  TRAINING_INTENSITIES,
  TYRE_COMPOUNDS,
  type CareerState,
} from '@/domain/schemas';
import { BUSINESSES, PROPERTIES, STOCKS } from '@/data/assets';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import * as engine from '../engineApi';
import { NOW, botCareer } from '../helpers';

const SEEDS = Number(process.env.MONKEY_SEEDS ?? 16);
const STEPS = Number(process.env.MONKEY_STEPS ?? 1500);

function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${path}: ${String(a)} ≠ ${String(b)}`;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av === undefined && bv === undefined) continue;
    const d = firstDifference(av, bv, `${path}.${key}`);
    if (d) return d;
  }
  return null;
}

test('macaco: ações aleatórias nunca deixam o estado inválido', () => {
  const refused: Record<string, number> = {};
  const accepted: Record<string, number> = {};
  const unexpected: string[] = [];
  let checks = 0;

  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = engine.createRng(engine.hashSeed('monkey', seed));
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)] as T;
    /** Id de um item sorteado da lista, ou um id inexistente se ela estiver vazia. */
    const idOf = (list: readonly { id: string }[]): string => (list.length ? pick(list).id : 'x');
    const int = (min: number, max: number) => Math.floor(min + rng.next() * (max - min + 1));
    let c: CareerState = botCareer(1000 + seed, (seed % 3) * 4);
    // Metade dos macacos nasce rica, para alcançar as ações caras (imóveis, equipes de F1).
    if (seed % 2 === 0) c = { ...c, finance: { ...c.finance, cash: 400_000_000 }, reputation: 70 };
    let last = 'início';
    let traced = 0;

    const validate = (state: CareerState, full: boolean) => {
      checks++;
      const problems = validateCareerIntegrity(state);
      if (problems.length) throw new Error(`integridade: ${problems.slice(0, 3).join('; ')}`);
      if (!Number.isFinite(state.finance.cash) || !Number.isFinite(engine.netWorth(state.finance))) throw new Error('dinheiro não finito');
      for (const t of state.teams)
        if (!(t.car.engine >= 40 && t.car.engine <= 99 && t.car.chassis >= 40 && t.car.chassis <= 99 && t.crew >= 0 && t.crew <= 100))
          throw new Error(`carro fora da faixa: ${JSON.stringify(t.car)} ${t.crew}`);
      if (full) {
        const parsed = CareerStateSchema.safeParse(state);
        if (!parsed.success) throw new Error(`schema: ${JSON.stringify(parsed.error.issues.slice(0, 2))}`);
        const diff = firstDifference(state, importCareer(exportCareer(state, NOW)));
        if (diff) throw new Error(`save não voltou igual em ${diff}`);
      }
    };

    /** Tenta uma ação. Recusa por regra (Error) é normal; o estado só muda se a ação for aceita. */
    const attempt = (name: string, fn: (s: CareerState) => CareerState) => {
      last = name;
      let next: CareerState;
      try {
        next = fn(c);
      } catch (error) {
        if (!(error instanceof Error) || error instanceof TypeError || error instanceof RangeError) throw error;
        refused[name] = (refused[name] ?? 0) + 1;
        return;
      }
      accepted[name] = (accepted[name] ?? 0) + 1;
      validate(next, false);
      c = next;
    };

    const assetActions: (() => void)[] = [
      () => attempt('buyStock', (s) => engine.buyStock(s, pick(STOCKS).id, int(1, Math.max(1, Math.floor(Math.max(0, s.finance.cash) / 200))))),
      () =>
        attempt('sellStock', (s) => {
          const h = s.finance.stocks.length ? pick(s.finance.stocks) : { stockId: 'x', shares: 1 };
          return engine.sellStock(s, h.stockId, int(1, Math.ceil(h.shares)));
        }),
      () => attempt('buyProperty', (s) => engine.buyProperty(s, pick(PROPERTIES).id, pick(['rented', 'personal'] as const))),
      () => attempt('setPropertyUse', (s) => engine.setPropertyUse(s, idOf(s.finance.properties), pick(['rented', 'personal'] as const))),
      () => attempt('sellProperty', (s) => engine.sellProperty(s, idOf(s.finance.properties))),
      () => attempt('openBusiness', (s) => engine.openBusiness(s, pick(BUSINESSES).id)),
      () => attempt('upgradeBusiness', (s) => engine.upgradeBusiness(s, idOf(s.finance.businesses))),
      () => attempt('sellBusiness', (s) => engine.sellBusiness(s, idOf(s.finance.businesses))),
      () => attempt('buyStake', (s) => engine.buyStake(s, pick(s.teams).id, pick([0.05, 0.1, 0.25, 0.3]))),
      () => attempt('sellStake', (s) => engine.sellStake(s, idOf(s.finance.stakes))),
      () => attempt('takeLoan', (s) => engine.takeLoan(s, int(500, Math.max(1000, engine.loanLimit(s) * 1.2)), pick([1, 2, 4, 6]))),
      () => attempt('repayLoan', (s) => engine.repayLoan(s, idOf(s.finance.loans))),
      () => attempt('setLifestyle', (s) => engine.setLifestyle(s, pick(LIFESTYLES))),
      () => attempt('invest', (s) => engine.invest(s, { product: pick(['fixedIncome', 'equityFund'] as const), amount: int(-50_000, 50_000) })),
      () => attempt('setKartFunding', (s) => engine.setKartFunding(s, idOf(s.family.children), pick(SUPPORT_LEVELS))),
      () => attempt('setChildSupport', (s) => engine.setChildSupport(s, idOf(s.family.children), pick(SUPPORT_LEVELS))),
    ];
    const teamActions: (() => void)[] = [
      () => attempt('hireStaff', (s) => engine.hireStaff(s, idOf(s.management?.staffMarket ?? []))),
      () => attempt('dismissStaff', (s) => engine.dismissStaff(s, pick(STAFF_ROLES))),
      () => attempt('setDepartment', (s) => engine.setDepartment(s, pick(['engineers', 'mechanics'] as const), int(0, 6))),
      () => attempt('upgradeFacility', (s) => engine.upgradeFacility(s, pick(FACILITY_KEYS))),
      () =>
        attempt('setDevelopment', (s) =>
          engine.setDevelopment(s, {
            spend: pick(RESEARCH_SPENDS),
            allocation: { aero: rng.next(), chassis: rng.next(), engine: rng.next(), suspension: rng.next(), manufacturing: rng.next() < 0.2 ? 0 : rng.next() },
          }),
        ),
      () => attempt('setAreaShare', (s) => engine.setAreaShare(s, pick(DEV_AREAS), rng.next() * 1.2 - 0.1)),
      () => attempt('ownerTransfer', (s) => engine.ownerTransfer(s, int(-2_000_000, 2_000_000))),
      () => attempt('dropTeamSponsor', (s) => engine.dropTeamSponsor(s, idOf(s.management?.sponsors ?? []))),
    ];

    const resolveEvents = () => {
      for (let guard = 0; guard < 20 && c.pendingEvents.length > 0; guard++) {
        const event = c.pendingEvents[0]!;
        attempt('resolveEvent', (s) => engine.resolveEvent(s, event.id, pick(event.choices).id).career);
      }
    };

    try {
      for (let step = 0; step < STEPS; step++) {
        // Ações avulsas, a qualquer momento.
        for (let i = int(0, 3); i > 0; i--) pick(assetActions)();
        if (c.management) for (let i = int(0, 2); i > 0; i--) pick(teamActions)();

        if (c.succession) {
          const heir = pick(c.succession.heirs);
          if (c.succession.cause === 'handover' && rng.next() < 0.2) attempt('cancelHandover', engine.cancelHandover);
          else attempt('resolveSuccession', (s) => engine.resolveSuccession(s, heir.id, pick(['driver', 'executive'] as const)));
        } else if (c.mode === 'driver' && c.offseason) {
          resolveEvents();
          const offers = c.offseason.offers;
          if (rng.next() < 0.5)
            attempt(
              'negotiateOffer',
              (s) => engine.negotiateOffer(s, pick(offers).id, pick(['salary', 'seat', 'bonus', 'role', 'shorter', 'longer', 'clause'] as const)).career,
            );
          if (rng.next() < 0.04) attempt('retire (fechamento)', engine.retireFromDriving);
          else attempt('startNextSeason', (s) => engine.startNextSeason(s, pick(offers).id));
        } else if (c.mode === 'executive' && c.executiveOffseason) {
          resolveEvents();
          const off = c.executiveOffseason;
          if (off.candidates.length && rng.next() < 0.6)
            attempt('setLineup', (s) => engine.setLineup(s, [pick(off.candidates).driverId, pick(off.candidates).driverId]));
          if (off.sponsorOffers.length && rng.next() < 0.6) attempt('acceptTeamSponsor', (s) => engine.acceptTeamSponsor(s, pick(off.sponsorOffers).id));
          if (rng.next() < 0.12) attempt('leaveTeam', engine.leaveTeam);
          if (rng.next() < 0.05) attempt('beginHandover', engine.beginHandover);
          else {
            const roll = rng.next();
            const plan: engine.ExecutivePlan =
              roll < 0.35
                ? { kind: 'continue' }
                : roll < 0.5
                  ? { kind: 'spectate' }
                  : roll < 0.7
                    ? { kind: 'job', offerId: idOf(off.jobOffers) }
                    : roll < 0.88
                      ? { kind: 'buy', listingId: pick(off.listings).id }
                      : {
                          kind: 'found',
                          categoryId: pick(CATEGORY_IDS),
                          name: pick(['Macaco Racing', 'X', 'Equipe Com Um Nome Bem Comprido Demais', 'Ás']),
                          color: pick(['#12ab34', 'verde']),
                        };
            attempt(`startExecutiveSeason:${plan.kind}`, (s) => engine.startExecutiveSeason(s, plan));
          }
        } else if (c.mode === 'driver') {
          resolveEvents();
          if (rng.next() < 0.3) attempt('setTrainingFocus', (s) => engine.setTrainingFocus(s, pick(TRAINING_FOCUSES)));
          if (rng.next() < 0.3) attempt('setTrainingIntensity', (s) => engine.setTrainingIntensity(s, pick(TRAINING_INTENSITIES)));
          if (rng.next() < 0.004) {
            attempt('retire (meio do ano)', engine.retireFromDriving);
            continue;
          }
          if (!c.weekend) attempt('startWeekend', (s) => engine.startWeekend(s, { rest: rng.next() < 0.3 }));
          if (c.weekend && !c.weekend.playerParticipates) attempt('simulateAbsentWeekend', (s) => engine.simulateAbsentWeekend(s));
          else if (c.weekend) {
            if (c.weekend.phase === 'practice') attempt('runPractice', (s) => engine.runPractice(s, pick(PRACTICE_PROGRAMS)));
            if (c.weekend?.phase === 'qualifying') attempt('runQualifying', (s) => engine.runQualifying(s, pick(QUALIFYING_APPROACHES)));
            if (c.weekend?.phase === 'race') {
              attempt('race', (s) => {
                const ctx = engine.buildRaceContext(s);
                const options = engine.playerStrategyOptions(s);
                let race = engine.createWeekendRace(s, rng.next() < 0.5 && options.length ? pick(options).plan : undefined);
                // Algumas voltas com comandos ao acaso (paradas, ordens, ritmo), depois o resto no automático.
                for (let lap = int(0, 12); lap > 0 && !engine.isRaceFinished(race); lap--) {
                  race = engine.stepRaceLap(race, ctx, {
                    mode: pick(RACE_MODES),
                    pit: rng.next() < 0.2 ? pick(TYRE_COMPOUNDS) : null,
                    skipPlannedStop: rng.next() < 0.2,
                    auto: rng.next() < 0.3,
                    ...(race.pendingTeamOrder ? { teamOrder: pick(['obey', 'ignore'] as const) } : {}),
                  });
                }
                race = engine.simulateRemainingRace(race, ctx, { mode: pick(RACE_MODES), auto: rng.next() < 0.7 });
                return engine.completeWeekend(s, race);
              });
            }
          }
        } else {
          resolveEvents();
          if (!c.weekend) attempt('startWeekend (dirigente)', (s) => engine.startWeekend(s));
          if (c.weekend)
            attempt('simulateAbsentWeekend (dirigente)', (s) =>
              engine.simulateAbsentWeekend(s, { program: pick(PRACTICE_PROGRAMS), approach: pick(QUALIFYING_APPROACHES) }),
            );
        }
        if (process.env.MONKEY_TRACE === String(seed) && c.finance.reports.length && c.finance.reports[c.finance.reports.length - 1]!.season !== traced) {
          const r = c.finance.reports[c.finance.reports.length - 1]!;
          traced = r.season;
          console.log(
            `T${r.season} ${c.mode}${c.management ? `/${c.management.position}` : ''} pat ${Math.round(r.netWorthEnd / 1e6)}M | ${Object.entries(r.totals)
              .filter(([, v]) => Math.abs(v) > 2e6)
              .map(([k, v]) => `${k} ${Math.round(v / 1e6)}M`)
              .join(
                ' ',
              )} | ações ${Math.round(engine.stocksValue(c.finance) / 1e6)}M imóveis ${Math.round(c.finance.properties.reduce((a, b) => a + b.value, 0) / 1e6)}M part ${Math.round(c.finance.stakes.reduce((a, b) => a + b.value, 0) / 1e6)}M fundo ${Math.round(c.finance.equityFund / 1e6)}M rf ${Math.round(c.finance.fixedIncome / 1e6)}M caixa ${Math.round(c.finance.cash / 1e6)}M`,
          );
        }
        if (step % 25 === 0) validate(c, true);
      }
      validate(c, true);
      console.log(
        `macaco ${seed}: temporada ${c.season}, ${c.dynasty.generation}ª geração, ${c.mode}${c.management ? `/${c.management.position}/${c.categoryId}` : ''}, patrimônio ${Math.round(engine.netWorth(c.finance) / 1000)}k, filhos ${c.family.children.length}`,
      );
    } catch (error) {
      unexpected.push(
        `macaco ${seed}, depois de "${last}" (temporada ${c.season}, ${c.mode}): ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n${error instanceof Error ? (error.stack ?? '').split('\n').slice(1, 5).join('\n') : ''}`,
      );
    }
  }
  const table = (o: Record<string, number>) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
  console.log(`\nverificações: ${checks}\naceitas: ${table(accepted)}\nrecusadas pelas regras: ${table(refused)}`);
  if (unexpected.length) throw new Error(`\n${unexpected.join('\n\n')}`);
}, 3_600_000);

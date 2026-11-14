import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AttributeKey } from '@/domain/schemas';
import { ATTRIBUTE_LABELS } from '@/domain/labels';
import {
  NATIONALITIES,
  PLAYER_BACKGROUNDS,
  PLAYER_BONUS_MAX_PER_ATTRIBUTE,
  PLAYER_BONUS_POINTS,
  PLAYER_MAX_AGE,
  PLAYER_MIN_AGE,
  type PlayerBackground,
} from '@/data/rules';
import { ROOKIE_TEAM_IDS, TEAMS } from '@/data/teams';
import { TRAINABLE_ATTRIBUTES, overallRating, validateNewCareerInput, type NewCareerInput } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CarSprite } from '../components/CarSprite';
import { Button, Card, ChoiceCard, RatingBar, cx } from '../components/ui';
import { formatRating } from '../format';

export function NewCareerScreen() {
  const navigate = useNavigate();
  const newCareer = useGameStore((s) => s.newCareer);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationality, setNationality] = useState('BR');
  const [age, setAge] = useState(15);
  const [background, setBackground] = useState<PlayerBackground>('natural');
  const [bonus, setBonus] = useState<Partial<Record<AttributeKey, number>>>({});
  const [teamId, setTeamId] = useState<string>(ROOKIE_TEAM_IDS[1] ?? 'cerrado');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = PLAYER_BACKGROUNDS.find((b) => b.id === background) ?? PLAYER_BACKGROUNDS[0]!;
  const used = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
  const remaining = PLAYER_BONUS_POINTS - used;
  const attributes = useMemo(() => {
    const a = { ...preset.attributes };
    for (const key of TRAINABLE_ATTRIBUTES) a[key] += bonus[key] ?? 0;
    return a;
  }, [preset, bonus]);

  const input: NewCareerInput = { firstName, lastName, nationality, age, background, bonus, teamId };
  const problems = validateNewCareerInput(input);

  function adjust(key: AttributeKey, delta: number) {
    const current = bonus[key] ?? 0;
    const next = current + delta;
    if (next < 0 || next > PLAYER_BONUS_MAX_PER_ATTRIBUTE || (delta > 0 && remaining <= 0)) return;
    setBonus({ ...bonus, [key]: next });
  }

  async function submit() {
    setError(null);
    if (problems.length) return setError(problems.join(' '));
    setSubmitting(true);
    try {
      await newCareer(input);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const field =
    'w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-apex-500 focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <button type="button" onClick={() => navigate('/')} className="mb-4 text-sm font-semibold text-ink-400 hover:text-ink-100">
        ← Voltar
      </button>
      <div className="mb-8">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-apex-400">Nova carreira</div>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Crie seu piloto</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="1 · Identidade">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Nome</span>
                <input className={field} value={firstName} maxLength={20} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex.: Ana" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Sobrenome</span>
                <input className={field} value={lastName} maxLength={24} onChange={(e) => setLastName(e.target.value)} placeholder="Ex.: Ribeiro" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Nacionalidade</span>
                <select className={field} value={nationality} onChange={(e) => setNationality(e.target.value)}>
                  {NATIONALITIES.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Idade</span>
                <select className={field} value={age} onChange={(e) => setAge(Number(e.target.value))}>
                  {Array.from({ length: PLAYER_MAX_AGE - PLAYER_MIN_AGE + 1 }, (_, i) => PLAYER_MIN_AGE + i).map((a) => (
                    <option key={a} value={a}>
                      {a} anos {a <= 15 ? '(evolui mais rápido)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="2 · Perfil de piloto">
            <div className="grid gap-3 md:grid-cols-3">
              {PLAYER_BACKGROUNDS.map((b) => (
                <ChoiceCard
                  key={b.id}
                  selected={background === b.id}
                  onSelect={() => setBackground(b.id)}
                  title={b.name}
                  description={b.description}
                  meta={`Potencial ${b.potential} · Experiência inicial ${b.attributes.experience}`}
                />
              ))}
            </div>
          </Card>

          <Card
            title="3 · Pontos livres"
            action={<span className={cx('text-sm font-semibold tabular', remaining ? 'text-gold-400' : 'text-ink-400')}>{remaining} restantes</span>}
          >
            <p className="mb-4 text-sm text-ink-400">
              Distribua {PLAYER_BONUS_POINTS} pontos, no máximo {PLAYER_BONUS_MAX_PER_ATTRIBUTE} por atributo. A experiência só cresce competindo.
            </p>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {TRAINABLE_ATTRIBUTES.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-sm">{ATTRIBUTE_LABELS[key]}</div>
                  <div className="flex-1">
                    <RatingBar value={attributes[key]} previous={preset.attributes[key]} />
                  </div>
                  <div className="w-7 text-right font-semibold tabular">{attributes[key]}</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`Remover ponto de ${ATTRIBUTE_LABELS[key]}`}
                      onClick={() => adjust(key, -1)}
                      disabled={!bonus[key]}
                      className="h-7 w-7 rounded-md border border-ink-700 text-ink-300 hover:border-ink-400 disabled:opacity-30"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label={`Adicionar ponto em ${ATTRIBUTE_LABELS[key]}`}
                      onClick={() => adjust(key, 1)}
                      disabled={remaining <= 0 || (bonus[key] ?? 0) >= PLAYER_BONUS_MAX_PER_ATTRIBUTE}
                      className="h-7 w-7 rounded-md border border-ink-700 text-ink-300 hover:border-ink-400 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="4 · Equipe">
            <p className="mb-4 text-sm text-ink-400">
              Como estreante, só as equipes de entrada oferecem vaga. Um kart melhor aumenta a cobrança e o custo da vaga. Você começa no kart regional, com as
              economias e o apoio da família; daí em diante, resultados atraem patrocinadores e propostas até a Fórmula 1.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {TEAMS.filter((t) => ROOKIE_TEAM_IDS.includes(t.id)).map((t) => (
                <ChoiceCard
                  key={t.id}
                  selected={teamId === t.id}
                  onSelect={() => setTeamId(t.id)}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                  }
                  description={
                    <span className="grid grid-cols-3 gap-2 pt-1 text-xs tabular">
                      <span className="col-span-3 block py-1">
                        <CarSprite categoryId="kart-regional" teamId={t.id} color={t.color} className="w-28" title={`Kart da ${t.name}`} />
                      </span>
                      <span>
                        Motor <b className="text-ink-100">{t.car.engine}</b>
                      </span>
                      <span>
                        Chassi <b className="text-ink-100">{t.car.chassis}</b>
                      </span>
                      <span>
                        Confiab. <b className="text-ink-100">{t.car.reliability}</b>
                      </span>
                    </span>
                  }
                  meta={`Meta: terminar entre os ${t.driverTarget} primeiros`}
                />
              ))}
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card title="Resumo">
            <div className="text-xs uppercase tracking-wider text-ink-400">
              {NATIONALITIES.find((n) => n.code === nationality)?.name} · {age} anos
            </div>
            <div className="mt-1 font-display text-3xl font-bold uppercase leading-tight">
              {firstName || 'Nome'} <span className="text-apex-400">{lastName || 'Sobrenome'}</span>
            </div>
            <div className="mt-4 flex items-end gap-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Geral</div>
                <div className="font-display text-5xl font-bold tabular">{formatRating(overallRating(attributes))}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Potencial</div>
                <div className="font-display text-5xl font-bold tabular text-ink-400">{preset.potential}</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-ink-300">
              {preset.name} · {TEAMS.find((t) => t.id === teamId)?.name}
            </div>
            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-apex-600/50 bg-apex-600/10 px-3 py-2 text-sm text-apex-400">
                {error}
              </div>
            )}
            <Button variant="primary" className="mt-6 h-12 w-full text-base" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'Criando…' : 'Começar carreira'}
            </Button>
            {problems.length > 0 && !error && <div className="mt-2 text-xs text-ink-400">{problems[0]}</div>}
          </Card>
        </aside>
      </div>
    </div>
  );
}

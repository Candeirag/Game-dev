import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import type { AttributeKey } from '@/domain/schemas';
import { ATTRIBUTE_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
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
import { Card, ChoiceCard, RatingBar, TeamSwatch, cx } from '../components/ui';
import { formatRating } from '../format';
import { ScreenAction } from '../layout/ScreenAction';
import { WIDE_QUERY, useMediaQuery } from '../layout/chrome';

const field =
  'min-h-11 w-full border border-ink-700 bg-ink-850 px-3 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-apex-500 focus:outline-none';
const fieldLabel = 'block text-[11px] font-medium text-ink-400';
const stepButton = 'grid h-11 w-11 shrink-0 place-items-center border border-ink-700 text-ink-300 transition-colors hover:border-ink-400 disabled:opacity-30';

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
  // O mesmo corte da moldura da carreira: tela deitada (ou larga) põe o formulário em duas colunas.
  const wide = useMediaQuery(WIDE_QUERY);

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

  const safeX = 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]';

  return (
    <div className="min-h-dvh">
      {/* Faixa fixa: o resumo do piloto e o botão de começar ficam à vista enquanto o formulário rola. */}
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900 pt-[env(safe-area-inset-top)]">
        <div className={cx('mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 py-1.5', safeX)}>
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center text-ink-300 transition-colors hover:text-ink-100"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div className="min-w-40 flex-1">
            <div className="flex items-baseline gap-x-3">
              <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Crie seu piloto</h1>
              <span className="truncate text-xs font-medium text-ink-400">Nova carreira</span>
            </div>
            <div className="mt-1 truncate text-xs text-ink-300">
              {problems.length > 0 ? (
                <span className="text-ink-400">{problems[0]}</span>
              ) : (
                <>
                  <span className="font-semibold text-apex-400">
                    {firstName.trim()} {lastName.trim()}
                  </span>{' '}
                  · {NATIONALITIES.find((n) => n.code === nationality)?.name} · {age} anos · {preset.name} · {TEAMS.find((t) => t.id === teamId)?.name}
                </>
              )}
            </div>
          </div>
          <div className={cx('flex items-center gap-4', !wide && 'w-full justify-between')}>
            <div className="flex items-center gap-4">
              <HeaderStat label="Geral" value={formatRating(overallRating(attributes))} />
              <HeaderStat label="Potencial" value={preset.potential} muted />
            </div>
            <ScreenAction onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Criando…' : 'Começar carreira'}
            </ScreenAction>
          </div>
        </div>
        {error && (
          <div role="alert" className="border-t border-gold-400/40 bg-gold-400/10 py-2 text-sm text-gold-400">
            <div className={cx('mx-auto max-w-6xl', safeX)}>{error}</div>
          </div>
        )}
      </header>

      <div className={cx('mx-auto grid max-w-6xl items-start gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4', safeX, wide && 'grid-cols-2')}>
        <div className="space-y-4">
          <Card title="1 · Identidade" bodyClassName="p-3">
            <div className="grid grid-cols-10 gap-x-3 gap-y-2.5">
              <label className="col-span-5 space-y-1">
                <span className={fieldLabel}>Nome</span>
                <input className={field} value={firstName} maxLength={20} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex.: Ana" />
              </label>
              <label className="col-span-5 space-y-1">
                <span className={fieldLabel}>Sobrenome</span>
                <input className={field} value={lastName} maxLength={24} onChange={(e) => setLastName(e.target.value)} placeholder="Ex.: Ribeiro" />
              </label>
              <label className="col-span-4 space-y-1">
                <span className={fieldLabel}>Nacionalidade</span>
                <select className={cx(field, 'px-2')} value={nationality} onChange={(e) => setNationality(e.target.value)}>
                  {NATIONALITIES.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-6 space-y-1">
                <span className={fieldLabel}>Idade</span>
                <select className={cx(field, 'px-2')} value={age} onChange={(e) => setAge(Number(e.target.value))}>
                  {Array.from({ length: PLAYER_MAX_AGE - PLAYER_MIN_AGE + 1 }, (_, i) => PLAYER_MIN_AGE + i).map((a) => (
                    <option key={a} value={a}>
                      {a} anos {a <= 15 ? '(evolui mais rápido)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="2 · Perfil de piloto" bodyClassName="p-3">
            <div className="grid gap-2">
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
        </div>

        <div className="space-y-4">
          <Card
            title="3 · Pontos livres"
            action={
              <span className={cx('font-display text-base font-semibold', remaining ? 'text-gold-400' : 'text-ink-400')}>
                {counted(remaining, 'restante', 'restantes')}
              </span>
            }
            bodyClassName="p-3"
          >
            <p className="mb-2 text-xs text-ink-400">
              Distribua {PLAYER_BONUS_POINTS} pontos, no máximo {PLAYER_BONUS_MAX_PER_ATTRIBUTE} por atributo. A experiência só cresce competindo.
            </p>
            <div className="grid gap-1">
              {TRAINABLE_ATTRIBUTES.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-[7.5rem] shrink-0 text-sm leading-tight">{ATTRIBUTE_LABELS[key]}</div>
                  <div className="min-w-8 flex-1">
                    <RatingBar value={attributes[key]} previous={preset.attributes[key]} />
                  </div>
                  <div className="w-7 shrink-0 text-right font-display text-lg font-semibold leading-none">{attributes[key]}</div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Remover ponto de ${ATTRIBUTE_LABELS[key]}`}
                      onClick={() => adjust(key, -1)}
                      disabled={!bonus[key]}
                      className={stepButton}
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Adicionar ponto em ${ATTRIBUTE_LABELS[key]}`}
                      onClick={() => adjust(key, 1)}
                      disabled={remaining <= 0 || (bonus[key] ?? 0) >= PLAYER_BONUS_MAX_PER_ATTRIBUTE}
                      className={stepButton}
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>

        <Card title="4 · Equipe" bodyClassName="p-3" className={cx(wide && 'col-span-2')}>
          <p className="mb-2 text-xs text-ink-400">
            Como estreante, só as equipes de entrada oferecem vaga. Um kart melhor aumenta a cobrança e o custo da vaga.
          </p>
          <div className={cx('grid gap-2', wide && 'grid-cols-3')}>
            {TEAMS.filter((t) => ROOKIE_TEAM_IDS.includes(t.id)).map((t) => (
              <ChoiceCard
                key={t.id}
                selected={teamId === t.id}
                onSelect={() => setTeamId(t.id)}
                title={
                  <span className="flex items-center gap-2">
                    <TeamSwatch team={t} />
                    {t.name}
                  </span>
                }
                description={
                  <span className="flex items-center gap-3">
                    {/* Largura fixa: o kart nunca encosta nos números ao lado. */}
                    <CarSprite categoryId="kart-regional" teamId={t.id} color={t.color} className="w-[min(32%,6rem)] shrink-0" title={`Kart da ${t.name}`} />
                    <span className="grid flex-1 grid-cols-3 gap-2">
                      <CarNumber label="Motor" value={t.car.engine} />
                      <CarNumber label="Chassi" value={t.car.chassis} />
                      <CarNumber label="Confiab." value={t.car.reliability} />
                    </span>
                  </span>
                }
                meta={`Meta: terminar entre os ${t.driverTarget} primeiros`}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Um número do resumo, na faixa do topo. */
function HeaderStat({ label, value, muted = false }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className="leading-none">
      <div className="text-[10px] font-medium text-ink-400">{label}</div>
      <div className={cx('mt-0.5 font-display text-2xl font-bold leading-none', muted ? 'text-ink-400' : 'text-ink-100')}>{value}</div>
    </div>
  );
}

/** Um número do kart da equipe (0 a 100). */
function CarNumber({ label, value }: { label: string; value: number }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[11px] font-medium text-ink-400">{label}</span>
      <span className="block font-display text-lg font-semibold leading-tight text-ink-100">{value}</span>
    </span>
  );
}

/**
 * Ficha do nascimento: família, corpo e mente e os talentos e defeitos (os ocultos aparecem como
 * "?"). Usada na tela de nascimento, com a revelação em sequência, e na ficha do piloto, já
 * preenchida.
 */
import { Briefcase, HandCoins, MapPin, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AttributeKey, Birth } from '@/domain/schemas';
import { ATTRIBUTE_LABELS } from '@/domain/labels';
import { APTITUDE_INFO, APTITUDE_ORDER, BIRTH_TRAITS, FATHER_PROFESSIONS, HOMETOWNS, MOTHER_PROFESSIONS } from '@/data/birth';
import { birthAttributeBonus, charismaSponsorFactor } from '@/engine';
import { Card, Delta, ProgressBar, RevealItem, SecretCard, meterTone, type RevealSequence } from '@/ui/kit';
import { counted } from '@/domain/text';
import { formatMoney } from '../format';

/** A sequência já completa, para a ficha mostrada sem animação. */
const STILL: RevealSequence = { shown: true, animate: false };

export function hometownOf(birth: Birth) {
  return HOMETOWNS.find((h) => h.id === birth.hometownId);
}

/** "Capão Redondo, zona sul de São Paulo". */
export function hometownLabel(birth: Birth): string {
  const town = hometownOf(birth);
  return town ? `${town.name}, ${town.detail}` : birth.hometownId;
}

function FamilyRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden className="mt-1 shrink-0 text-ink-400">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xs font-medium text-ink-400">{label}</div>
        <div className="text-sm text-ink-100">{children}</div>
      </div>
    </div>
  );
}

export function BirthFamily({ birth, sequence = STILL, from = 0 }: { birth: Birth; sequence?: RevealSequence; from?: number }) {
  const mother = MOTHER_PROFESSIONS.find((p) => p.id === birth.parents.mother)?.name ?? birth.parents.mother;
  const father = FATHER_PROFESSIONS.find((p) => p.id === birth.parents.father)?.name ?? birth.parents.father;
  const interior = birth.region === 'interior';
  return (
    <Card title="Família" bodyClassName="grid gap-2 p-4">
      <RevealItem index={from} sequence={sequence}>
        <FamilyRow icon={<MapPin size={16} />} label={interior ? 'Interior' : 'Capital'}>
          {hometownLabel(birth)}
        </FamilyRow>
      </RevealItem>
      <RevealItem index={from + 1} sequence={sequence}>
        <FamilyRow icon={<Briefcase size={16} />} label="Mãe e pai">
          {mother} · {father}
        </FamilyRow>
      </RevealItem>
      <RevealItem index={from + 2} sequence={sequence}>
        <FamilyRow icon={<Wallet size={16} />} label="Economias da família">
          {formatMoney(birth.savings)}
        </FamilyRow>
      </RevealItem>
      <RevealItem index={from + 3} sequence={sequence}>
        <FamilyRow icon={<HandCoins size={16} />} label="Ajuda por ano">
          {birth.support.seasons > 0
            ? `${formatMoney(birth.support.perSeason)} ${birth.support.seasons === 1 ? 'na primeira temporada' : `nas ${birth.support.seasons} primeiras temporadas`}`
            : 'A família não tem como ajudar'}
        </FamilyRow>
      </RevealItem>
      {interior && (
        <RevealItem index={from + 4} sequence={sequence}>
          <p className="border-t border-ink-700 pt-2 text-xs text-ink-300">
            {birth.movedSeason !== null
              ? `Mudou-se para São Paulo na temporada ${birth.movedSeason}.`
              : 'Quem vem do interior começa na equipe menor do regional e paga viagens a cada etapa. A mudança para São Paulo vem cedo, com custo e saudade.'}
          </p>
        </RevealItem>
      )}
    </Card>
  );
}

/** O que cada aptidão soma na ficha inicial, em pontos de atributo (ou, no carisma, nos patrocínios). */
function linkedBonus(birth: Birth, key: (typeof APTITUDE_ORDER)[number]): { label: string; value: number }[] {
  if (key === 'charisma') return [];
  const single = birthAttributeBonus({ reflexes: 50, physique: 50, intelligence: 50, composure: 50, charisma: 50, [key]: birth.aptitudes[key] });
  return (Object.entries(single) as [AttributeKey, number][])
    .filter(([, value]) => value !== 0)
    .map(([attribute, value]) => ({ label: ATTRIBUTE_LABELS[attribute], value }));
}

export function BirthAptitudes({ birth, sequence = STILL, from = 0 }: { birth: Birth; sequence?: RevealSequence; from?: number }) {
  const sponsors = charismaSponsorFactor(birth.aptitudes.charisma) - 1;
  return (
    <Card title="Corpo e mente" action={<span className="text-xs text-ink-400">50 é o piloto comum</span>} bodyClassName="grid gap-2 px-4 py-2">
      {APTITUDE_ORDER.map((key, i) => {
        const value = birth.aptitudes[key];
        const bonus = linkedBonus(birth, key);
        return (
          <RevealItem key={key} index={from + i} sequence={sequence}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink-100">{APTITUDE_INFO[key].label}</span>
              <span className="font-display text-xl font-bold leading-none">{value}</span>
            </div>
            <ProgressBar value={value} tone={meterTone(value)} label={`${APTITUDE_INFO[key].label}: ${value} de 100`} className="my-1" />
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
              <span>{APTITUDE_INFO[key].description}</span>
              {bonus.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1 text-ink-300">
                  {b.label}
                  <Delta value={b.value} className="text-xs" />
                </span>
              ))}
              {key === 'charisma' && Math.abs(sponsors) >= 0.005 && (
                <span className="inline-flex items-center gap-1 text-ink-300">
                  Patrocínios
                  <Delta value={sponsors * 100} suffix="%" format={(v) => Math.round(v).toString()} className="text-xs" />
                </span>
              )}
            </div>
          </RevealItem>
        );
      })}
    </Card>
  );
}

export function BirthTraits({
  birth,
  sequence = STILL,
  from = 0,
  showRevealed = true,
}: {
  birth: Birth;
  sequence?: RevealSequence;
  from?: number;
  showRevealed?: boolean;
}) {
  const hidden = birth.traits.filter((t) => t.revealedSeason === null).length;
  return (
    <Card
      title="Talentos e defeitos"
      action={<span className="text-xs text-ink-400">{hidden > 0 ? `${counted(hidden, 'oculto', 'ocultos')}: descubra na pista` : 'Todos revelados'}</span>}
      bodyClassName="grid grid-cols-1 gap-2 p-4 xl:grid-cols-3"
    >
      {birth.traits.map((trait, i) => {
        const info = BIRTH_TRAITS[trait.id];
        const revealed = showRevealed && trait.revealedSeason !== null;
        return (
          <RevealItem key={trait.id} index={from + i} sequence={sequence}>
            <SecretCard
              hidden={!revealed}
              kind={info.kind}
              title={info.name}
              description={info.description}
              meta={revealed ? `Temporada ${trait.revealedSeason}, etapa ${trait.revealedRound}` : undefined}
              hint="Talento ou defeito"
            />
          </RevealItem>
        );
      })}
    </Card>
  );
}

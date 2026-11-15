/** Sucessão: a escolha do herdeiro. Fica no lugar de todas as telas enquanto estiver aberta. */
import { ArrowRight } from 'lucide-react';
import { SUCCESSION_CAUSE_LABELS } from '@/domain/labels';
import { ASSET_RULES } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { overallRating } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, PageHeader, Pill, Stat } from '../components/ui';
import { formatMoney } from '../format';
import { useCareer } from '../hooks/useCareer';

export function SuccessionScreen() {
  const career = useCareer();
  const resolve = useGameStore((s) => s.resolveSuccession);
  const cancel = useGameStore((s) => s.cancelHandover);
  const succession = career.succession;
  if (!succession) return null;
  const handover = succession.cause === 'handover';
  const owner = career.management?.position === 'owner';
  const siblings = career.family.children.length - 1;

  return (
    <div>
      <PageHeader
        eyebrow={`${SUCCESSION_CAUSE_LABELS[succession.cause]} · ${succession.year}`}
        title={handover ? 'Quem assume a família?' : `Adeus, ${succession.formerName}`}
      >
        {handover && (
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
        )}
      </PageHeader>

      {/* Na tela deitada: o contexto (o que aconteceu, patrimônio e imposto) à esquerda e a decisão, os herdeiros, à direita. */}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card tone="attention" bodyClassName="p-3">
          <p className="text-sm leading-snug text-ink-300">
            {handover
              ? `${succession.formerName} decidiu passar o comando. `
              : succession.cause === 'accident'
                ? `${succession.formerName} não resistiu a um acidente em corrida. `
                : `${succession.formerName} morreu. `}
            A história da família {career.dynasty.surname} continua. Escolha quem assume e por qual caminho: <b className="text-ink-100">nas pistas</b>, o
            herdeiro vira o seu piloto, na categoria em que já corre; <b className="text-ink-100">nos negócios</b>, ele assume o patrimônio
            {owner ? ' e a equipe da família' : ''}.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-700 pt-3">
            <Stat label="Patrimônio" value={formatMoney(succession.estate)} hint={owner ? 'Inclui a equipe' : undefined} />
            <Stat
              label={handover ? 'Imposto sobre a doação' : 'Imposto de herança'}
              value={formatMoney(succession.tax)}
              hint={`${(handover ? ASSET_RULES.HANDOVER_TAX : ASSET_RULES.INHERITANCE_TAX) * 100}% acima de ${formatMoney(ASSET_RULES.INHERITANCE_EXEMPT)}`}
            />
            <Stat
              label="Geração"
              value={
                <span className="inline-flex items-center gap-1">
                  {career.dynasty.generation}ª
                  <ArrowRight size={18} strokeWidth={2.5} className="text-ink-400" aria-label="para" />
                  {career.dynasty.generation + 1}ª
                </span>
              }
            />
            <Stat label="Parte dos irmãos" value={`${ASSET_RULES.SIBLING_SHARE * 100}% cada`} hint="Se o herdeiro for um dos filhos (até três irmãos)" />
          </div>
        </Card>

        <div className="grid items-start gap-3 lg:grid-cols-2">
          {succession.heirs.map((heir) => {
            const child = heir.childId ? career.family.children.find((c) => c.id === heir.childId) : undefined;
            const driver = child?.driver ?? heir.driver;
            const racing = child?.racing ?? heir.racing;
            return (
              <Card key={heir.id} bodyClassName="flex flex-col p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-xl font-bold uppercase leading-tight">{heir.name}</span>
                    <span className="text-sm text-ink-400">{heir.age} anos</span>
                  </div>
                  <Pill tone={heir.kind === 'child' ? 'good' : 'neutral'}>
                    {heir.kind === 'child' ? 'Filho(a)' : heir.kind === 'partner' ? 'Cônjuge' : 'Parente'}
                  </Pill>
                </div>
                <p className="mt-1 flex-1 text-sm leading-snug text-ink-300">{heir.description}</p>
                {heir.canDrive && driver && racing && (
                  <p className="mt-1 text-xs text-ink-400">
                    Piloto: nota geral <b className="text-ink-100">{Math.floor(overallRating(driver.attributes))}</b>, potencial{' '}
                    <b className="text-ink-100">{Math.floor(driver.potential)}</b>, {getCategory(racing.categoryId).shortName}, reputação{' '}
                    {Math.floor(racing.reputation)}.
                  </p>
                )}
                {heir.kind === 'child' && siblings > 0 && (
                  <p className="mt-1 text-xs text-ink-400">
                    {siblings === 1
                      ? 'O irmão recebe a parte dele e sai do seu acompanhamento.'
                      : `Os ${siblings} irmãos recebem a parte deles e saem do seu acompanhamento.`}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button variant="primary" disabled={!heir.canDrive} onClick={() => resolve(heir.id, 'driver')}>
                    Continuar nas pistas
                  </Button>
                  <Button disabled={!heir.canManage} onClick={() => resolve(heir.id, 'executive')}>
                    Assumir os negócios
                  </Button>
                </div>
                {!heir.canDrive && !heir.canManage && (
                  <p className="mt-2 text-xs text-gold-400">Ainda não pode assumir. Escolha um tutor (cônjuge ou parente) para cuidar de tudo até lá.</p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

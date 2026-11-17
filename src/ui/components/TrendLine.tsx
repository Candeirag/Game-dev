/**
 * Tendência por temporada: um gráfico pequeno com o valor de cada temporada fechada e o de hoje,
 * e ao lado a variação desde o primeiro ponto (seta + sinal). Os dados vêm do retrato das
 * temporadas (`career.seasonTrend`); só exibição.
 */
import type { AttributeKey, CareerState } from '@/domain/schemas';
import { Delta, Sparkline, type Tone } from '@/ui/kit';
import { counted } from '@/domain/text';

/** Um atributo (ou a nota geral) do piloto atual a cada temporada fechada, mais o valor de hoje. */
export function attributeSeries(career: CareerState, playerId: string, key: AttributeKey | 'overall', current: number): number[] {
  const past = career.seasonTrend.flatMap((point) => {
    if (point.driverId !== playerId || !point.attributes || point.overall === null) return [];
    return [key === 'overall' ? point.overall : point.attributes[key]];
  });
  return [...past, current];
}

/** O caixa no fechamento de cada temporada, mais o de hoje. */
export function cashSeries(career: CareerState): number[] {
  return [...career.seasonTrend.map((point) => point.cash), career.finance.cash];
}

export function TrendLine({
  title,
  values,
  format,
  tone = 'neutral',
  zeroLine = false,
  threshold = 0.05,
}: {
  /** O que a linha mostra ("Nota geral", "Caixa"). */
  title: string;
  /** Um valor por temporada fechada, da mais antiga para a mais recente, e o de hoje por último. */
  values: readonly number[];
  format: (value: number) => string;
  tone?: Tone;
  zeroLine?: boolean;
  threshold?: number;
}) {
  const first = values[0];
  const last = values.at(-1);
  if (first === undefined || last === undefined) return null;
  const enough = values.length >= 2;
  const label = enough
    ? `${title} por temporada: de ${format(first)} a ${format(last)} em ${counted(values.length - 1, 'temporada', 'temporadas')}`
    : `${title} por temporada: ainda sem histórico`;
  return (
    <div className="flex items-center gap-2">
      <Sparkline values={values} label={label} tone={tone} zeroLine={zeroLine} />
      <div className="min-w-0 text-xs leading-snug text-ink-300">
        <div className="font-semibold text-ink-100">{title} por temporada</div>
        {enough ? (
          <div className="flex flex-wrap items-center gap-x-2">
            <span>
              {format(first)} → {format(last)}
            </span>
            <Delta value={last - first} showZero threshold={threshold} format={(v) => format(v)} />
          </div>
        ) : (
          <div className="text-ink-400">O gráfico ganha um ponto a cada temporada fechada.</div>
        )}
      </div>
    </div>
  );
}

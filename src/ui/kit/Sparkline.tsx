/**
 * Gráfico pequeno de linha, para ver uma tendência de relance (atributos por temporada, caixa
 * por temporada). Não tem eixos: o primeiro e o último valor vão escritos ao lado por quem usa,
 * e o rótulo acessível descreve a série inteira. Com menos de dois pontos, mostra só a linha de
 * base tracejada.
 */
import { cx, type Tone } from './cx';

const STROKE: Record<Tone, string> = { neutral: 'stroke-ink-200', good: 'stroke-go-400', attention: 'stroke-gold-400', accent: 'stroke-apex-400' };
const FILL: Record<Tone, string> = { neutral: 'fill-ink-200', good: 'fill-go-400', attention: 'fill-gold-400', accent: 'fill-apex-400' };

export function Sparkline({
  values,
  label,
  tone = 'neutral',
  width = 96,
  height = 28,
  zeroLine = false,
  className,
}: {
  values: readonly number[];
  /** Descrição da série para leitores de tela ("Caixa por temporada: de R$ 10 mil a R$ 42 mil em 5 temporadas"). */
  label: string;
  tone?: Tone;
  width?: number;
  height?: number;
  /** Desenha a linha do zero quando a série cruza de positivo para negativo (caixa). */
  zeroLine?: boolean;
  className?: string;
}) {
  const pad = 3;
  const min = Math.min(...values, zeroLine ? 0 : Number.POSITIVE_INFINITY);
  const max = Math.max(...values, zeroLine ? 0 : Number.NEGATIVE_INFINITY);
  const span = max - min || 1;
  const x = (index: number) => pad + (values.length <= 1 ? 0 : (index / (values.length - 1)) * (width - 2 * pad));
  const y = (value: number) => height - pad - ((value - min) / span) * (height - 2 * pad);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const last = values.at(-1);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cx('shrink-0 overflow-visible', className)}>
      <title>{label}</title>
      {values.length < 2 ? (
        <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} className="stroke-ink-500" strokeWidth="1.5" strokeDasharray="3 4" />
      ) : (
        <>
          {zeroLine && min < 0 && max > 0 && (
            <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} className="stroke-ink-500" strokeWidth="1" strokeDasharray="2 3" />
          )}
          <polyline points={points} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={STROKE[tone]} />
        </>
      )}
      {last !== undefined && values.length >= 2 && <circle cx={x(values.length - 1)} cy={y(last)} r="2.6" className={FILL[tone]} />}
    </svg>
  );
}

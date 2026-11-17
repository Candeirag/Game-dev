/**
 * Textos das portas da carreira (Fase 3 da grande atualização): nomes dos investidores e dos
 * trabalhos paralelos. São nomes inventados; nenhuma marca real. Os números ficam em
 * `src/config/balance.ts` (`INVESTOR`, `SIDE_JOBS`…).
 */
import type { SideJob } from '@/domain/schemas';

/** Investidores que podem bater à porta. A semente da carreira escolhe um. */
export const INVESTOR_NAMES = [
  'Largada Capital',
  'Fundo Reta Oposta',
  'Grupo Tangência',
  'Ápice Participações',
  'Curva Um Investimentos',
  'Bandeirada Capital',
] as const;

export const SIDE_JOB_INFO: Readonly<Record<SideJob, { name: string; description: string }>> = {
  none: { name: 'Só treinar', description: 'Todo o tempo livre vai para o treino.' },
  instructor: { name: 'Instrutor de kart', description: 'Aulas para iniciantes no kartódromo nos dias sem corrida.' },
  mechanic: { name: 'Ajudante de mecânico', description: 'Turnos na oficina da equipe: paga menos, mas você aprende a consertar o próprio equipamento.' },
};

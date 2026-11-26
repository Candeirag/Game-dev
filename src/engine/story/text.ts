/**
 * Montagem dos textos dos cartões: troca os marcadores (`{rival}`, `{categoria:em}`,
 * `{pessoa:chefe-kart}`…) pelos nomes do momento. O `^` na frente põe a primeira letra em
 * maiúscula. Um marcador desconhecido ou sem vínculo é erro: o validador dos dados
 * (`tests/storyEvents.test.ts`) o pega antes de chegar ao jogo.
 */
import type { CategoryId } from '@/domain/schemas';
import { CATEGORY_NAMES, type CategoryLink, categoryRef } from '@/domain/categoryNames';
import { capitalize, counted } from '@/domain/text';
import { HOMETOWNS } from '@/data/birth';
import { getTrack } from '@/data/tracks';
import { fullName, money } from '../career/selectors';
import { predecessor } from '../dynasty/surname';
import type { StoryBindings } from './bindings';
import type { StoryContext } from './context';

/** `{nome}`, `{^rival}`, `{categoria:em}`, `{pessoa:chefe-kart}`. */
export const placeholderPattern = /\{(\^?)([a-zA-Z]+)(?::([a-z0-9-]+))?\}/g;

const categoryLinks: readonly CategoryLink[] = ['the', 'de', 'em', 'a', 'para', 'por'];

/** Valores extras de um cartão especial (proposta de patrocínio). */
export type StoryExtras = Readonly<Record<string, string>>;

export function hometownName(ctx: StoryContext): string {
  return HOMETOWNS.find((h) => h.id === ctx.birth?.hometownId)?.name ?? 'São Paulo';
}

function trackOf(ctx: StoryContext): string {
  const id = ctx.record?.trackId ?? ctx.career.calendar[0]?.trackId;
  return id ? getTrack(id).name : '';
}

function categoryText(id: CategoryId, arg: string | undefined): string {
  if (!arg) return CATEGORY_NAMES[id].name;
  if (!(categoryLinks as readonly string[]).includes(arg)) throw new Error(`Ligação de categoria desconhecida: ${arg}`);
  return categoryRef(id, arg as CategoryLink);
}

function value(ctx: StoryContext, b: StoryBindings, extras: StoryExtras, name: string, arg: string | undefined): string {
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`O marcador {${what}} não tem vínculo neste cartão.`);
    return v;
  };
  const person = () => need(arg ? b.persons[arg] : undefined, `${name}:${arg ?? ''}`);
  if (name in extras) return extras[name] ?? '';
  switch (name) {
    case 'nome':
      return ctx.player.firstName;
    case 'piloto':
      return fullName(ctx.player);
    case 'equipe':
      return ctx.team?.name ?? 'a equipe';
    case 'categoria':
      return categoryText(ctx.career.categoryId, arg);
    case 'pista':
      return trackOf(ctx);
    case 'cidade':
      return hometownName(ctx);
    case 'ano':
      return String(ctx.career.year);
    case 'companheiro':
      return fullName(need(b.teammate, name));
    case 'rival':
      return fullName(need(b.rival, name));
    case 'outro':
      return fullName(need(b.other, name));
    case 'lider':
      return fullName(need(b.leader, name));
    case 'patrocinador':
      return need(b.sponsor, name).name;
    case 'equipeInteressada':
      return need(b.interestedTeam, name).team.name;
    case 'outraEquipe':
      return need(b.otherTeam, name).team.name;
    case 'pontos':
      return counted(need(b.roundPoints, name), 'ponto', 'pontos');
    case 'valor':
      return money(ctx.career, need(b.cashCall, name).amount);
    case 'academia':
      return need(b.academy, name).academy.name;
    case 'equipeTopo':
      return need(b.academy, name).topTeam;
    case 'chance':
      return `${Math.round(need(b.academy, name).chance * 100)}%`;
    case 'meta':
      return String(need(b.academy, name).academy.targetPosition);
    case 'pessoa':
      return fullName(person());
    case 'primeiro':
      return person().firstName;
    case 'org':
      return person().org ?? person().role;
    // Fase 6: o sobrenome da família, quem veio antes na linhagem e o bebê que o cartão faz nascer.
    case 'sobrenome':
      return ctx.career.dynasty.surname;
    case 'antecessor':
      return need(predecessor(ctx.career)?.name, name);
    case 'bebe':
      return need(b.baby, name).firstName;
    default:
      throw new Error(`Marcador desconhecido: {${name}}`);
  }
}

export function renderText(template: string, ctx: StoryContext, bindings: StoryBindings, extras: StoryExtras = {}): string {
  return template.replace(placeholderPattern, (_all, caps: string, name: string, arg: string | undefined) => {
    const text = value(ctx, bindings, extras, name, arg);
    return caps ? capitalize(text) : text;
  });
}

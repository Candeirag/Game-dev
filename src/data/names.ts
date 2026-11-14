/**
 * Nomes usados para gerar pilotos da IA nas categorias que não têm elenco
 * escrito à mão. São nomes comuns em cada país; qualquer semelhança com
 * pilotos reais é coincidência.
 */
export interface NamePool {
  code: string;
  first: readonly string[];
  last: readonly string[];
}

export const NAME_POOLS: readonly NamePool[] = [
  { code: 'BR', first: ['Lucas', 'Pedro', 'Rafael', 'Thiago', 'Bruno', 'Caio', 'Felipe', 'Gustavo', 'Vitor', 'Murilo', 'Davi', 'Otávio', 'Renan', 'Igor'], last: ['Azevedo', 'Barros', 'Camargo', 'Dantas', 'Esteves', 'Figueiredo', 'Guimarães', 'Leme', 'Marins', 'Novaes', 'Queiroz', 'Rezende', 'Siqueira', 'Vasconcelos'] },
  { code: 'AR', first: ['Mateo', 'Franco', 'Santiago', 'Tomás', 'Joaquín', 'Agustín'], last: ['Acosta', 'Benítez', 'Cabrera', 'Domínguez', 'Ferreyra', 'Giménez'] },
  { code: 'IT', first: ['Lorenzo', 'Matteo', 'Andrea', 'Davide', 'Riccardo', 'Gabriele', 'Federico'], last: ['Bianchi', 'Colombo', 'De Luca', 'Ferri', 'Galli', 'Marchetti', 'Rinaldi'] },
  { code: 'GB', first: ['Oliver', 'Harry', 'George', 'Callum', 'Jamie', 'Alfie', 'Freddie'], last: ['Ashworth', 'Bennett', 'Carter', 'Dawson', 'Fletcher', 'Hughes', 'Whitaker'] },
  { code: 'FR', first: ['Hugo', 'Louis', 'Théo', 'Jules', 'Antoine', 'Maxime'], last: ['Blanchard', 'Chevalier', 'Dufour', 'Fontaine', 'Lambert', 'Moreau'] },
  { code: 'DE', first: ['Lukas', 'Jonas', 'Felix', 'Niklas', 'Moritz', 'Tim'], last: ['Albrecht', 'Brandt', 'Fischer', 'Hartmann', 'Keller', 'Vogel'] },
  { code: 'ES', first: ['Álvaro', 'Pablo', 'Marc', 'Íker', 'Daniel', 'Adrián'], last: ['Aguilar', 'Castaño', 'Herrero', 'Molina', 'Navarro', 'Vidal'] },
  { code: 'NL', first: ['Daan', 'Sem', 'Bram', 'Thijs', 'Luuk'], last: ['Bakker', 'De Groot', 'Jansen', 'Smits', 'Van Dijk'] },
  { code: 'JP', first: ['Haruto', 'Ren', 'Sota', 'Kaito', 'Riku'], last: ['Fujita', 'Inoue', 'Kimura', 'Mori', 'Sakamoto'] },
  { code: 'US', first: ['Logan', 'Tyler', 'Mason', 'Carter', 'Hunter'], last: ['Brooks', 'Coleman', 'Hayes', 'Mitchell', 'Sullivan'] },
  { code: 'AU', first: ['Jack', 'Cooper', 'Lachlan', 'Riley'], last: ['Campbell', 'Fraser', 'Mackay', 'Walsh'] },
  { code: 'MX', first: ['Emiliano', 'Diego', 'Sebastián', 'Rodrigo'], last: ['Cárdenas', 'Fuentes', 'Ibarra', 'Zamora'] },
  { code: 'SE', first: ['Elias', 'Oscar', 'Linus', 'Viktor'], last: ['Berglund', 'Ekström', 'Lindqvist', 'Nyström'] },
  { code: 'DK', first: ['Magnus', 'Emil', 'Mikkel'], last: ['Dahl', 'Holm', 'Kjær'] },
  { code: 'CN', first: ['Wei', 'Hao', 'Jun'], last: ['Chen', 'Liang', 'Zhao'] },
];

/**
 * Peso de cada nacionalidade por tipo de campeonato. No kart nacional, quase
 * todo o grid é brasileiro; nos campeonatos internacionais, o peso segue a
 * presença histórica de cada país no automobilismo europeu.
 */
export const NATIONALITY_WEIGHTS: Record<'national' | 'international', Readonly<Record<string, number>>> = {
  national: { BR: 16, AR: 2, MX: 1 },
  international: { BR: 3, AR: 1, IT: 4, GB: 4, FR: 3, DE: 3, ES: 3, NL: 2, JP: 2, US: 2, AU: 1, MX: 1, SE: 1, DK: 1, CN: 1 },
};

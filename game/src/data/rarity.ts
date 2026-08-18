/**
 * As raridades moram em `data/balance/raridades.ts`, junto com as outras
 * tabelas de balanceamento. Este arquivo continua existindo como ponto de
 * importação para o resto do jogo — `@data/rarity` é o nome que a UI, o loot e
 * a cena já usam, e renomear vinte importações não paga o ruído no histórico.
 */
export {
  MAX_RARITY,
  PESO_TOTAL,
  RARITIES,
  rarityInfo,
  type RarityInfo,
} from './balance/raridades';

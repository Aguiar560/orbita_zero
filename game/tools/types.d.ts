/**
 * Constantes que o Vite injeta no bundle (`define`), e que portanto não existem
 * em nenhum arquivo de código.
 *
 * `tsconfig.json` inclui este arquivo justamente para elas terem tipo sem
 * precisarem de um `import` que não teria de onde vir.
 */

/**
 * O carimbo deste build. Muda a cada `vite build`, e é o mesmo valor publicado
 * em `/versao.json` — ver `versaoPlugin` no `vite.config.ts` e `app/versao.ts`.
 */
declare const __VERSAO_DO_BUNDLE__: string;

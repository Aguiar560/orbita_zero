/**
 * Catraca do `tsc` sobre `tests/`.
 *
 * ## Por que uma catraca e não um portão
 *
 * Até 13/09/2026 nenhum `tsc` olhava para `tests/`, e o custo apareceu no mesmo
 * dia: ao remover o campo `autoEquip` do estado, sete arquivos de teste
 * continuaram citando um campo que não existia mais e **nada acusou**. Eles
 * passavam — atribuir propriedade inexistente é erro de tipo, não de execução —,
 * então a suíte seguia verde guardando uma regra já removida.
 *
 * Ligar o `tsc` ali encontrou 64 erros de uma vez. Fazer disso um portão
 * deixaria a integração vermelha desde o primeiro dia, e integração sempre
 * vermelha ensina a ignorar integração — o mesmo argumento que já vale para o
 * alerta de recusas: "um alerta que se repete deixa de significar o que
 * significava".
 *
 * Então ela trava o CRESCIMENTO, não o estado. Escrever teste novo com erro de
 * tipo quebra; os 64 antigos esperam a vez. No dia em que chegar a zero, isto
 * vira portão de verdade e o arquivo some.
 *
 * É a mesma disciplina da "linha de base" que os testes de balanceamento já
 * usam: fixar por escrito o quanto está quebrado hoje, para a melhora ser
 * mensurável e a piora, impossível.
 *
 *   npm run typecheck:testes
 */
import { execFileSync } from 'node:child_process';

/**
 * O quanto está quebrado hoje. **Só pode descer.**
 *
 * Ao baixar este número, baixe junto — é o registro de que a dívida diminuiu, e
 * sem isso a catraca para de apertar.
 */
const LIMITE = 64;

let saida = '';
try {
  execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.tests.json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
} catch (erro) {
  saida = `${erro.stdout ?? ''}${erro.stderr ?? ''}`;
}

const erros = saida.split('\n').filter((l) => / error TS\d+:/.test(l));
const porArquivo = new Map();
for (const linha of erros) {
  const arquivo = linha.split('(')[0];
  porArquivo.set(arquivo, (porArquivo.get(arquivo) ?? 0) + 1);
}

console.log(`erros de tipo em tests/: ${erros.length} (limite ${LIMITE})\n`);
for (const [arquivo, n] of [...porArquivo].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${String(n).padStart(3)}  ${arquivo}`);
}

if (erros.length > LIMITE) {
  console.error(
    `\nSUBIU: ${erros.length} > ${LIMITE}.`
    + '\nAlgum teste novo (ou alterado) tem erro de tipo. Conserte-o — a dívida'
    + '\nantiga pode esperar, mas ela não pode crescer.',
  );
  process.exit(1);
}

if (erros.length < LIMITE) {
  console.log(
    `\nCAIU para ${erros.length}. Baixe \`LIMITE\` neste arquivo para ${erros.length}`
    + '\npara a catraca continuar apertando. Em zero, troque isto por'
    + '\n`tsc --noEmit -p tsconfig.tests.json` direto no CI e apague este script.',
  );
  process.exit(1);
}

console.log('\nno limite, sem piora.');

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fonte = (arquivo: string): string => readFileSync(join(process.cwd(), arquivo), 'utf8');

describe('apelido obrigatório', () => {
  it('interrompe a entrada no jogo até a identidade pública existir', () => {
    const jogo = fonte('src/app/Game.ts');
    const login = jogo.indexOf('await new Login().mostrar(this.rootEl);');
    const apelido = jogo.indexOf('await buscarMeuApelido();');
    const portao = jogo.indexOf('await new IdentidadeObrigatoria(this.rootEl).mostrar();');
    const nuvem = jogo.indexOf('await this.juntarComANuvem();');

    expect(login).toBeGreaterThan(-1);
    expect(apelido).toBeGreaterThan(login);
    expect(portao).toBeGreaterThan(apelido);
    expect(nuvem).toBeGreaterThan(portao);
  });

  it('não deixa continuar com campo em branco ou apelido recusado', () => {
    const identidade = fonte('src/ui/IdentidadeObrigatoria.ts');
    expect(identidade).toContain("this.erro = 'Informe seu apelido para entrar no jogo.';");
    expect(identidade).toContain('await definirApelido(escolhido)');
    expect(identidade).toContain('if (resultado.ok)');
    expect(identidade).toContain('aoConcluir();');
  });

  it('também fecha a brecha no servidor quando já há um piloto no save', () => {
    const worker = fonte('server/src/index.ts');
    const salvar = worker.slice(worker.indexOf('async function subirSave'));
    expect(salvar).toContain("SELECT 1 FROM apelidos WHERE usuario = ?");
    expect(salvar).toContain("erro: 'apelido_obrigatorio'");
    expect(salvar.indexOf("erro: 'apelido_obrigatorio'")).toBeLessThan(salvar.indexOf('INSERT INTO saves'));
  });
});

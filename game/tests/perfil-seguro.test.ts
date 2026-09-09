import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const perfil = (): string => readFileSync(resolve(process.cwd(), 'src/ui/PerfilMenu.ts'), 'utf8');

describe('perfil seguro para transmissão', () => {
  it('não renderiza identificadores privados nem detalhes da sessão', () => {
    const source = perfil();
    expect(source).not.toContain('sessao.email');
    expect(source).not.toContain('sessao.usuarioId');
    expect(source).not.toContain('sessao.expiraEm');
    expect(source).not.toContain('navigator.clipboard');
    expect(source).not.toContain('title:');
  });

  it('troca dados de conta por informações úteis do jogo', () => {
    const source = perfil();
    for (const texto of [
      'DADOS PRIVADOS OCULTOS',
      'Nave ativa',
      'Setor atual',
      'Melhor setor',
      'Patente',
      'Frota',
      'Carga',
      'Tempo de jogo',
    ]) expect(source).toContain(texto);
  });

  it('usa o apelido público escolhido pelo jogador, inclusive após recarregar', () => {
    const source = perfil();
    const placar = readFileSync(resolve(process.cwd(), 'src/app/placar.ts'), 'utf8');
    expect(source).toContain('buscarMeuApelido');
    expect(source).toContain("apelidoAtual() ?? 'Piloto'");
    expect(source).not.toContain('pilotoDe');
    expect(placar).toContain("buscarPlacar('personagem')");
    expect(placar).toContain('estado.dados.meuApelido');
  });

  it('não mostra sincronização nem a antiga explicação do save', () => {
    const source = perfil();
    expect(source).not.toContain('SINCRONIZAÇÃO');
    expect(source).not.toContain('Última sincronização');
    expect(source).not.toContain('nuvem.');
    expect(source).not.toContain('O save sobe sozinho');
    expect(source).not.toContain('Última falha:');
  });
});

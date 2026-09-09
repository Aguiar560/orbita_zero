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
      'Última sincronização',
    ]) expect(source).toContain(texto);
  });

  it('não mostra a antiga explicação do save nem o erro técnico bruto', () => {
    const source = perfil();
    expect(source).not.toContain('O save sobe sozinho');
    expect(source).not.toContain('Última falha:');
  });
});

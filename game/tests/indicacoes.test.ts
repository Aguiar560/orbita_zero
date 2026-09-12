import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  comissaoDeIndicacao,
  comissaoRevertida,
  ESPERA_INDICACAO_SEGUNDOS,
  INTERVALO_SAQUE_INDICACAO_SEGUNDOS,
  MARCOS_INDICACAO,
  PERCENTUAL_INDICACAO_BPS,
  SAQUE_MINIMO_INDICACAO_CENTAVOS,
} from '@data/balance/indicacoes';
import {
  codigoDosBytes, codigoIndicacaoValido, normalizarCodigoIndicacao,
} from '../server/src/indicacoes';
import {
  cifrarChavePix, decifrarChavePix, mascararChavePix, normalizarChavePix,
} from '../server/src/pix-indicacoes';
import { CRYSTAL_PACKAGES } from '@sim/vip';

const fonte = (arquivo: string): string => readFileSync(arquivo, 'utf8');

describe('programa de indicações', () => {
  it('calcula 10% do dinheiro efetivamente pago, em centavos', () => {
    expect(PERCENTUAL_INDICACAO_BPS).toBe(1_000);
    expect(CRYSTAL_PACKAGES.map((pacote) =>
      comissaoDeIndicacao(pacote.priceCents))).toEqual([49, 149, 249, 499, 999]);
    expect(comissaoDeIndicacao(99)).toBe(9);
    expect(comissaoDeIndicacao(-1)).toBe(0);
  });

  it('espera sete dias e reverte reembolsos parciais cumulativamente', () => {
    expect(ESPERA_INDICACAO_SEGUNDOS).toBe(604_800);
    expect(comissaoRevertida(1_000, 2_500, 10_000)).toBe(250);
    expect(comissaoRevertida(1_000, 10_000, 10_000)).toBe(1_000);
    expect(comissaoRevertida(1_000, 20_000, 10_000)).toBe(1_000);
  });

  it('exige R$ 15 liberados e limita cada conta a um saque a cada sete dias', () => {
    expect(SAQUE_MINIMO_INDICACAO_CENTAVOS).toBe(1_500);
    expect(INTERVALO_SAQUE_INDICACAO_SEGUNDOS).toBe(604_800);
    const worker = fonte('server/src/index.ts');
    const migracao = fonte('server/migrations/0022-indicacoes.sql');
    expect(worker).toContain("erro: 'saque_abaixo_do_minimo'");
    expect(worker).toContain("erro: 'saque_semanal'");
    expect(migracao).toContain("RAISE(ABORT, 'saque_abaixo_do_minimo')");
    expect(migracao).toContain("RAISE(ABORT, 'saque_semanal')");
  });

  it('mantém os cristais somente nos marcos de pilotos no nível 25', () => {
    expect(MARCOS_INDICACAO).toEqual([
      { jogadores: 10, cristais: 300 }, { jogadores: 25, cristais: 700 },
      { jogadores: 50, cristais: 1_500 }, { jogadores: 75, cristais: 2_500 },
      { jogadores: 100, cristais: 4_000 },
    ]);
  });

  it('normaliza, valida e gera códigos sem símbolos ambíguos', () => {
    expect(normalizarCodigoIndicacao(' ab-cd234567 ')).toBe('ABCD234567');
    expect(codigoIndicacaoValido('ABCD234567')).toBe(true);
    expect(codigoIndicacaoValido('ABCD234560')).toBe(false);
    expect(codigoDosBytes(new Uint8Array(10))).toBe('2222222222');
  });

  it('valida os cinco tipos oficiais de chave Pix e nunca devolve a chave aberta', () => {
    expect(normalizarChavePix('cpf', '529.982.247-25')).toEqual({ tipo: 'cpf', chave: '52998224725' });
    expect(normalizarChavePix('email', ' PILOTO@EXEMPLO.COM ')).toEqual({ tipo: 'email', chave: 'piloto@exemplo.com' });
    expect(normalizarChavePix('telefone', '(11) 99999-9999')).toEqual({ tipo: 'telefone', chave: '+5511999999999' });
    expect(normalizarChavePix('aleatoria', '123e4567-e89b-12d3-a456-426614174000')).not.toBeNull();
    expect(normalizarChavePix('cpf', '111.111.111-11')).toBeNull();
    expect(mascararChavePix('cpf', '52998224725')).toBe('•••••••4725');
  });

  it('cifra a chave Pix com autenticação antes de persistir', async () => {
    const segredo = 'segredo-de-teste-com-pelo-menos-32-caracteres';
    const cifra = await cifrarChavePix('piloto@exemplo.com', segredo);
    expect(cifra).not.toContain('piloto');
    expect(await decifrarChavePix(cifra, segredo)).toBe('piloto@exemplo.com');
    await expect(decifrarChavePix(cifra, 'outro-segredo-com-pelo-menos-32-chars'))
      .rejects.toThrow();
  });

  it('mantém vínculo único, fila idempotente e exclusão de contas de teste no banco', () => {
    const migracao = fonte('server/migrations/0022-indicacoes.sql');
    expect(migracao).toContain('usuario     TEXT PRIMARY KEY');
    expect(migracao).toContain('compra               TEXT PRIMARY KEY');
    expect(migracao).toContain('pagamento            TEXT NOT NULL UNIQUE');
    expect(migracao).toContain('comissao_centavos');
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS carteiras_indicacao');
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS dados_pix_indicacao');
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS saques_indicacao');
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS marcos_indicacao');
    expect(migracao).toContain('liberar_comissao_indicacao');
    expect(migracao).toContain('reverter_comissao_liberada');
    expect(migracao).toContain("'preexistente'");
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS acoes_indicacao_admin');

    const worker = fonte('server/src/index.ts');
    expect(worker).toContain("d.estado = 'vinculada'");
    expect(worker).toContain('indicador_teste.usuario IS NULL');
    expect(worker).toContain('indicado_teste.usuario IS NULL');
    expect(worker).toContain('codigo_ativo.ativo = 1');
    expect(worker).toContain('liberarRecompensasDeIndicacao(env)');
    expect(worker).toContain("motivo: 'marco_indicacao'");
    expect(worker).toContain("url.pathname === '/admin/indicacoes/codigo'");
    expect(worker).toContain("url.pathname === '/indicacao/pix'");
    expect(worker).toContain("url.pathname === '/indicacao/saque'");
    expect(worker).toContain('INDICACOES_PIX_SECRET');
    expect(worker).toContain('podeLerPainelAdmin(usuario.id)');
    expect(worker).toContain('acoes_indicacao_admin');
    expect(worker).toContain('INDICACOES_ATIVAS');
  });

  it('captura o código no cliente sem confiar em metadados editáveis do usuário', () => {
    const conta = fonte('src/app/conta.ts');
    const sessao = fonte('src/app/sessao-unica.ts');
    expect(conta).toContain("busca.get('ref')");
    expect(conta).toContain('localStorage.setItem(CHAVE_INDICACAO');
    expect(sessao).toContain('codigoIndicacao: codigoIndicacaoPendente()');
    expect(conta).not.toContain('user_metadata');
  });
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { HULLS } from '../src/data/hulls';
import { ALL_ENEMIES } from '../src/data/enemies';
import { BOSSES } from '../src/data/bosses';
import { CHEFES_DA_PROVACAO } from '../src/data/provacao-chefes';
import { abrirDesafio, bossDoPiso } from '../src/sim/desafio';
import { perfilDaNave, perfilDoInimigo, perfilDoChefe, sintetizarDisparo, sintetizarExplosao, type PerfilSonoro } from '../src/render/SinteseSonora';
import type { ElementId } from '../src/sim/types';

const pasta = 'art-source/audio-combate';
mkdirSync(pasta, { recursive: true });
function wav(dados: Float32Array): Buffer {
  const b = Buffer.alloc(44 + dados.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dados.length * 2, 40);
  dados.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return b;
}
const linhas: string[] = ['# Catálogo sonoro de combate', '',
  'Gerado por `node tools/run-ts.mjs tools/exportar-audio.ts`. Síntese original, PCM mono de 24 kHz. O jogo sintetiza e reutiliza estes mesmos timbres em memória; os WAVs são matrizes para edição e audição, sem download obrigatório no boot.', '',
  'Elementos: cinético percussivo; fogo com pressão e ruído de plasma; gelo cristalino; raio com descarga FM; cósmico com ressonância; químico com ruído e modulação. A família de arma ajusta peso e duração. A cadência da ficha define a cauda; a cadência real com equipamento ajusta a reprodução. Uma voz por salva.', '',
  '| Grupo | Nave | ID / WAV | Elemento | Arma | Salvas/s base | Duração |',
  '|---|---|---|---|---|---:|---:|'];
let quantidade = 0;
function exportar(grupo: string, nome: string, p: PerfilSonoro): void {
  const arquivo = p.id.replaceAll(':', '_') + '.wav';
  writeFileSync(`${pasta}/${arquivo}`, wav(sintetizarDisparo(p)));
  linhas.push(`| ${grupo} | ${nome} | ${arquivo} | ${p.elemento} | ${p.familia} | ${p.cadencia.toFixed(2)} | ${Math.round(p.duracao * 1000)} ms |`);
  quantidade++;
}
for (const nave of HULLS) exportar(nave.prototype ? 'Protótipo' : 'Jogador', nave.name, perfilDaNave(nave));
for (const nave of ALL_ENEMIES) {
  if (nave.fireRate > 0 && nave.shots > 0 && !['nenhum', 'explosivo'].includes(nave.attack)) exportar('Inimigo', nave.name, perfilDoInimigo(nave));
  else linhas.push(`| Inimigo | ${nave.name} | ${nave.id} | ${nave.element} | Sem disparo — ${nave.attack} | — | — |`);
}
for (const chefe of BOSSES) chefe.phases.forEach((_, i) => exportar('Chefe campanha', `${chefe.name} · estágio ${i + 1}`, perfilDoChefe(chefe, i)));
for (const chefe of CHEFES_DA_PROVACAO) {
  const desafio = abrirDesafio(chefe.piso);
  const boss = bossDoPiso(chefe, desafio.efeitos);
  boss.phases.forEach((_, i) => exportar('Chefe Provação', `${chefe.nome} · estágio ${i + 1}`, perfilDoChefe(boss, i)));
}
for (const elemento of ['padrao', 'fogo', 'gelo', 'raio', 'cosmico', 'quimico'] as ElementId[]) {
  writeFileSync(`${pasta}/explosao_chefe_${elemento}.wav`, wav(sintetizarExplosao(elemento)));
}
linhas.push('', `${HULLS.length} cascos, ${ALL_ENEMIES.length} inimigos, ${BOSSES.length} chefes de campanha e ${CHEFES_DA_PROVACAO.length} chefes de Provação identificados. ${quantidade} disparos exportados (estágios incluídos) e 6 explosões elementais de chefe.`, '');
writeFileSync('docs/CATALOGO-SONORO.md', linhas.join('\n'));
console.log(linhas.at(-2));

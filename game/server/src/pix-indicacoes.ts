export type TipoDeChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

const digitos = (valor: string): string => valor.replace(/\D/g, '');

function documentoValido(valor: string, tamanho: 11 | 14): boolean {
  const n = digitos(valor);
  if (n.length !== tamanho || /^(\d)\1+$/.test(n)) return false;
  const bases = tamanho === 11 ? [9, 10] : [12, 13];
  for (let etapa = 0; etapa < 2; etapa++) {
    const base = bases[etapa]!;
    let soma = 0;
    for (let i = 0; i < base; i++) {
      const peso = tamanho === 11
        ? base + 1 - i
        : ((base - i - 1) % 8) + 2;
      soma += Number(n[i]) * peso;
    }
    const esperado = tamanho === 11
      ? (soma * 10) % 11 % 10
      : (soma % 11 < 2 ? 0 : 11 - (soma % 11));
    if (Number(n[base]) !== esperado) return false;
  }
  return true;
}

export function normalizarChavePix(tipo: unknown, valor: unknown): { tipo: TipoDeChavePix; chave: string } | null {
  if (!['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(String(tipo))) return null;
  if (typeof valor !== 'string') return null;
  const t = tipo as TipoDeChavePix;
  const bruto = valor.trim();
  if (!bruto || bruto.length > 120) return null;
  if (t === 'cpf') return documentoValido(bruto, 11) ? { tipo: t, chave: digitos(bruto) } : null;
  if (t === 'cnpj') return documentoValido(bruto, 14) ? { tipo: t, chave: digitos(bruto) } : null;
  if (t === 'email') {
    const chave = bruto.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave) && chave.length <= 77 ? { tipo: t, chave } : null;
  }
  if (t === 'telefone') {
    let n = digitos(bruto);
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    return n.length >= 12 && n.length <= 14 ? { tipo: t, chave: `+${n}` } : null;
  }
  const chave = bruto.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chave)
    ? { tipo: t, chave }
    : null;
}

export function mascararChavePix(tipo: TipoDeChavePix, chave: string): string {
  if (tipo === 'email') {
    const [nome, dominio] = chave.split('@');
    return `${nome?.slice(0, 2) ?? ''}•••@${dominio ?? ''}`;
  }
  if (tipo === 'telefone') return `••••••${chave.slice(-4)}`;
  if (tipo === 'cpf' || tipo === 'cnpj') return `${'•'.repeat(Math.max(0, chave.length - 4))}${chave.slice(-4)}`;
  return `${chave.slice(0, 4)}••••${chave.slice(-4)}`;
}

const bytesEmBase64 = (bytes: Uint8Array): string => {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64EmBytes = (texto: string): Uint8Array => {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, '='));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
};

async function chaveAes(segredo: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(segredo));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function cifrarChavePix(chave: string, segredo: string): Promise<string> {
  if (segredo.length < 32) throw new Error('segredo_pix_inseguro');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifra = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await chaveAes(segredo), new TextEncoder().encode(chave),
  );
  return `${bytesEmBase64(iv)}.${bytesEmBase64(new Uint8Array(cifra))}`;
}

export async function decifrarChavePix(valor: string, segredo: string): Promise<string> {
  const [iv, cifra] = valor.split('.');
  if (!iv || !cifra || segredo.length < 32) throw new Error('chave_pix_indisponivel');
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64EmBytes(iv) }, await chaveAes(segredo), base64EmBytes(cifra),
  );
  return new TextDecoder().decode(claro);
}

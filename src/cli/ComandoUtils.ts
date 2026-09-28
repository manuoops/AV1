export function exigirFlag(flags: Record<string, string>, nome: string): string {
  const valor = flags[nome];
  if (!valor || valor.trim().length === 0) {
    throw new Error(`Flag obrigatória ausente: --${nome}`);
  }
  return valor;
}

export function analisarData(valor: string, nomeFlag: string): Date {
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    throw new Error(`Valor inválido para --${nomeFlag}: '${valor}' não é uma data válida. Use o formato AAAA-MM-DD.`);
  }
  return data;
}

export function analisarEnum<T extends string>(valor: string, valoresValidos: T[], nomeFlag: string): T {
  if (!valoresValidos.includes(valor as T)) {
    throw new Error(`Valor inválido para --${nomeFlag}: '${valor}'. Valores aceitos: ${valoresValidos.join(", ")}`);
  }
  return valor as T;
}

export function analisarNumero(valor: string, nomeFlag: string): number {
  const numero = Number(valor);
  if (isNaN(numero)) {
    throw new Error(`Valor inválido para --${nomeFlag}: '${valor}' não é um número.`);
  }
  return numero;
}

export function analisarBooleano(valor: string | undefined): boolean {
  return valor === "true";
}

export function analisarLista(valor: string | undefined, separador: string = ";"): string[] {
  if (!valor) {
    return [];
  }
  return valor
    .split(separador)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
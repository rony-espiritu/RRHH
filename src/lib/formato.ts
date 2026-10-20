export const bs = (n: number | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const ent = (n: number | null | undefined) => (n == null ? '' : Number(n).toLocaleString('es-BO'));

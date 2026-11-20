// Rate = units of the foreign currency per 1 unit of the school's main currency.
export function toBase(amount: number, rate: number) {
  return Math.round((amount / rate) * 100) / 100;
}

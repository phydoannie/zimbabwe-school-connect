export function validReceiptStart(number: number): boolean {
  return Number.isInteger(number) && number >= 1 && number <= 2147483646;
}
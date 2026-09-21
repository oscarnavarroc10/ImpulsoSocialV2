import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amountInMinorUnits: number, currency: string, locale = 'es-MX'): string {
    if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits < 0 || !currency) return '';
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
    return formatter.format(amountInMinorUnits / (10 ** fractionDigits));
  }
}

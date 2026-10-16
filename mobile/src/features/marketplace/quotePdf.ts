import type { QuoteRequest } from './api';

/** Local sample document, never a legal quote or a backend write. ASCII keeps PDF offsets exact. */
export function demoQuotePdf(quote: QuoteRequest): string {
  const raw = ['BAITLY - DEMONSTRATION - SANS VALEUR CONTRACTUELLE', `Devis DEMO-${Math.abs(quote.id)}`, quote.title,
    `Prestataire : ${quote.providerName ?? ''}`, `Client : ${quote.requesterOrganizationName ?? ''}`,
    `Statut : ${quote.status}`, `Date : ${quote.desiredDate ?? ''} ${quote.requestedStartTime ?? ''}`,
    `Duree : ${quote.requestedDurationMinutes ?? ''} minutes`, quote.message ?? '', quote.quoteMessage ?? '',
    `Montant propose : ${quote.quotedAmount ?? ''} ${quote.quotedCurrency ?? ''}`, `Validite : ${quote.quoteValidUntil ?? ''}`];
  const lines = raw.flatMap(value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ').match(/.{1,85}/g) ?? ['']);
  const pages = Array.from({ length: Math.ceil(lines.length / 45) }, (_, index) => lines.slice(index * 45, index * 45 + 45));
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  pages.forEach((page, index) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    const stream = `BT /F1 11 Tf 48 785 Td 16 TL ${page.map((line, i) => `${i ? 'T* ' : ''}(${line.replace(/[\\()]/g, '\\$&')}) Tj`).join('\n')} ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  return `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

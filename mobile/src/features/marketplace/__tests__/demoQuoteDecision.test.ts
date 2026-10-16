let mockMode = 'demo';
let mockProfile = 'concierge';
jest.mock('@/config/baitlyDataMode', () => ({ baitlyDataMode: () => mockMode }));
jest.mock('@/config/baitlyDemoProfileState', () => ({ useBaitlyDemoProfile: { getState: () => ({ key: mockProfile }) }, isBaitlyProfilePreview: () => true }));
import { decideDemoRequest, demoRequest, demoRequestsPage } from '../baitlyDemoRequests';
import { demoQuotePdf } from '../quotePdf';
it('accepts a sample quote, removes it from pending decisions and isolates profiles', () => {
  expect(decideDemoRequest(-901, 'accept', 'sent').status).toBe('ACCEPTED');
  expect(demoRequestsPage('sent', 'QUOTED').items).toHaveLength(0);
  expect(() => decideDemoRequest(-901, 'accept', 'sent')).toThrow();
  mockProfile = 'owner';
  expect(demoRequest(-901)?.status).toBe('QUOTED');
  mockMode = 'live';
  expect(() => decideDemoRequest(-901, 'accept', 'sent')).toThrow();
});
it('builds a marked sample PDF with valid object offsets and escaped text', () => {
  const pdf = demoQuotePdf({ ...demoRequest(-901)!, quoteMessage: '(Test) \\ example' });
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toContain('SANS VALEUR CONTRACTUELLE');
  expect(pdf).toContain('\\(Test\\)');
  const offset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
  expect(pdf.slice(offset, offset + 4)).toBe('xref');
});

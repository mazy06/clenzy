import { parseDiagnostic } from './diagnosticModel';

it('whenNotesCarryACause_thenFormIsRestoredFromStoredFields', () => {
  expect(parseDiagnostic('[clogging] Filtre encrassé', 'Filtre × 2, Joint × 1')).toEqual({
    cause: 'clogging', finding: 'Filtre encrassé', materials: [{ name: 'Filtre', quantity: 2 }, { name: 'Joint', quantity: 1 }],
  });
});
it('whenNotesWereWrittenInThePms_thenTheyAreKeptAsTheFinding', () => {
  expect(parseDiagnostic('Remplacement du siphon', null)).toEqual({ cause: undefined, finding: 'Remplacement du siphon', materials: [] });
});

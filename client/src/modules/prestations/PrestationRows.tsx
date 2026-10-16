import { RequestCommercialBatch } from '../service-requests/RequestCommercialDetails';
import type { PrestationRow } from './prestationFilters';
import PrestationRowItem from './PrestationRowItem';

/**
 * Lignes d'une page. Les fiches commerciales des demandes (vue prestataire) se chargent en un
 * appel par page, comme sur l'ancienne carte des demandes.
 */
export default function PrestationRows({ rows }: { rows: PrestationRow[] }) {
  const requestIds = rows.filter((row) => row.kind === 'request').map((row) => Number(row.item.id));
  return (
    <RequestCommercialBatch ids={requestIds}>
      {rows.map((row) => <PrestationRowItem key={row.id} row={row} />)}
    </RequestCommercialBatch>
  );
}

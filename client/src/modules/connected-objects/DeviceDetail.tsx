import { Navigate, useParams } from 'react-router-dom';
import { DEVICE_KIND_ORDER } from './deviceRegistry';

/** Historical bookmarks open the selected device inside the room workspace. */
export default function DeviceDetail() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const valid = DEVICE_KIND_ORDER.some(value => value === kind) && /^\d+$/.test(id ?? '');
  return <Navigate to={valid ? `/connected-objects?device=${encodeURIComponent(`${kind}:${id}`)}` : '/connected-objects'} replace />;
}

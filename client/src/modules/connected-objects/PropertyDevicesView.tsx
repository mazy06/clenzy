import { Navigate, useParams } from 'react-router-dom';

/** Preserve property bookmarks without maintaining a second workspace. */
export default function PropertyDevicesView() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={/^\d+$/.test(id ?? '') ? `/connected-objects?property=${id}` : '/connected-objects'} replace />;
}

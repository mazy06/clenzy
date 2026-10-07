import { Navigate, useParams } from 'react-router-dom';

/** Les anciens liens ouvrent le modèle dans la bibliothèque, sans écran de détail. */
export default function TemplatePreviewRedirect() {
  const { id } = useParams();
  const params = new URLSearchParams({ tab: 'catalog', view: 'library' });
  if (id && /^\d+$/.test(id)) params.set('template', id);
  return <Navigate replace to={`/documents?${params}`} />;
}

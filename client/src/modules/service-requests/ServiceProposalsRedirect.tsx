import { Navigate, useSearchParams } from 'react-router-dom';

/** Compatibilité des anciens favoris et notifications, sans écran concurrent. */
export default function ServiceProposalsRedirect() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const target = tab === 'contacts' ? '/account?tab=solicitation'
    : tab === 'policy' ? '/settings?tab=general'
    : '/interventions?tab=service-requests' + (tab === 'public' ? '&scope=public' : '&scope=inbox');
  return <Navigate to={target} replace />;
}

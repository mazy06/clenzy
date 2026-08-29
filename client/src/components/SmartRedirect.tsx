import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spinner } from './ui';
import { useAuth } from '../hooks/useAuth';

/**
 * Ecran d'atterrissage apres connexion, choisi selon le ROLE.
 *
 * <p>La racine renvoyait tout le monde vers `/planning`, dont la route exige
 * `reservations:view`. Un intervenant — gouvernante, technicien, blanchisserie,
 * exterieurs — ne l'a pas : il se connectait pour tomber sur « Acces
 * restreint », sans rien avoir demande. Un premier ecran doit etre un ecran
 * qu'on a le droit de voir.</p>
 *
 * <p>La destination suit ce que la personne vient FAIRE : ses interventions
 * pour le terrain, le planning pour qui gere des reservations, le tableau de
 * bord a defaut — c'est la seule route sans permission requise, donc le seul
 * repli sur lequel personne ne peut rebondir vers un mur.</p>
 */
const SmartRedirect: React.FC = () => {
  const { user, loading, hasAnyRole } = useAuth();

  // Rediriger avant d'avoir les permissions enverrait tout le monde sur le
  // repli, y compris ceux qui ont acces au planning.
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const can = (permission: string) => user?.permissions?.includes(permission) ?? false;

  // Le terrain d'abord : c'est le profil pour qui le planning est ferme, et ses
  // interventions sont la seule chose qu'il vient consulter.
  if (hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN', 'LAUNDRY', 'EXTERIOR_TECH'])) {
    return <Navigate to="/interventions" replace />;
  }

  if (can('reservations:view')) {
    return <Navigate to="/planning" replace />;
  }

  if (can('interventions:view') || can('service-requests:view')) {
    return <Navigate to="/interventions" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export default SmartRedirect;

/**
 * <p><b>Backward-compatibility re-export</b> — historiquement, `useAuth` etait
 * un hook standalone. Le refactor 2026-05 a deplace toute la logique stateful
 * dans {@link contexts/AuthContext.tsx#AuthProvider} pour eliminer le storm de
 * /api/me paralleles (un appel par site d'appel, ~10 simultanes au mount).</p>
 *
 * <p>Maintenant tous les sites d'appel partagent le meme state via Context →
 * UN SEUL /api/me au boot, quel que soit le nombre de consommateurs.</p>
 *
 * <p>Les 94+ imports existants {@code import { useAuth, AuthUser } from '../hooks/useAuth'}
 * continuent de fonctionner sans modification grace a ce shim.</p>
 *
 * <p>Pour les nouveaux composants, vous pouvez importer directement depuis
 * {@code ../contexts/AuthContext} — c'est equivalent.</p>
 */
export { useAuth } from '../contexts/AuthContext';
export type { AuthUser, UserRole, AuthContextValue } from '../contexts/AuthContext';

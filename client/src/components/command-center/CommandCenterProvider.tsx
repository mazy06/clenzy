import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCommandCatalog } from './buildCommands';
import { useCommandHabits, type CommandHabits } from './useCommandHabits';
import { defaultSuggestionsForRoles } from './roleProfiles';
import { useCommandShortcuts } from './shortcuts';
import type { CommandDescriptor, ScreenCommandsRegistration } from './types';

/**
 * Centre de commande — état partagé.
 *
 * <p>Le provider est monté UNE fois, dans `MainLayoutFull`. Il porte :</p>
 * <ol>
 *   <li>l'ouverture de la palette (⌘K, la loupe du header, un appel direct) ;</li>
 *   <li>le catalogue permanent (navigation, actions, vues, compte, outils) ;</li>
 *   <li>les commandes contribuées par l'ÉCRAN courant, via `useScreenCommands` ;</li>
 *   <li>les habitudes d'usage, qui classent le tout.</li>
 * </ol>
 */

interface CommandCenterValue {
  open: boolean;
  /** Ouvre la palette, éventuellement pré-remplie. */
  openCenter: (initialQuery?: string) => void;
  close: () => void;
  query: string;
  setQuery: (value: string) => void;
  /** Catalogue permanent + commandes de l'écran courant. */
  commands: CommandDescriptor[];
  /** Nom de l'écran qui contribue des commandes, s'il y en a un. */
  screenLabel: string | null;
  habits: CommandHabits;
  /** Ordre de départ par métier, tant qu'il n'y a pas d'historique. */
  defaultSuggestionIds: string[];
  mountScreenCommands: (id: string, registration: ScreenCommandsRegistration) => void;
  unmountScreenCommands: (id: string) => void;
}

const noop = () => {};

const FALLBACK: CommandCenterValue = {
  open: false,
  openCenter: noop,
  close: noop,
  query: '',
  setQuery: noop,
  commands: [],
  screenLabel: null,
  habits: { score: () => 0, record: noop, isLoaded: false },
  defaultSuggestionIds: [],
  mountScreenCommands: noop,
  unmountScreenCommands: noop,
};

const CommandCenterContext = createContext<CommandCenterValue>(FALLBACK);

export function useCommandCenter(): CommandCenterValue {
  return useContext(CommandCenterContext);
}

interface ProviderProps {
  children: React.ReactNode;
  /** Bascule de la navigation — publiée comme commande de la section Vues. */
  onToggleNavigation?: () => void;
}

/** Signature d'une contribution d'écran : ce qui, s'il change, doit re-rendre. */
function signatureOf(id: string, registration: ScreenCommandsRegistration): string {
  return `${id}#${registration.screenLabel}#${registration.commands
    .map((command) => `${command.id}:${command.label}`)
    .join('|')}`;
}

export function CommandCenterProvider({ children, onToggleNavigation }: ProviderProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /**
   * Instant de référence du classement, figé à l'ouverture. Recalculer la
   * frécence à chaque rendu réordonnerait la liste sous le curseur.
   */
  const [rankedAt, setRankedAt] = useState(() => Date.now());

  const habits = useCommandHabits(rankedAt);
  const catalog = useCommandCatalog({ onToggleNavigation });

  // ── Commandes contribuées par l'écran ──────────────────────────────────
  // Même schéma que `ScreenChrome` : les enregistrements vivent dans une ref
  // (les lambdas `run` sont recréées à chaque rendu de l'écran), seul un
  // changement de la SIGNATURE déclenche un rendu du provider.
  const registrationsRef = useRef(new Map<string, ScreenCommandsRegistration>());
  const orderRef = useRef<string[]>([]);
  const [signature, setSignature] = useState('');

  const syncSignature = useCallback(() => {
    const next = orderRef.current
      .map((id) => {
        const registration = registrationsRef.current.get(id);
        return registration ? signatureOf(id, registration) : '';
      })
      .join('§');
    setSignature((previous) => (previous === next ? previous : next));
  }, []);

  const mountScreenCommands = useCallback(
    (id: string, registration: ScreenCommandsRegistration) => {
      registrationsRef.current.set(id, registration);
      if (!orderRef.current.includes(id)) orderRef.current.push(id);
      syncSignature();
    },
    [syncSignature],
  );

  const unmountScreenCommands = useCallback(
    (id: string) => {
      registrationsRef.current.delete(id);
      orderRef.current = orderRef.current.filter((entry) => entry !== id);
      syncSignature();
    },
    [syncSignature],
  );

  const screenContribution = useMemo(() => {
    // Le dernier écran monté gagne : sur une page à panneaux imbriqués, c'est
    // le plus interne qui décrit le mieux ce qu'on est en train de faire.
    const id = orderRef.current[orderRef.current.length - 1];
    const registration = id ? registrationsRef.current.get(id) : undefined;
    if (!registration) return { label: null as string | null, commands: [] as CommandDescriptor[] };

    // Les descripteurs sont recopiés avec un `run` qui relit la ref : la lambda
    // capturée ici serait périmée dès le rendu suivant de l'écran.
    const commands = registration.commands.map((command) => ({
      ...command,
      section: 'screen' as const,
      hint: command.hint ?? registration.screenLabel,
      run: () => {
        const fresh = registrationsRef.current.get(id);
        fresh?.commands.find((entry) => entry.id === command.id)?.run();
      },
    }));
    return { label: registration.screenLabel, commands };
    // `signature` est la dépendance réelle : la ref, elle, ne déclenche rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const commands = useMemo(
    () => [...screenContribution.commands, ...catalog],
    [screenContribution.commands, catalog],
  );

  const openCenter = useCallback((initialQuery = '') => {
    setQuery(initialQuery);
    setRankedAt(Date.now());
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Un changement d'écran ferme la palette : la commande a été exécutée, la
  // laisser ouverte masquerait sa propre destination.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useCommandShortcuts({
    commands,
    onOpen: () => openCenter(),
    paused: open,
  });

  const defaultSuggestionIds = useMemo(
    () => defaultSuggestionsForRoles(user?.roles ?? []),
    [user?.roles],
  );

  const value = useMemo<CommandCenterValue>(
    () => ({
      open,
      openCenter,
      close,
      query,
      setQuery,
      commands,
      screenLabel: screenContribution.label,
      habits,
      defaultSuggestionIds,
      mountScreenCommands,
      unmountScreenCommands,
    }),
    [
      open,
      openCenter,
      close,
      query,
      commands,
      screenContribution.label,
      habits,
      defaultSuggestionIds,
      mountScreenCommands,
      unmountScreenCommands,
    ],
  );

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

/**
 * Publie les commandes de l'écran courant dans le centre de commande.
 *
 * <p>C'est le pendant de `useScreenSearch` pour les ACTIONS : l'écran garde sa
 * logique, seule sa mise à disposition est déléguée. Les commandes sont
 * rangées dans une section « Sur cet écran », en tête de la palette.</p>
 *
 * <p>`commands` doit être mémoïsé par l'appelant — sinon la signature est
 * recalculée à chaque rendu (sans boucle, mais pour rien).</p>
 *
 * @example
 * const commands = useMemo(() => [
 *   { id: 'reservations.export', section: 'screen', label: 'Exporter la liste', run: exportCsv },
 * ], [exportCsv]);
 * useScreenCommands('Réservations', commands);
 */
export function useScreenCommands(screenLabel: string, commands: CommandDescriptor[]): void {
  const { mountScreenCommands, unmountScreenCommands } = useCommandCenter();
  const id = useId();

  useEffect(() => {
    mountScreenCommands(id, { screenLabel, commands });
  }, [id, screenLabel, commands, mountScreenCommands]);

  useEffect(() => () => unmountScreenCommands(id), [id, unmountScreenCommands]);
}

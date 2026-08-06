import React, { useMemo } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui';
import { Search } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenChrome } from '../ScreenChrome';
import { useCommandCenter } from './CommandCenterProvider';
import { rankCommands } from './ranking';
import { shortcutAria, shortcutDisplay } from './shortcuts';
import type { CommandDescriptor, CommandSection } from './types';

/**
 * Centre de commande Baitly — la palette ⌘K.
 *
 * <p>Point d'entrée UNIQUE de la recherche et du déclenchement : aller à un
 * écran, créer quelque chose, changer l'affichage, ouvrir un outil, ou passer
 * la main au filtre de l'écran courant. Monté une fois, dans `MainLayoutFull`.</p>
 *
 * <p>Le filtrage et le classement sont faits en amont (`ranking.ts`) — `cmdk`
 * ne garde que ce qu'il fait bien : la sélection au clavier et l'accessibilité
 * de la liste.</p>
 */
export default function CommandCenter() {
  const { t } = useTranslation();
  const { open, close, query, setQuery, commands, habits, defaultSuggestionIds } =
    useCommandCenter();
  const { search, setSearchValue, submitSearch } = useScreenChrome();

  const sectionHeading: Record<CommandSection, string> = {
    screen: t('commandCenter.sections.screen', 'Sur cet écran'),
    navigation: t('commandCenter.sections.navigation', 'Aller à'),
    actions: t('commandCenter.sections.actions', 'Créer'),
    views: t('commandCenter.sections.views', 'Affichage'),
    account: t('commandCenter.sections.account', 'Compte'),
    tools: t('commandCenter.sections.tools', 'Outils'),
  };

  const ranking = useMemo(
    () => rankCommands({ commands, query, score: habits.score, defaultSuggestionIds }),
    [commands, query, habits.score, defaultSuggestionIds],
  );

  const runCommand = (command: CommandDescriptor) => {
    close();
    habits.record(command.id);
    command.run();
  };

  /**
   * Passerelle vers la recherche d'écran.
   *
   * <p>Le header ne porte plus de champ : quand l'écran courant sait filtrer
   * ses données, c'est ICI qu'on tape, et cette ligne remet la saisie à
   * l'écran. Elle est en tête de liste, hors de tout groupe : c'est l'action
   * attendue quand on ouvre la palette depuis un écran de liste.</p>
   *
   * <p>Trois cas : filtrer avec ce qu'on vient de taper, le SOUMETTRE quand
   * l'écran attend une question (Planning + constellation), ou effacer le
   * filtre en cours quand on a tout effacé.</p>
   */
  const screenRow = (() => {
    if (!search) return null;
    const typed = query.trim();

    if (typed !== '') {
      const label = search.canSubmit
        ? `${t('commandCenter.askScreen', 'Demander')} « ${typed} »`
        : `${t('commandCenter.filterScreen', 'Filtrer cet écran avec')} « ${typed} »`;
      return {
        label,
        run: () => {
          close();
          setSearchValue(typed);
          // La valeur est passée explicitement : l'écran ne la connaîtra qu'au
          // rendu suivant, `submitSearch()` soumettrait l'ancienne.
          if (search.canSubmit) submitSearch(typed);
        },
      };
    }

    if (search.value !== '') {
      return {
        label: `${t('commandCenter.clearFilter', 'Effacer le filtre')} « ${search.value} »`,
        run: () => {
          close();
          setSearchValue('');
        },
      };
    }
    return null;
  })();

  /**
   * Pastilles de raccourci. Un accord (`G` puis `D`) est rendu en DEUX
   * pastilles séparées par « puis » : côte à côte et nues, les deux lettres se
   * lisaient comme une combinaison à enfoncer ensemble, ce qu'elles ne sont pas.
   */
  const renderShortcut = (command: CommandDescriptor) => {
    const display = shortcutDisplay(command);
    if (!display) return null;
    return (
      <span
        className="flex items-center gap-1 whitespace-nowrap"
        title={shortcutAria(display)}
        aria-label={shortcutAria(display)}
      >
        {display.keys.map((key, index) => (
          <React.Fragment key={key}>
            {index > 0 && (
              <span aria-hidden className="text-2xs text-muted-foreground/70">
                {t('commandCenter.then', 'puis')}
              </span>
            )}
            <kbd
              aria-hidden
              className="inline-flex min-w-[1.25rem] justify-center rounded border border-border bg-muted px-1 py-px font-sans text-2xs font-medium text-muted-foreground"
            >
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </span>
    );
  };

  /**
   * Une ligne = 4 colonnes : icône, libellé, contexte, raccourci. Le contexte
   * et le raccourci forment un bloc ancré à DROITE, avec une colonne de
   * raccourci de largeur fixe — sans elle, les contextes s'arrêtaient à une
   * abscisse différente selon la présence d'un raccourci, et la colonne partait
   * en escalier.
   */
  const renderItem = (command: CommandDescriptor) => (
    <CommandItem key={command.id} value={command.id} onSelect={() => runCommand(command)}>
      {command.icon}
      <span className="min-w-0 flex-1 truncate">{command.label}</span>
      <span className="flex shrink-0 items-center gap-3">
        {command.hint && (
          <span className="hidden truncate text-2xs text-muted-foreground sm:inline">
            {command.hint}
          </span>
        )}
        {/* 5.25rem = la largeur du plus large raccourci (pastille + « puis » +
            pastille). Fixe, donc la colonne des contextes s'arrête au même
            endroit sur toutes les lignes, avec ou sans raccourci. */}
        <span className="flex w-[5.25rem] justify-end">{renderShortcut(command)}</span>
      </span>
    </CommandItem>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title={t('commandCenter.title', 'Centre de commande')}
      description={t('commandCenter.description', 'Cherchez un écran, une action ou un outil.')}
      className="w-[min(640px,92vw)] max-w-none"
    >
      <Command
        // Le filtre et le tri sont faits en amont — `cmdk` ne doit pas les refaire.
        shouldFilter={false}
        // La sélection reboucle : depuis la dernière ligne, ↓ revient en tête.
        loop
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('commandCenter.placeholder', 'Rechercher un écran, une action, un outil…')}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1">
              <span>{t('commandCenter.empty', 'Aucune commande ne correspond.')}</span>
              <span className="text-2xs text-muted-foreground">
                {t('commandCenter.emptyHint', 'Essayez un mot du métier : ménage, OTA, facture…')}
              </span>
            </div>
          </CommandEmpty>

          {screenRow && (
            <>
              {/* Hors groupe et en tête : c'est l'action attendue par défaut
                  quand on ouvre la palette depuis un écran de liste. */}
              <CommandItem value="__screen-search" onSelect={screenRow.run}>
                <Search />
                <span className="truncate">{screenRow.label}</span>
              </CommandItem>
              <CommandSeparator />
            </>
          )}

          {ranking.suggestions.length > 0 && (
            <>
              <CommandGroup heading={t('commandCenter.sections.suggestions', 'Reprendre')}>
                {ranking.suggestions.map(renderItem)}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {ranking.groups.map((group, index) => (
            <React.Fragment key={group.section}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={sectionHeading[group.section]}>
                {group.commands.map(renderItem)}
                {group.hidden > 0 && (
                  // Pas un CommandItem : rien à sélectionner, c'est une
                  // indication. La suite du groupe s'obtient en tapant.
                  <div className="px-2 py-1.5 text-2xs text-muted-foreground">
                    {t('commandCenter.more', 'et {{count}} de plus — tapez pour chercher')
                      .replace('{{count}}', String(group.hidden))}
                  </div>
                )}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>

        {/* Pied d'aide : le raccourci d'ouverture et la convention des accords
            ne s'inventent pas — les montrer là où on vient de les utiliser est
            le seul endroit où ils s'apprennent. */}
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
          <span>{t('commandCenter.hints.navigate', '↑ ↓ parcourir')}</span>
          <span>{t('commandCenter.hints.run', '↵ exécuter')}</span>
          <span>{t('commandCenter.hints.close', 'échap fermer')}</span>
          <span className="ms-auto hidden truncate sm:inline">
            {t('commandCenter.hints.chord', 'les touches à droite s’enchaînent, sans ⌘')}
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

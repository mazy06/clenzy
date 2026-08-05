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
  CommandShortcut,
} from '../ui';
import { Search } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenChrome } from '../ScreenChrome';
import { useCommandCenter } from './CommandCenterProvider';
import { rankCommands } from './ranking';
import { openShortcutLabel, shortcutOf } from './shortcuts';
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
  const { search, setSearchValue } = useScreenChrome();

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
   * Passerelle vers la recherche d'écran : quand un écran sait filtrer ses
   * données, ce qu'on vient de taper peut lui être remis tel quel. C'est ce qui
   * évite d'avoir deux endroits où chercher — la palette reste le point
   * d'entrée, l'écran fait le filtrage.
   */
  const handoffToScreen = search && query.trim() !== ''
    ? () => {
        close();
        setSearchValue(query);
      }
    : null;

  const renderItem = (command: CommandDescriptor) => {
    const shortcut = shortcutOf(command);
    return (
      <CommandItem key={command.id} value={command.id} onSelect={() => runCommand(command)}>
        {command.icon}
        <span className="truncate">{command.label}</span>
        {command.hint && (
          <span className="ms-auto shrink-0 text-2xs text-muted-foreground">{command.hint}</span>
        )}
        {shortcut && <CommandShortcut className={command.hint ? 'ms-2' : undefined}>{shortcut}</CommandShortcut>}
      </CommandItem>
    );
  };

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

          {handoffToScreen && (
            <CommandGroup heading={sectionHeading.screen}>
              <CommandItem value="__screen-filter" onSelect={handoffToScreen}>
                <Search />
                <span className="truncate">
                  {t('commandCenter.filterScreen', 'Filtrer cet écran avec')} « {query.trim()} »
                </span>
              </CommandItem>
            </CommandGroup>
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

        {/* Pied d'aide : le raccourci d'ouverture et les accords ne s'inventent
            pas — les montrer là où on vient de les utiliser est le seul endroit
            où ils s'apprennent. */}
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
          <span>{t('commandCenter.hints.navigate', '↑ ↓ parcourir')}</span>
          <span>{t('commandCenter.hints.run', '↵ exécuter')}</span>
          <span>{t('commandCenter.hints.close', 'échap fermer')}</span>
          <span className="ms-auto hidden sm:inline">
            {t('commandCenter.hints.open', 'ouvrir')} {openShortcutLabel()}
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

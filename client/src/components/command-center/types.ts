import type React from 'react';

/**
 * Centre de commande Baitly — modèle de données.
 *
 * Une COMMANDE est tout ce qu'un utilisateur peut déclencher depuis le champ
 * unique : aller quelque part, créer quelque chose, changer une vue, ouvrir un
 * outil. Toutes les surfaces (navigation, actions d'écran, compte, outils)
 * décrivent leurs entrées avec ce même type — c'est ce qui permet de n'avoir
 * qu'UN classement, UN filtre et UN rendu.
 */

export type CommandSection =
  /** Ce que l'écran courant sait faire (contribué via `useScreenCommands`). */
  | 'screen'
  /** Aller à un écran. */
  | 'navigation'
  /** Créer / lancer quelque chose. */
  | 'actions'
  /** Changer la façon dont l'application s'affiche. */
  | 'views'
  /** Profil, préférences, session. */
  | 'account'
  /** Outils transverses (assistant, rapports, diagnostics). */
  | 'tools';

export const COMMAND_SECTIONS: CommandSection[] = [
  'screen',
  'navigation',
  'actions',
  'views',
  'account',
  'tools',
];

export interface CommandDescriptor {
  /**
   * Identifiant STABLE — c'est la clé des habitudes d'usage, persistée côté
   * backend. Le changer remet le compteur d'un utilisateur à zéro : préférer
   * `nav:/properties`, `action:property.create`… plutôt qu'un libellé traduit.
   */
  id: string;
  section: CommandSection;
  /** Libellé affiché (traduit). */
  label: string;
  /** Contexte affiché à droite : hub d'appartenance, écran d'origine. */
  hint?: string;
  /**
   * Termes de recherche additionnels : synonymes métier, ancien nom d'écran,
   * vocabulaire du terrain (« ménage » pour les interventions, « OTA » pour les
   * channels). C'est ce qui rend la palette trouvable sans connaître le nom
   * officiel de l'écran.
   */
  keywords?: string;
  icon?: React.ReactNode;
  /**
   * Raccourci global en accord de touches, façon Gmail : `['g', 'p']` se lit
   * « G puis P ». Volontairement sans modificateur — les combinaisons ⌘/Ctrl
   * sont déjà prises par le navigateur et par le système.
   */
  chord?: readonly string[];
  /** Raccourci affiché quand il ne vient pas d'un accord (ex. `⌘B`). */
  shortcutLabel?: string;
  /**
   * Exclut la commande des suggestions par habitude. À poser sur les bascules
   * et les commandes à effet immédiat : les proposer en tête parce qu'elles
   * sont fréquentes ferait de la déconnexion la première ligne du palmarès.
   */
  neverSuggest?: boolean;
  run: () => void;
}

/** Commandes contribuées par l'écran courant, telles qu'enregistrées. */
export interface ScreenCommandsRegistration {
  /** Nom de l'écran, affiché en contexte à droite de chaque entrée. */
  screenLabel: string;
  commands: CommandDescriptor[];
}

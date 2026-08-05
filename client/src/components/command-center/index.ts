/**
 * Centre de commande Baitly — API publique du module.
 *
 * <p>Un seul point d'entrée pour toute la recherche et tout le déclenchement de
 * l'application : la palette ⌘K. Les écrans n'ont que deux choses à connaître :
 * `useScreenCommands` pour publier leurs actions, `useCommandCenter` pour
 * ouvrir la palette depuis un bouton.</p>
 */
export { default as CommandCenter } from './CommandCenter';
export { CommandCenterProvider, useCommandCenter, useScreenCommands } from './CommandCenterProvider';
export { openShortcutLabel, formatChord } from './shortcuts';
export { openAssistant, ASSISTANT_OPEN_EVENT } from './assistantBridge';
export type { CommandDescriptor, CommandSection, ScreenCommandsRegistration } from './types';

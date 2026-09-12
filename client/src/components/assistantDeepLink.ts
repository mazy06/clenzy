/**
 * Parametre d'URL qui ouvre l'assistant sur une conversation precise
 * (ex. {@code /dashboard?assistantConversation=42}).
 *
 * <p>C'est la cible du lien profond porte par les notifications et les emails
 * de briefing : la page dediee `/assistant` n'existe plus, mais le CTA
 * « Ouvrir dans l'assistant » doit continuer a mener a la bonne conversation.
 * Le parametre est retire de l'URL une fois consomme, pour que le panneau ne se
 * rouvre pas a chaque retour en arriere.</p>
 *
 * <p><b>Pourquoi cette constante vit SEULE dans son fichier.</b> Elle etait
 * exportee par {@code AssistantDockTab}, que `MainLayoutFull` charge en lazy
 * precisement parce que son sous-arbre est lourd. Mais `AuthenticatedApp` en
 * importait cette seule chaine — un import STATIQUE, qui annulait le lazy et
 * ramenait tout l'assistant dans le chunk d'entree : react-markdown, et
 * surtout recharts via les widgets de graphiques (491 Ko bruts, preloades au
 * boot). Une constante de 22 caracteres coutait un demi-megaoctet sur le
 * chemin critique. Toute valeur partagee entre un module lazy et le graphe
 * d'entree doit vivre ICI, pas dans le module lazy.</p>
 */
export const ASSISTANT_CONVERSATION_PARAM = 'assistantConversation';

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Add,
  Assessment,
  DarkMode,
  Description,
  Handshake,
  Language,
  LightMode,
  Notifications,
  Palette,
  Payment,
  Person,
  PersonAdd,
  Public,
  Settings,
  SmartToy,
  SettingsBrightness,
  ViewSidebar,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeMode } from '../../hooks/useThemeMode';
import {
  NAVIGATION_HUBS,
  STANDALONE_SCREENS,
  accessibleHubTabs,
  type HubAccess,
} from '../../config/navigationHubs';
import { SCREEN_ICON } from '../../config/navigationIcons';
import { openAssistant } from './assistantBridge';
import type { CommandDescriptor } from './types';

/**
 * Catalogue des commandes — source unique de ce que le centre de commande sait
 * faire, en dehors de ce que l'écran courant contribue lui-même.
 *
 * <p>Rien n'est déclaré deux fois : la section <b>Navigation</b> est dérivée du
 * registre `navigationHubs`, donc un écran ajouté à la sidebar devient
 * cherchable sans toucher ce fichier. Et la section <b>Outils</b> ne contient
 * que ce qui n'est PAS un écran de navigation — sinon la même cible
 * apparaîtrait deux fois dans la même liste.</p>
 *
 * <p>Tout est filtré par permission, exactement comme la sidebar : proposer une
 * action qui finira en 403 coûte plus cher que de ne pas la proposer.</p>
 */

/**
 * Vocabulaire de terrain, par écran. Les gens cherchent « ménage », pas
 * « interventions » ; « OTA », pas « channels ». Ces synonymes sont ce qui rend
 * la palette utilisable sans connaître le nom officiel des écrans.
 */
const SCREEN_KEYWORDS: Record<string, string> = {
  '/properties': 'logement logements bien biens appartement annonce listing property',
  '/reservations': 'resa séjour sejour booking arrivée arrivee départ depart voyageur',
  '/interventions': 'ménage menage nettoyage maintenance mission missions tâche tache cleaning',
  '/contact': 'messagerie message email sms whatsapp boîte boite réception reception inbox',
  '/directory': 'annuaire utilisateur équipe equipe voyageur guest portefeuille contact',
  '/documents': 'modèle modele fichier pdf justificatif template',
  '/contracts': 'mandat gestion signature contrat',
  '/billing': 'facture facturation paiement encaissement reversement payout',
  '/tarification': 'prix tarif rate pricing yield saison',
  '/channels': 'ota airbnb booking.com vrbo canal distribution channex synchronisation',
  '/booking-engine': 'site moteur réservation directe widget livret accueil guest',
  '/shop': 'boutique service extra upsell',
  '/planning': 'agenda calendrier calendar semaine mission tournée tournee',
  '/dashboard': 'accueil kpi indicateur vue ensemble home',
  '/reports': 'rapport analytics statistique export états etats',
  '/settings': 'paramètre parametre préférence preference configuration réglage reglage',
  '/automation-rules': 'automatisation règle regle workflow scénario scenario',
  '/permissions-test': 'rôle role permission droit accès acces',
  '/admin/monitoring': 'supervision santé sante métrique metrique log grafana',
  '/admin/sync': 'synchronisation diagnostic ical flux',
  '/admin/kpi': 'readiness qualité qualite donnée donnee',
  '/admin/exchange-rates': 'devise change taux conversion',
  '/admin/database': 'base donnée donnee sql schéma schema',
  '/admin/promo-codes': 'code promo réduction reduction coupon',
};

/**
 * Accords de navigation : `g` puis une lettre. Le préfixe `g` (go) est la
 * convention établie par Gmail / GitHub / Linear — la mémoire musculaire des
 * utilisateurs est déjà écrite, autant s'en servir.
 */
const SCREEN_CHORDS: Record<string, readonly string[]> = {
  '/dashboard': ['g', 'd'],
  '/planning': ['g', 'a'],
  '/properties': ['g', 'p'],
  '/reservations': ['g', 'r'],
  '/interventions': ['g', 'i'],
  '/contact': ['g', 'm'],
  '/directory': ['g', 'u'],
  '/documents': ['g', 'o'],
  '/billing': ['g', 'f'],
  '/tarification': ['g', 't'],
  '/channels': ['g', 'c'],
  '/booking-engine': ['g', 'b'],
  '/settings': ['g', 's'],
  '/reports': ['g', 'e'],
};

const LANGUAGE_LABELS: Record<'fr' | 'en' | 'ar', string> = {
  fr: 'Basculer en français',
  en: 'Switch to English',
  ar: 'التبديل إلى العربية',
};

export interface CommandCatalogHandlers {
  /** Replie / déploie la navigation — l'état vit dans `MainLayoutFull`. */
  onToggleNavigation?: () => void;
}

export function useCommandCatalog({
  onToggleNavigation,
}: CommandCatalogHandlers): CommandDescriptor[] {
  const navigate = useNavigate();
  const { t, changeLanguage, currentLanguage } = useTranslation();
  const { user, isAdmin, isManager } = useAuth();
  const { mode, setMode } = useThemeMode();

  const permissions = user?.permissions;
  const roles = user?.roles;

  return useMemo(() => {
    const granted = new Set(permissions ?? []);
    const can = (permission: string) => granted.has(permission);
    const roleSet = new Set(roles ?? []);
    const isOneOf = (...wanted: string[]) => wanted.some((role) => roleSet.has(role));
    const admin = isAdmin();
    const manager = isManager();
    const platformStaff = admin || manager;

    const go = (path: string) => () => navigate(path);
    const commands: CommandDescriptor[] = [];

    // ── Navigation ────────────────────────────────────────────────────────
    const access: HubAccess = { permissions: permissions ?? [], isAdmin: admin, isManager: manager };

    const pushScreen = (path: string, label: string, hint?: string) => {
      commands.push({
        id: `nav:${path}`,
        section: 'navigation',
        label,
        hint,
        keywords: SCREEN_KEYWORDS[path],
        icon: SCREEN_ICON[path],
        chord: SCREEN_CHORDS[path],
        run: go(path),
      });
    };

    NAVIGATION_HUBS.forEach((hub) => {
      const hubLabel = t(hub.translationKey, hub.fallbackLabel);
      accessibleHubTabs(hub, access).forEach((tab) => {
        pushScreen(tab.path, t(tab.translationKey, tab.fallbackLabel), hubLabel);
      });
    });
    STANDALONE_SCREENS.forEach((screen) => {
      pushScreen(screen.path, t(screen.translationKey, screen.fallbackLabel));
    });

    // ── Actions ───────────────────────────────────────────────────────────
    // Accord `n` (new) : jamais de collision avec le `g` de la navigation.
    const action = (
      id: string,
      label: string,
      path: string,
      icon: React.ReactNode,
      chord: readonly string[],
      keywords?: string,
    ) => {
      commands.push({ id: `action:${id}`, section: 'actions', label, icon, chord, keywords, run: go(path) });
    };

    if (can('properties:create')) {
      action('property.create', t('commandCenter.actions.propertyCreate', 'Ajouter un logement'),
        '/properties/new', <Add />, ['n', 'p'], 'nouveau bien annonce création creation');
    }
    if (can('interventions:create')) {
      action('intervention.create', t('commandCenter.actions.interventionCreate', 'Planifier une intervention'),
        '/interventions/new', <Add />, ['n', 'i'], 'ménage menage mission nouvelle maintenance');
    }
    if (can('service-requests:create')) {
      action('service-request.create', t('commandCenter.actions.serviceRequestCreate', 'Signaler une demande'),
        '/service-requests/new', <Add />, ['n', 'd'], 'incident problème probleme anomalie demande service');
    }
    if (can('contact:manage') || can('contact:view')) {
      action('message.create', t('commandCenter.actions.messageCreate', 'Écrire un message'),
        '/contact/create', <Add />, ['n', 'm'], 'email sms whatsapp voyageur nouveau');
    }
    if (can('teams:create')) {
      action('team.create', t('commandCenter.actions.teamCreate', 'Créer une équipe'),
        '/teams/new', <Add />, ['n', 'e'], 'équipe equipe prestataire nouvelle');
    }
    if (can('users:manage')) {
      action('user.invite', t('commandCenter.actions.userInvite', 'Inviter un utilisateur'),
        '/users/new', <PersonAdd />, ['n', 'u'], 'compte collaborateur invitation nouveau');
    }

    // ── Vues ──────────────────────────────────────────────────────────────
    // Bascules d'affichage : hors suggestions (`neverSuggest`), sinon un
    // utilisateur qui change souvent de thème verrait le thème avant son travail.
    const view = (
      id: string,
      label: string,
      icon: React.ReactNode,
      run: () => void,
      extra?: Partial<CommandDescriptor>,
    ) => {
      commands.push({ id: `view:${id}`, section: 'views', label, icon, run, neverSuggest: true, ...extra });
    };

    if (mode !== 'dark') {
      view('theme.dark', t('commandCenter.views.themeDark', 'Passer en thème sombre'),
        <DarkMode />, () => setMode('dark'), { keywords: 'dark nuit sombre thème theme' });
    }
    if (mode !== 'light') {
      view('theme.light', t('commandCenter.views.themeLight', 'Passer en thème clair'),
        <LightMode />, () => setMode('light'), { keywords: 'light jour clair thème theme' });
    }
    if (mode !== 'auto') {
      view('theme.auto', t('commandCenter.views.themeAuto', 'Suivre le thème du système'),
        <SettingsBrightness />, () => setMode('auto'), { keywords: 'auto système systeme thème theme' });
    }
    if (onToggleNavigation) {
      view('navigation.toggle', t('commandCenter.views.navigationToggle', 'Replier ou déployer la navigation'),
        <ViewSidebar />, onToggleNavigation, { shortcutLabel: '⌘B', keywords: 'sidebar menu latéral lateral' });
    }
    (['fr', 'en', 'ar'] as const).forEach((lng) => {
      if (currentLanguage.startsWith(lng)) return;
      view(`language.${lng}`, t(`commandCenter.views.language.${lng}`, LANGUAGE_LABELS[lng]),
        <Language />, () => changeLanguage(lng), { keywords: 'langue language traduction' });
    });

    // ── Compte ────────────────────────────────────────────────────────────
    // Volontairement SANS déconnexion : dans une liste filtrée au clavier, une
    // frappe malheureuse suivie d'Entrée fermerait la session. Le bouton du pied
    // de la sidebar reste le seul chemin, et c'est délibéré.
    const account = (
      id: string,
      label: string,
      path: string,
      icon: React.ReactNode,
      keywords?: string,
    ) => {
      commands.push({ id: `account:${id}`, section: 'account', label, icon, keywords, run: go(path) });
    };

    account('profile', t('commandCenter.account.profile', 'Mon profil'),
      '/settings?tab=general', <Person />, 'compte identité identite nom photo');
    account('notifications', t('commandCenter.account.notifications', 'Mes notifications'),
      '/notifications', <Notifications />, 'alerte alertes message');
    account('preferences', t('commandCenter.account.preferences', 'Préférences de notification'),
      '/settings?tab=notifications', <Settings />, 'email push alerte réglage reglage');
    if (isOneOf('HOST')) {
      account('payouts', t('commandCenter.account.payouts', 'Mes reversements'),
        '/settings?tab=my-payout', <Payment />, 'virement propriétaire proprietaire versement');
    }
    if (isOneOf('HOUSEKEEPER', 'TECHNICIAN')) {
      account('rates', t('commandCenter.account.rates', 'Mes tarifs'),
        '/settings?tab=my-rates', <Payment />, 'prix mission rémunération remuneration');
    }
    if (can('payments:view')) {
      account('billing', t('commandCenter.account.billing', 'Ma facturation'),
        '/billing', <Handshake />, 'abonnement facture paiement');
    }

    // ── Outils ────────────────────────────────────────────────────────────
    const tool = (
      id: string,
      label: string,
      icon: React.ReactNode,
      run: () => void,
      keywords?: string,
    ) => {
      commands.push({ id: `tool:${id}`, section: 'tools', label, icon, keywords, run });
    };

    tool('assistant', t('commandCenter.tools.assistant', "Ouvrir l'assistant"),
      <SmartToy />, openAssistant, 'ia ai chat question aide copilote');
    if (can('properties:view')) {
      tool('studio', t('commandCenter.tools.studio', 'Baitly Studio'),
        <Palette />, go('/booking-engine/studio'), 'site éditeur editeur page template');
      tool('site.generate', t('commandCenter.tools.siteGenerate', 'Générer un site'),
        <Public />, go('/booking-engine/generate'), 'ia site création creation modèle modele');
    }
    if (can('documents:create')) {
      tool('document.templates', t('commandCenter.tools.documentTemplates', 'Modèles de documents'),
        <Description />, go('/documents?tab=document-templates'), 'template contrat pdf');
    }
    if (platformStaff) {
      tool('design-system', t('commandCenter.tools.designSystem', 'Bibliothèque UI'),
        <Palette />, go('/admin/design-system'), 'design composant kit baitly ui');
    }
    if (admin) {
      tool('token-monitoring', t('commandCenter.tools.tokenMonitoring', 'Consommation IA'),
        <Assessment />, go('/admin/token-monitoring'), 'token coût cout crédit credit ia');
    }

    return commands;
  }, [
    permissions,
    roles,
    navigate,
    t,
    changeLanguage,
    currentLanguage,
    isAdmin,
    isManager,
    mode,
    setMode,
    onToggleNavigation,
  ]);
}

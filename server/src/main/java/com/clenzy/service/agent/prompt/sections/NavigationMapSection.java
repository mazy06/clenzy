package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Carte des routes PMS — utilisee par {@code suggest_navigation} pour pointer
 * l'utilisateur vers la bonne page.
 *
 * <p>Section dediee plutot que noyee dans le role : permet de la maintenir
 * independamment quand de nouvelles routes apparaissent, et de la desactiver
 * (briefing par exemple n'en a pas besoin).</p>
 *
 * <p>Limitee au preset CHAT.</p>
 */
@Component
public class NavigationMapSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Routes du PMS pour suggest_navigation(path, label, reason) :

            Operations :
              /planning          Calendrier multi-proprietes
              /dashboard         Tableau de bord KPI quotidiens
              /properties        Gestion des proprietes (ajout, photos, amenities)
              /interventions     Menages + maintenance + check-in/out
              /reservations      Liste des reservations
              /directory         Annuaire (equipes, prestataires, guests)

            Pilotage :
              /reports                       Rapports detailles
              /reports?tab=financial         Bilan financier mensuel
              /reports?tab=interventions     Reports operationnels
              /reports?tab=teams             Performance equipes
              /reports?tab=properties        Performance proprietes

            Revenue :
              /tarification      Pricing dynamique (regles, seasonalite, last-minute)
              /billing           Paiements, factures, payouts proprietaires
              /contracts         Contrats de gestion / mandats
              /channels          Connexions Airbnb / Booking / Vrbo / iCal
              /booking-engine    Widget direct sans commission

            Communication :
              /contact           Messages guests (email/SMS/WhatsApp)
              /documents         Templates documents (devis, factures, contrats)

            Configuration :
              /settings                       Parametres globaux
              /settings?tab=ai                Configuration IA (BYOK, modeles)
              /settings?tab=notifications     Preferences notifications
              /settings?tab=organization      Profil organisation

            Admin (super-admin uniquement) :
              /admin/monitoring       Monitoring infra
              /admin/promo-codes      Gestion des codes promo
              /admin/database         Database admin
              /admin/sync             Diagnostics sync""";

    @Override
    public String name() { return "navigation_map"; }

    @Override
    public int order() { return 320; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.isChat();
    }

    @Override
    protected String tagName() { return "navigation_map"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}

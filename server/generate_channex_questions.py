#!/usr/bin/env python3
"""Questionnaire Channex — SOURCE UNIQUE des questions à poser au support.

Ce fichier est la seule copie du contenu. Il produit :

  * ``CHANNEX-QUESTIONS-SUPPORT.md``     référence interne, français
  * ``CHANNEX-QUESTIONS-SUPPORT.en.md``  version envoyée à Channex, anglais
  * un formulaire PDF (anglais), le document réellement transmis

Usage ::

    python3 server/generate_channex_questions.py            # regénère les deux .md
    python3 server/generate_channex_questions.py --pdf ~/Desktop

Les deux ``.md`` sont versionnés et regénérés en place ; le PDF ne l'est pas et
n'est écrit que sur demande, dans le répertoire indiqué.

**Ne jamais éditer les .md à la main** : la prochaine exécution les écrase. Une
question se modifie ici, dans ``SECTIONS``, et les trois sorties suivent.

Le rendu PDF passe par Chrome en mode headless — aucune dépendance Python, ni
reportlab ni weasyprint. Design volontairement distinct du thème PDF Baitly
historique : une seule typographie, une seule teinte d'accent, pas d'aplats de
couleur — la hiérarchie passe par le poids, l'échelle et le blanc. Chaque
question offre soit des cases à cocher, soit des lignes réglées, selon qu'elle
appelle un choix ou une explication.

Le texte des questions s'écrit en markdown léger (``**gras**``, ``*italique*``,
``` `code` ```), converti en HTML pour le PDF. Pas d'emoji ni de flèches
typographiques : le thème historique les rendait en carrés noirs, et rien ne
garantit que la police de secours de Chrome fasse mieux.
"""
from __future__ import annotations

import argparse
import html as html_mod
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
]

# ── Identité graphique ──────────────────────────────────────────────────────
INK = "#16232C"      # encre principale, teintée vers le bleu nuit du wordmark
MUTED = "#5C6C77"
FAINT = "#8A99A3"
RULE = "#E1E7EA"
ACCENT = "#6B8A9A"   # primaire Baitly, celui du mark
BLUE = "#2563EB"     # packet « request » du mark
TEAL = "#14B8A6"     # packet « response » du mark
P0_RED = "#B0544E"

MARK_PATH = (
    "M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 "
    "V710 A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 "
    "313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 "
    "719 441.8 V675 A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 "
    "A30.25 30.25 0 0 1 559 529.75 A30.25 30.25 0 0 1 559 590.25"
)

# Le PDF n'existe qu'en anglais : c'est le document envoyé. Les libellés de
# cases n'ont donc pas de variante française.
YN = ["Yes", "No", "Partly", "N/A"]

DATE_FR = "2026-08-07"
DATE_EN = "7 August 2026"


# ── Contenu ─────────────────────────────────────────────────────────────────
# Section : (num, {titre}, {note} | None, [questions])
# Question : (id, prio, {texte}, options | None)   None => réponse libre.
SECTIONS = [
    ("1",
     {"fr": "Cloisonnement multi-organisations (groups)",
      "en": "Multi-tenant isolation (groups)"},
     {"fr": "Contexte : nous sommes un PMS multi-tenant sur **une seule clé API** "
            "Channex. `GET /properties` renvoie donc le compte entier, toutes nos "
            "organisations clientes confondues. Nous avons construit l'isolation sur "
            "les **groups** — un group par organisation, filtrage de la découverte "
            "sur le contenu des groups.",
      "en": "We run a multi-tenant PMS on **one Channex API key**, so "
            "`GET /properties` returns the whole account — every one of our client "
            "organisations at once. We built isolation on **groups**: one group per "
            "organisation, and we filter discovery by group membership."},
     [
      ("1.1", "P0",
       {"fr": "Le **widget iframe de connexion de canal** respecte-t-il les frontières "
              "de group ? Quand notre utilisateur ouvre l'assistant sur une propriété "
              "du group A, peut-il voir ou mapper des propriétés du group B ? *Notre "
              "isolation côté API serait sans valeur si l'iframe expose tout le compte.*",
        "en": "Does the **channel connection iframe** respect group boundaries? When "
              "our user opens the wizard on a property in group A, can they see or map "
              "properties in group B? *Our API-side isolation is worthless if the "
              "iframe exposes the whole account.*"}, YN),
      ("1.2", "P0",
       {"fr": "Existe-t-il une **clé API par group** (ou un jeton restreint à un "
              "group) ? Ce serait une isolation bien plus solide que notre filtrage "
              "applicatif, qui reste défensif.",
        "en": "Is there a **per-group API key**, or a token scoped to a single group? "
              "That would be far stronger isolation than our application-level "
              "filtering, which is only defensive."}, YN),
      ("1.3", "P1",
       {"fr": "Une propriété créée avec `group_id` rejoint-elle **aussi** un group par "
              "défaut du compte ? Nous détachons systématiquement des autres groups par "
              "précaution — est-ce nécessaire ?",
        "en": "Does a property created with `group_id` **also** join a default account "
              "group? We systematically detach from all other groups as a precaution — "
              "is that necessary?"}, YN),
      ("1.4", "P1",
       {"fr": "Y a-t-il une **limite au nombre de groups** par compte ? Nous en créons "
              "un par organisation cliente.",
        "en": "Is there a **limit on the number of groups** per account? We create one "
              "per client organisation."}, YN),
      ("1.5", "P2",
       {"fr": "Les **Group Users** peuvent-ils servir à donner à un de nos clients un "
              "accès dashboard restreint à son seul group, sans voir les autres ?",
        "en": "Can **Group Users** give one of our clients dashboard access restricted "
              "to their own group, without seeing the others?"}, YN),
     ]),

    ("2",
     {"fr": "Limites de débit", "en": "Rate limits"},
     {"fr": "Source de l'ambiguïté : `api-v.1-documentation/rate-limits` dit "
            "littéralement « The limit is 20 ARI total per minute **total** and broken "
            "down into 2 endpoints : 10 Restrictions & Price Requests **per minute per "
            "property**, 10 Availability Requests **per minute per property** ». Le mot "
            "« total » et la mention « per property » se contredisent.",
      "en": "Source of the ambiguity: `api-v.1-documentation/rate-limits` states "
            "verbatim \"The limit is 20 ARI total per minute **total** and broken down "
            "into 2 endpoints: 10 Restrictions & Price Requests **per minute per "
            "property**, 10 Availability Requests **per minute per property**\". The "
            "word \"total\" and the phrase \"per property\" contradict each other."},
     [
      ("2.1", "P0",
       {"fr": "Les 20 ARI/minute sont-ils **par propriété** ou **par compte** ? Nous "
              "avons dimensionné notre agrégateur sur l'hypothèse « par propriété » "
              "(2+2 appels/min/propriété). Si la limite est par compte, notre "
              "architecture ne tient pas au-delà de ~5 propriétés actives.",
        "en": "Are the 20 ARI calls per minute counted **per property** or **per "
              "account**? We sized our aggregator on the \"per property\" reading (2+2 "
              "calls/min/property). If the limit is account-wide, our architecture does "
              "not hold beyond roughly five active properties."},
       ["Per property", "Per account", "Other"]),
      ("2.2", "P0",
       {"fr": "S'il existe un plafond **au niveau du compte**, quelle est sa valeur, et "
              "évolue-t-il avec le nombre de propriétés sous contrat ?",
        "en": "If there **is** an account-level ceiling, what is its value, and does it "
              "scale with the number of contracted properties?"}, None),
      ("2.3", "P1",
       {"fr": "Les endpoints **hors ARI** (properties, channels, bookings, groups) "
              "ont-ils une limite ? Elle n'est documentée nulle part. Nos écrans "
              "d'administration enchaînent plusieurs `GET /groups/:id` et `GET /channels`.",
        "en": "Do **non-ARI endpoints** (properties, channels, bookings, groups) have "
              "any rate limit? None is documented. Our admin screens chain several "
              "`GET /groups/:id` and `GET /channels` calls."}, YN),
      ("2.4", "P1",
       {"fr": "Renvoyez-vous un en-tête **`Retry-After`** sur un 429 ? La doc n'en "
              "mentionne aucun ; nous appliquons donc une pause fixe d'une minute, "
              "comme recommandé.",
        "en": "Do you return a **`Retry-After`** header on a 429? The documentation "
              "mentions none, so we apply a fixed one-minute pause as recommended."}, YN),
      ("2.5", "P2",
       {"fr": "Y a-t-il un **maximum d'entrées** par appel `POST /availability` ou "
              "`POST /restrictions` ? La doc n'en cite aucun. Nous découpons à 5000 "
              "entrées, par prudence et non par contrainte connue.",
        "en": "Is there a **maximum number of entries** per `POST /availability` or "
              "`POST /restrictions` call? The documentation states none. We chunk at "
              "5000 entries out of caution, not because of a known constraint."}, YN),
     ]),

    ("3",
     {"fr": "Taxes et taxe de séjour", "en": "Taxes and city tax"},
     {"fr": "Contexte : marché **Maroc et France**, où la taxe de séjour communale est "
            "une obligation. Notre modèle interne la couvre ; nous voulons savoir si "
            "Channex peut la porter jusqu'aux plateformes.",
      "en": "We operate in **Morocco and France**, where a municipal city tax is a "
            "legal obligation. Our internal model covers it; we want to know whether "
            "Channex can carry it through to the channels."},
     [
      ("3.1", "P0",
       {"fr": "Les `taxes` / `tax_sets` sont-ils **effectivement transmis aux OTA** "
              "(Airbnb, Booking.com, Vrbo, Expedia), ou servent-ils uniquement à "
              "l'affichage et au reporting dans Channex ? *Ni la page Taxes ni la page "
              "Channel API ne le disent.* **Sans réponse positive, nous n'investissons pas.**",
        "en": "Are `taxes` / `tax_sets` **actually transmitted to the OTAs** (Airbnb, "
              "Booking.com, Vrbo, Expedia), or are they used only for display and "
              "reporting inside Channex? *Neither the Taxes page nor the Channel API "
              "page says.* **Without a positive answer we will not invest in this.**"}, YN),
      ("3.2", "P0",
       {"fr": "Si oui : **quels canaux** consomment réellement les taxes, et sous "
              "quelle forme (incluse dans le prix, ajoutée, affichée à part) ?",
        "en": "If yes: **which channels** actually consume taxes, and in what form "
              "(included in the rate, added on top, displayed separately)?"}, None),
      ("3.3", "P0",
       {"fr": "Comment exprimer une **exonération par âge** (« gratuit pour les moins "
              "de 18 ans ») ? Airbnb et Booking.com connaissent ce concept ; le modèle "
              "de taxe Channex ne semble pas l'exposer. *C'est notre unique vrai "
              "blocage : sans lui, une taxe transmise serait surestimée dès qu'un "
              "séjour comporte des enfants, et nous préférons ne rien transmettre que "
              "transmettre un montant faux.*",
        "en": "How do we express an **age-based exemption** (\"free for guests under "
              "18\")? Airbnb and Booking.com both understand this concept; the Channex "
              "tax model does not appear to expose it. *This is our single real "
              "blocker: without it, a transmitted tax would be overstated as soon as a "
              "stay includes children, and we would rather transmit nothing than "
              "transmit a wrong amount.*"}, YN),
      ("3.4", "P1",
       {"fr": "Comment exprimer un **plafond par personne et par nuit** (montant "
              "maximum au-delà duquel la taxe ne progresse plus) ? Fréquent dans les "
              "barèmes communaux français.",
        "en": "How do we express a **per-person-per-night cap** (a ceiling beyond which "
              "the tax stops increasing)? Common in French municipal tax schedules."}, YN),
      ("3.5", "P1",
       {"fr": "`applicable_date_ranges` est limité à **20 plages**. Est-ce suffisant "
              "pour un barème saisonnier pluriannuel, ou faut-il recréer la taxe chaque "
              "année ?",
        "en": "`applicable_date_ranges` is capped at **20 ranges**. Is that enough for "
              "a multi-year seasonal schedule, or must the tax be recreated each year?"}, YN),
      ("3.6", "P2",
       {"fr": "Le `level` d'un tax set gouverne-t-il bien la **taxation en cascade** "
              "(une surcharge départementale calculée sur la taxe communale, et non sur "
              "le prix nu) ?",
        "en": "Does the `level` field on a tax set govern **cascading taxation** — i.e. "
              "a departmental surcharge computed on top of the municipal tax rather "
              "than on the bare rate?"}, YN),
     ]),

    ("4",
     {"fr": "Contenu poussé vers les plateformes",
      "en": "Content pushed to the channels"},
     None,
     [
      ("4.1", "P1",
       {"fr": "**Quels canaux consomment quoi** — `description`, `photos`, "
              "`facilities`, `hotel_policies` ? La page Channel API se borne à « chaque "
              "mapping de canal est différent ». Nous voudrions savoir quel contenu "
              "produit un effet réel avant de construire les correspondances.",
        "en": "**Which channels consume what** — `description`, `photos`, `facilities`, "
              "`hotel_policies`? The Channel API page only says \"each channel mapping "
              "is different\". We would like to know which content actually has an "
              "effect before building the mappings."}, None),
      ("4.2", "P1",
       {"fr": "Le catalogue de **facilities est en lecture seule** (181 entrées) et "
              "vous invitez à vous contacter pour un ajout. Quel est le **délai** d'une "
              "demande d'ajout, et acceptez-vous des équipements spécifiques à la "
              "location saisonnière au Maroc (hammam, terrasse-riad, patio) ?",
        "en": "The **facilities catalogue is read-only** (181 entries) and you invite "
              "us to contact you for additions. What is the **turnaround** on such a "
              "request, and would you accept facilities specific to Moroccan short-term "
              "rentals (hammam, riad terrace, patio)?"}, None),
      ("4.3", "P1",
       {"fr": "Les **hotel policies** sont-elles **exigées** par un canal en particulier "
              "(complétude du contenu Booking.com, prérequis Google Vacation Rental) ? "
              "`POST /hotel_policies` impose stationnement, accès internet, animaux et "
              "tabac — champs qu'un PMS de location courte durée ne détient pas "
              "toujours. Peut-on créer une policy partielle ?",
        "en": "Are **hotel policies required** by any specific channel (Booking.com "
              "content completeness, Google Vacation Rental prerequisites)? "
              "`POST /hotel_policies` mandates parking, internet access, pets and "
              "smoking — fields a short-term rental PMS does not always hold. Can a "
              "partial policy be created?"}, YN),
      ("4.4", "P2",
       {"fr": "La politique d'annulation se porte-t-elle bien sur le **rate plan** et "
              "les booking settings, et non sur la hotel policy ? Notre lecture de la "
              "doc le suggère, nous voulons le confirmer.",
        "en": "Is the cancellation policy carried on the **rate plan** and booking "
              "settings rather than on the hotel policy? That is our reading of the "
              "documentation and we would like it confirmed."}, YN),
     ]),

    ("5",
     {"fr": "Webhooks", "en": "Webhooks"}, None,
     [
      ("5.1", "P0",
       {"fr": "Vos webhooks n'embarquent **aucune signature HMAC**. Le secret partagé "
              "en en-tête custom est-il votre recommandation officielle, ou existe-t-il "
              "un mécanisme de signature non documenté ? Une **plage d'adresses IP** à "
              "autoriser en liste blanche ? *Nous recevons par ce canal des "
              "réservations qui déclenchent des effets financiers.*",
        "en": "Your webhooks carry **no HMAC signature**. Is a shared secret in a custom "
              "header your official recommendation, or is there an undocumented signing "
              "mechanism? Is there an **IP range** we should allowlist? *This channel "
              "delivers bookings that trigger financial side effects on our side.*"}, YN),
      ("5.2", "P1",
       {"fr": "Une signature cryptographique est-elle à votre feuille de route ? À "
              "quelle échéance ?",
        "en": "Is cryptographic signing on your roadmap, and on what timeline?"}, YN),
      ("5.3", "P1",
       {"fr": "Que se passe-t-il si nous **n'acquittons jamais** une réservation ? "
              "`non_acked_booking` se déclenche après 30 minutes — ensuite ? Y a-t-il "
              "une conséquence côté canal (annulation automatique, alerte à l'hôte) ?",
        "en": "What happens if we **never acknowledge** a booking? `non_acked_booking` "
              "fires after 30 minutes — and then? Is there a channel-side consequence "
              "(automatic cancellation, host alert)?"}, None),
      ("5.4", "P2",
       {"fr": "Quelle est votre **politique de réémission** en cas d'échec de notre "
              "endpoint (nombre de tentatives, espacement, abandon) ?",
        "en": "What is your **redelivery policy** when our endpoint fails (number of "
              "attempts, spacing, give-up threshold)?"}, None),
     ]),

    ("6",
     {"fr": "Connexion des canaux et compte whitelabel",
      "en": "Channel connection and whitelabel"},
     {"fr": "Contexte : sur un compte standard, nous ne pouvons pas créer un canal par "
            "API et passons par votre widget iframe. Nous avons dû inventer une "
            "propriété « pivot » comme point d'ancrage de l'OAuth.",
      "en": "On a standard account we cannot create a channel through the API, so we go "
            "through your iframe widget. We had to invent a \"pivot\" property to anchor "
            "the OAuth flow."},
     [
      ("6.1", "P0",
       {"fr": "Le contournement par **propriété pivot** — créer une propriété technique "
              "pour porter l'authentification OTA au niveau du compte — est-il le motif "
              "que vous recommandez, ou existe-t-il un endpoint prévu pour cela ? *Nous "
              "préférerions ne pas dépendre d'un contournement.*",
        "en": "Is the **pivot property** workaround — creating a technical property to "
              "carry account-level OTA authentication — the pattern you recommend, or "
              "is there an endpoint designed for this? *We would rather not depend on a "
              "workaround.*"},
       ["Recommended pattern", "A dedicated endpoint exists", "Other"]),
      ("6.2", "P0",
       {"fr": "Que débloque exactement le **statut whitelabel** ? Nous avons identifié : "
              "création de canal par API, mapping d'une annonce sur une chambre, "
              "enregistrement de webhook par propriété. La liste est-elle complète ? "
              "**Conditions commerciales et tarif ?**",
        "en": "What exactly does **whitelabel status** unlock? We have identified: "
              "channel creation via API, mapping a listing to a room, per-property "
              "webhook registration. Is that list complete? **Commercial terms and "
              "pricing?**"}, None),
      ("6.3", "P1",
       {"fr": "Un compte standard peut-il, à terme, **créer un canal par API** sans "
              "passer au whitelabel ?",
        "en": "Will a standard account ever be able to **create a channel through the "
              "API** without moving to whitelabel?"}, YN),
      ("6.4", "P2",
       {"fr": "Le widget iframe peut-il être **pré-rempli au-delà du filtre par OTA** "
              "(identifiants, sélection d'annonce) pour raccourcir le parcours de nos "
              "hôtes ?",
        "en": "Can the iframe widget be **pre-filled beyond the OTA filter** "
              "(credentials, listing selection) to shorten the flow for our hosts?"}, YN),
     ]),

    ("7",
     {"fr": "Application de paiement", "en": "Payment Application API"}, None,
     [
      ("7.1", "P0",
       {"fr": "L'**API Payment Application** est-elle disponible sur un compte "
              "**standard**, ou réservée au whitelabel ?",
        "en": "Is the **Payment Application API** available on a **standard** account, "
              "or is it whitelabel-only?"},
       ["Standard account", "Whitelabel only", "Other"]),
      ("7.2", "P0",
       {"fr": "Fonctionne-t-elle avec des comptes Stripe **marocains** ? *Stripe n'opère "
              "pas au Maroc ; c'est déterminant pour notre marché principal.* Si non, "
              "prévoyez-vous d'autres fournisseurs (CMI, PayZone, ou un acquéreur local) ?",
        "en": "Does it work with **Moroccan** Stripe accounts? *Stripe does not operate "
              "in Morocco, which makes this decisive for our primary market.* If not, "
              "do you plan to support other providers (CMI, PayZone, a local acquirer)?"}, YN),
      ("7.3", "P1",
       {"fr": "Quel est le **modèle de frais** : commission Channex par transaction, "
              "abonnement, ou uniquement les frais Stripe ?",
        "en": "What is the **fee model**: a Channex commission per transaction, a "
              "subscription, or Stripe fees only?"}, None),
      ("7.4", "P1",
       {"fr": "Couvre-t-elle la **pré-autorisation / caution** (empreinte de carte sans "
              "débit, capture différée, libération) ?",
        "en": "Does it cover **pre-authorisation and security deposits** (card hold "
              "without capture, deferred capture, release)?"}, YN),
      ("7.5", "P2",
       {"fr": "Comment s'articule-t-elle avec la **tokenisation Stripe** déjà exposée "
              "sur les réservations ? Sont-ce deux chemins concurrents ou "
              "complémentaires ?",
        "en": "How does it relate to the **Stripe tokenisation** already exposed on "
              "bookings? Are these competing or complementary paths?"}, None),
     ]),

    ("8",
     {"fr": "Marché marocain", "en": "Moroccan market"}, None,
     [
      ("8.1", "P0",
       {"fr": "Quels **canaux sont ouverts** à des logements situés au Maroc ? Airbnb, "
              "Booking.com, Expedia, Vrbo — y a-t-il des restrictions par pays ?",
        "en": "Which **channels are available** for properties located in Morocco? "
              "Airbnb, Booking.com, Expedia, Vrbo — are there country restrictions?"}, None),
      ("8.2", "P1",
       {"fr": "Le **MAD** est-il pris en charge comme devise de propriété et de rate "
              "plan sur l'ensemble des canaux ?",
        "en": "Is **MAD** supported as a property and rate plan currency across all "
              "channels?"}, YN),
      ("8.3", "P1",
       {"fr": "Existe-t-il des **exigences de contenu propres au Maroc** (classement, "
              "licence, numéro d'établissement) que les canaux imposent et que nous "
              "devrions collecter ?",
        "en": "Are there **Morocco-specific content requirements** (classification, "
              "licence, establishment number) imposed by the channels that we should be "
              "collecting?"}, YN),
     ]),

    ("9",
     {"fr": "Limites de dimensionnement", "en": "Sizing limits"}, None,
     [
      ("9.1", "P1",
       {"fr": "Y a-t-il une **limite au nombre de propriétés** par compte ? La doc "
              "plafonne les room types (50) et rate plans (10 par room type) en "
              "location saisonnière, mais reste muette sur le compte.",
        "en": "Is there a **limit on the number of properties** per account? The "
              "documentation caps room types (50) and rate plans (10 per room type) for "
              "vacation rentals, but says nothing about the account."}, YN),
      ("9.2", "P2",
       {"fr": "Vous indiquez pouvoir **relever ces plafonds au cas par cas**. Quelle "
              "est la procédure, et le délai ?",
        "en": "You state that these caps can be **raised case by case**. What is the "
              "process and the turnaround?"}, None),
     ]),

    ("C",
     {"fr": "Questions commerciales", "en": "Commercial"}, None,
     [
      ("C.1", "P0",
       {"fr": "**Modèle tarifaire** : par propriété, par canal connecté, par "
              "réservation, ou forfait ? Grille exacte pour un parc de 10, 100 et 1000 "
              "logements.",
        "en": "**Pricing model**: per property, per connected channel, per booking, or "
              "flat fee? Please give the exact schedule for portfolios of 10, 100 and "
              "1000 properties."}, None),
      ("C.2", "P0",
       {"fr": "Une propriété **sans canal actif** (créée mais pas encore distribuée) "
              "est-elle facturée ? *Notre parcours en crée à l'avance ; l'exposition "
              "financière dépend de la réponse.*",
        "en": "Is a property **with no active channel** (created but not yet "
              "distributed) billed? *Our onboarding flow creates them ahead of time; our "
              "financial exposure depends on the answer.*"}, YN),
      ("C.3", "P1",
       {"fr": "Le type `property_type: \"apartment\"` conditionne-t-il bien le **barème "
              "Vacation Rental** plutôt qu'hôtelier ?",
        "en": "Does `property_type: \"apartment\"` correctly select the **Vacation "
              "Rental** billing scale rather than the hotel one?"}, YN),
      ("C.4", "P1",
       {"fr": "Les **propriétés pivots** techniques, et les propriétés orphelines que "
              "nous purgeons, entrent-elles dans le décompte facturé ?",
        "en": "Do technical **pivot properties**, and the orphaned properties we purge, "
              "count towards billing?"}, YN),
      ("C.5", "P1",
       {"fr": "**Environnement de test** : le sandbox est-il gratuit et sans limite de "
              "durée ? Reflète-t-il le comportement réel des canaux, ou seulement l'API ?",
        "en": "**Test environment**: is the sandbox free and open-ended? Does it reflect "
              "real channel behaviour, or only the API?"}, YN),
      ("C.6", "P1",
       {"fr": "Quel est l'**engagement de service** (disponibilité, délai de réponse au "
              "support, canal d'escalade en incident de production) ?",
        "en": "What is your **service commitment** — uptime, support response time, "
              "escalation path during a production incident?"}, None),
      ("C.7", "P0",
       {"fr": "Où sont **hébergées les données** ? Question RGPD : sous-traitant au sens "
              "de l'article 28, DPA disponible, transferts hors UE ?",
        "en": "Where is **data hosted**? GDPR: are you a processor under Article 28, is "
              "a DPA available, are there transfers outside the EU?"}, None),
      ("C.8", "P1",
       {"fr": "Quel **préavis** en cas d'évolution incompatible de l'API ? Versionnez-vous, "
              "ou modifiez-vous v1 en place ?",
        "en": "What **notice** do you give for a breaking API change? Do you version, or "
              "modify v1 in place?"}, None),
     ]),
]

SETTLED = [
    {"fr": "Format ARI `date_from`/`date_to`, champs requis et optionnels.",
     "en": "ARI `date_from`/`date_to` format, required and optional fields."},
    {"fr": "Catalogue des 25 types d'événements webhook.",
     "en": "The catalogue of 25 webhook event types."},
    {"fr": "Contrainte « une propriété appartient à au moins un group », d'où l'ordre "
           "rattacher-puis-détacher.",
     "en": "The \"a property must belong to at least one group\" constraint, hence the "
           "attach-then-detach ordering."},
    {"fr": "Absence de filtre `group_id` sur `GET /properties` (filtres : `id`, `title`, "
           "`is_active`) — d'où l'interrogation du group plutôt que des propriétés.",
     "en": "The absence of a `group_id` filter on `GET /properties` (filters: `id`, "
           "`title`, `is_active`) — hence querying the group rather than the properties."},
    {"fr": "Format `event_mask` en chaîne à points-virgules.",
     "en": "The `event_mask` semicolon-separated string format."},
]


# ── Markdown léger -> HTML ──────────────────────────────────────────────────
def md_to_html(text: str) -> str:
    """Convertit le markdown léger des questions en HTML pour le PDF.

    L'échappement vient en premier : le texte contient des chevrons potentiels
    et des guillemets, jamais de HTML volontaire.
    """
    out = html_mod.escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)   # gras avant italique
    out = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", out)
    return out


# ── Sortie markdown ─────────────────────────────────────────────────────────
BANNER = {
    "fr": ("<!-- FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.\n"
           "     Source unique : server/generate_channex_questions.py\n"
           "     Régénérer : python3 server/generate_channex_questions.py -->\n\n"),
    "en": ("<!-- GENERATED FILE — DO NOT EDIT BY HAND.\n"
           "     Single source: server/generate_channex_questions.py\n"
           "     Regenerate: python3 server/generate_channex_questions.py -->\n\n"),
}

PREAMBLE = {
    "fr": f"""# Channex — questions ouvertes pour le support et le commercial

> English version: [CHANNEX-QUESTIONS-SUPPORT.en.md](CHANNEX-QUESTIONS-SUPPORT.en.md)
> — c'est celle qu'on envoie à Channex ; celle-ci est la référence interne.
>
> Les deux fichiers et le formulaire PDF sont **générés** depuis
> [generate_channex_questions.py](generate_channex_questions.py). Une question se
> modifie là, jamais ici.
>
> ```
> python3 server/generate_channex_questions.py              # les deux .md
> python3 server/generate_channex_questions.py --pdf ~/Desktop
> ```

> Établi le {DATE_FR}, à partir d'un audit de notre implémentation confrontée à
> la documentation publique (`docs.channex.io`).
>
> **Chaque question ci-dessous naît d'un point que la documentation ne tranche
> pas.** Aucune n'est une demande d'explication générale : ce sont des zones
> d'ombre qui nous ont fait, ou nous feraient, prendre une décision technique à
> l'aveugle. La source de l'ambiguïté est citée à chaque fois.
>
> Priorités : **P0** bloque un chantier en cours · **P1** conditionne un choix
> d'architecture · **P2** informatif, à confirmer sans urgence.
""",
    "en": f"""# Channex — open questions for support and sales

> Version française : [CHANNEX-QUESTIONS-SUPPORT.md](CHANNEX-QUESTIONS-SUPPORT.md)
> — the internal reference. This is the version we send.
>
> Both files and the PDF form are **generated** from
> [generate_channex_questions.py](generate_channex_questions.py). Edit a question
> there, never here.

> Compiled {DATE_EN}, from an audit of our integration against the public
> documentation at `docs.channex.io`.
>
> **Every question below comes from a point the documentation does not
> settle.** None of them ask for a general explanation: each is a gap that has
> forced — or would force — us to make a technical decision blind. The source of
> the ambiguity is cited each time.
>
> Priorities: **P0** blocks work already in progress · **P1** determines an
> architectural choice · **P2** informational, confirm when convenient.
>
> About us: we are a multi-tenant PMS for short-term rentals, operating in
> France and Morocco, integrated with Channex through a single API key.
""",
}

CLOSING_TITLE = {"fr": "Ce qui n'a pas besoin d'être demandé",
                 "en": "What does not need answering"}
CLOSING_NOTE = {
    "fr": "Vérifié dans la documentation, sans ambiguïté — noté ici pour éviter de "
          "faire perdre du temps à l'interlocuteur :",
    "en": "Verified in the documentation and unambiguous — listed here so as not to "
          "waste your time:",
}
TABLE_HEAD = {"fr": "| # | Prio | Question |\n|---|---|---|",
              "en": "| # | Prio | Question |\n|---|---|---|"}


def render_markdown(lang: str) -> str:
    parts = [BANNER[lang], PREAMBLE[lang], "\n---\n"]
    for num, title, note, questions in SECTIONS:
        parts.append(f"\n## {num}. {title[lang]}\n")
        if note:
            parts.append(f"\n{note[lang]}\n")
        parts.append("\n" + TABLE_HEAD[lang])
        for qid, prio, text, _opts in questions:
            # Le P0 est mis en gras : sur 46 lignes, c'est le seul repère qui
            # survit à une lecture en diagonale.
            prio_cell = f"**{prio}**" if prio == "P0" else prio
            body = text[lang].replace("|", "\\|")
            parts.append(f"| {qid} | {prio_cell} | {body} |")
        parts.append("")
    parts.append(f"\n---\n\n## {CLOSING_TITLE[lang]}\n\n{CLOSING_NOTE[lang]}\n")
    parts += [f"\n- {s[lang]}" for s in SETTLED]
    return "\n".join(parts).rstrip() + "\n"


# ── Sortie PDF (anglais) ────────────────────────────────────────────────────
def baitly_mark(size: int = 34) -> str:
    common = ('fill="none" stroke-width="21" stroke-linecap="round" '
              'stroke-linejoin="round"')
    return (f'<svg viewBox="251 251 522 522" width="{size}" height="{size}" aria-label="Baitly">'
            f'<path stroke="{ACCENT}" {common} d="{MARK_PATH}"/>'
            f'<path stroke="{BLUE}" {common} pathLength="100" stroke-dasharray="5 95" '
            f'stroke-dashoffset="-18" d="{MARK_PATH}"/>'
            f'<path stroke="{TEAL}" {common} pathLength="100" stroke-dasharray="5 95" '
            f'stroke-dashoffset="-63" d="{MARK_PATH}"/></svg>')


CSS = f"""
@page {{ size: A4; margin: 17mm 15mm 15mm; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; }}
body {{
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: {INK}; font-size: 9.6pt; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}}
code {{
  font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 0.9em;
  color: {MUTED}; background: #F4F7F8; padding: 0.5pt 2.5pt; border-radius: 2px;
}}
em {{ font-style: normal; color: {MUTED}; }}
strong {{ font-weight: 600; }}

.cover {{ page-break-after: always; padding-top: 4mm; }}
.brands {{ display: flex; align-items: center; gap: 13px; padding-bottom: 13mm; }}
.brand {{ display: flex; align-items: center; gap: 8px; }}
.brand-name {{ font-size: 15pt; font-weight: 600; letter-spacing: -0.4px; color: {INK}; }}
/* Le lien entre les deux marques reprend le motif du logo : un flux, et un
   paquet qui circule. Pas un simple tiret. */
.link {{ flex: 1; height: 9px; position: relative; }}
.link:before {{
  content: ""; position: absolute; left: 0; right: 0; top: 4px;
  height: 1px; background: {RULE};
}}
.link:after {{
  content: ""; position: absolute; left: 42%; top: 1.5px;
  width: 6px; height: 6px; border-radius: 50%; background: {TEAL};
}}
.eyebrow {{
  font-size: 7.6pt; font-weight: 600; letter-spacing: 1.5px;
  text-transform: uppercase; color: {ACCENT}; margin-bottom: 5mm;
}}
h1 {{
  font-size: 27pt; font-weight: 600; letter-spacing: -1.1px; line-height: 1.12;
  margin: 0 0 5mm; max-width: 15cm; text-wrap: balance;
}}
.lede {{
  font-size: 11pt; line-height: 1.6; color: {MUTED};
  max-width: 14.5cm; margin: 0 0 11mm;
}}
.meta {{
  display: flex; gap: 11mm; padding: 4mm 0 0;
  border-top: 1px solid {RULE}; margin-bottom: 11mm;
}}
.meta div {{ font-size: 8.4pt; }}
.meta dt {{
  color: {FAINT}; font-weight: 600; letter-spacing: 0.6px;
  text-transform: uppercase; font-size: 7pt; margin-bottom: 1.5mm;
}}
.how {{ border: 1px solid {RULE}; border-radius: 6px; padding: 6mm 7mm; margin-bottom: 8mm; }}
.how h2 {{ font-size: 10.5pt; font-weight: 600; margin: 0 0 3mm; }}
.how p {{ margin: 0 0 3mm; color: {MUTED}; font-size: 9.2pt; }}
.how p:last-child {{ margin-bottom: 0; }}
.legend {{ display: flex; gap: 9mm; }}
.legend div {{ font-size: 8.4pt; color: {MUTED}; }}

.section {{ margin-top: 9mm; }}
.section:first-of-type {{ margin-top: 0; }}
.sec-head {{
  display: flex; align-items: baseline; gap: 4mm; padding-bottom: 2.5mm;
  border-bottom: 1.5px solid {INK}; margin-bottom: 4mm; page-break-after: avoid;
}}
.sec-num {{ font-size: 8pt; font-weight: 600; color: {ACCENT}; letter-spacing: 1px; }}
.sec-title {{ font-size: 13pt; font-weight: 600; letter-spacing: -0.3px; }}
.sec-note {{
  font-size: 8.8pt; color: {MUTED}; line-height: 1.55; margin-bottom: 4.5mm;
  max-width: 16cm; page-break-after: avoid;
}}

/* Pas de bordure basse : les lignes réglées de la réponse structurent déjà,
   et l'empilement des deux donnait un triple trait. */
.q {{ display: flex; gap: 4.5mm; padding: 3.6mm 0 6.5mm; page-break-inside: avoid; }}
.q-gutter {{ width: 15mm; flex-shrink: 0; padding-top: 0.4mm; }}
.q-id {{ font-size: 9pt; font-weight: 600; color: {INK}; }}
.q-prio {{ display: block; font-size: 7pt; font-weight: 700; letter-spacing: 0.9px; margin-top: 0.7mm; }}
.p0 {{ color: {P0_RED}; }}
.p1 {{ color: {ACCENT}; }}
.p2 {{ color: {FAINT}; }}
.q-body {{ flex: 1; min-width: 0; }}
.q-text {{ margin-bottom: 2.6mm; }}
.opts {{ display: flex; gap: 5.4mm; margin-bottom: 2.2mm; }}
.opt {{ display: flex; align-items: center; gap: 2mm; font-size: 8.8pt; }}
.cb {{ width: 3.1mm; height: 3.1mm; border: 1px solid {ACCENT}; border-radius: 1px; flex-shrink: 0; }}
.rules .rule {{ border-bottom: 1px solid {RULE}; height: 5.2mm; }}
.detail {{
  font-size: 7.4pt; color: {FAINT}; letter-spacing: 0.5px;
  text-transform: uppercase; font-weight: 600; margin-bottom: 1.2mm;
}}

.settled {{ margin-top: 9mm; page-break-inside: avoid; }}
.settled ul {{ margin: 0; padding-left: 4.5mm; color: {MUTED}; font-size: 8.8pt; }}
.settled li {{ margin-bottom: 1.6mm; }}
.signoff {{
  margin-top: 9mm; padding-top: 4mm; border-top: 1px solid {RULE};
  display: flex; gap: 10mm; page-break-inside: avoid;
}}
.signoff div {{ flex: 1; }}
.signoff .lbl {{
  font-size: 7pt; font-weight: 600; letter-spacing: 0.7px;
  text-transform: uppercase; color: {FAINT}; margin-bottom: 6mm;
}}
.signoff .line {{ border-bottom: 1px solid {RULE}; }}
"""


def render_question_html(qid, prio, text, opts) -> str:
    if opts:
        boxes = "".join(
            f'<span class="opt"><span class="cb"></span>{html_mod.escape(o)}</span>'
            for o in opts)
        answer = (f'<div class="opts">{boxes}</div><div class="detail">Details</div>'
                  f'<div class="rules"><div class="rule"></div><div class="rule"></div></div>')
    else:
        answer = ('<div class="detail">Answer</div><div class="rules">'
                  '<div class="rule"></div><div class="rule"></div><div class="rule"></div></div>')
    return (f'<div class="q"><div class="q-gutter"><div class="q-id">{qid}</div>'
            f'<span class="q-prio {prio.lower()}">{prio}</span></div>'
            f'<div class="q-body"><div class="q-text">{md_to_html(text["en"])}</div>'
            f'{answer}</div></div>')


def render_html() -> str:
    total = sum(len(q) for _, _, _, q in SECTIONS)
    body = [f'''<div class="cover">
<div class="brands">
  <div class="brand">{baitly_mark(34)}<span class="brand-name">Baitly</span></div>
  <div class="link"></div>
  <div class="brand"><span class="brand-name" style="color:{MUTED};letter-spacing:-0.2px">channex</span></div>
</div>
<div class="eyebrow">Integration review</div>
<h1>Open questions on the Channex API</h1>
<p class="lede">We audited our integration against your public documentation and
found a number of points it does not settle. Each question below blocks — or has
already forced — a technical decision on our side. None of them ask for a general
explanation.</p>
<div class="meta">
  <div><dt>From</dt>Baitly — multi-tenant PMS for short-term rentals, France and Morocco</div>
  <div><dt>Date</dt>{DATE_EN}</div>
  <div><dt>Questions</dt>{total} across {len(SECTIONS)} sections</div>
</div>
<div class="how">
  <h2>How to answer</h2>
  <p>Tick a box where one fits, and use the ruled lines whenever the answer
  deserves more than a box — most of them do. Feel free to skip anything outside
  your remit and pass it on; we would rather have a partial answer from the right
  person than a complete one from the wrong one.</p>
  <p>Questions marked <strong style="color:{P0_RED}">P0</strong> block work already in
  progress. If your time is limited, those are the ones worth your attention.</p>
  <div class="legend">
    <div><strong class="p0">P0</strong> &nbsp;Blocks work in progress</div>
    <div><strong class="p1">P1</strong> &nbsp;Determines an architectural choice</div>
    <div><strong class="p2">P2</strong> &nbsp;Informational</div>
  </div>
</div>
</div>''']

    for num, title, note, questions in SECTIONS:
        s = ['<div class="section">',
             f'<div class="sec-head"><span class="sec-num">{num}</span>'
             f'<span class="sec-title">{html_mod.escape(title["en"])}</span></div>']
        if note:
            s.append(f'<div class="sec-note">{md_to_html(note["en"])}</div>')
        s += [render_question_html(*q) for q in questions]
        s.append('</div>')
        body.append("".join(s))

    body.append('<div class="settled">'
                '<div class="sec-head"><span class="sec-num">&mdash;</span>'
                f'<span class="sec-title">{CLOSING_TITLE["en"]}</span></div>'
                f'<div class="sec-note">{CLOSING_NOTE["en"]}</div><ul>'
                + "".join(f'<li>{md_to_html(s["en"])}</li>' for s in SETTLED) + '</ul></div>')
    body.append('<div class="signoff">'
                '<div><div class="lbl">Answered by</div><div class="line"></div></div>'
                '<div><div class="lbl">Role</div><div class="line"></div></div>'
                '<div><div class="lbl">Date</div><div class="line"></div></div></div>')

    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Baitly - Channex integration questions</title>'
            f'<style>{CSS}</style></head><body>{"".join(body)}</body></html>')


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        resolved = candidate if pathlib.Path(candidate).exists() else shutil.which(candidate)
        if resolved:
            return resolved
    return None


def check_integrity():
    """Garde-fou : des identifiants dupliqués produiraient un document trompeur."""
    ids = [q[0] for _, _, _, qs in SECTIONS for q in qs]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f"Identifiants de question dupliqués : {sorted(dupes)}")
    for _, _, _, qs in SECTIONS:
        for qid, prio, text, _ in qs:
            if prio not in ("P0", "P1", "P2"):
                raise SystemExit(f"{qid} : priorité inconnue {prio!r}")
            missing = {"fr", "en"} - set(text)
            if missing:
                raise SystemExit(f"{qid} : traduction manquante {missing}")
    return len(ids)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--pdf", metavar="DIR", default=None,
                        help="produit aussi le formulaire PDF dans ce répertoire")
    parser.add_argument("--name", default="Baitly-Channex-questions",
                        help="nom du PDF, sans extension")
    args = parser.parse_args()

    total = check_integrity()

    for lang, filename in (("fr", "CHANNEX-QUESTIONS-SUPPORT.md"),
                           ("en", "CHANNEX-QUESTIONS-SUPPORT.en.md")):
        path = HERE / filename
        path.write_text(render_markdown(lang), encoding="utf-8")
        print(f"markdown : {path.name}")

    print(f"           {total} questions, {len(SECTIONS)} sections")

    if not args.pdf:
        return 0

    out_dir = pathlib.Path(args.pdf).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    chrome = find_chrome()
    if not chrome:
        print("Chrome introuvable : PDF non produit.", file=sys.stderr)
        return 1

    # Le HTML intermédiaire est un détail d'implémentation : il vit dans un
    # répertoire temporaire, pas à côté du livrable.
    with tempfile.TemporaryDirectory() as tmp:
        html_path = pathlib.Path(tmp) / "questionnaire.html"
        html_path.write_text(render_html(), encoding="utf-8")
        pdf_path = out_dir / f"{args.name}.pdf"
        subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
             f"--print-to-pdf={pdf_path}", str(html_path)],
            check=True, capture_output=True)
        if not pdf_path.exists():
            print("Chrome n'a produit aucun PDF.", file=sys.stderr)
            return 1
        print(f"pdf      : {pdf_path}  ({pdf_path.stat().st_size // 1024} Ko)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

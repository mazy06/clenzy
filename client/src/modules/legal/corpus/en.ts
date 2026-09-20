/**
 * Baitly legal corpus — ENGLISH version.
 *
 * <p>Translated from the French corpus, which prevails: every document states
 * so in its own closing article. Same documents, same blocks, same order —
 * the shared structure is what lets the test suite prove no article went
 * missing in translation.</p>
 *
 * <p>The 〔…〕 placeholders are deliberately left as they stand in the French:
 * they are the same registration details, awaiting the same filing.</p>
 */

import type { LegalDoc } from './types';

export const LEGAL_DOCS_EN: LegalDoc[] = [
  /* ────────────────────────────── LEGAL NOTICE ─────────────────────────── */
  {
    slug: 'mentions-legales',
    title: 'Legal notice',
    updated: '24 July 2026',
    intro:
      'Information about the publisher and the hosting of the baitly site and its platform, under Moroccan law no. 53-05 on the electronic exchange of legal data and, for users established in the European Union, French law no. 2004-575 on confidence in the digital economy (LCEN).',
    blocks: [
      {
        heading: '1. Publisher of the site and the platform',
        paragraphs: [
          'The Baitly site and platform (the “Service”) are published by 〔Baitly SARL〕, a limited liability company under Moroccan law with share capital of 〔•〕 MAD, registered office at 〔registered office address, city〕, Morocco.',
        ],
        list: [
          'Common Enterprise Identifier (ICE): 〔•〕',
          'Trade register: RC 〔•〕 — 〔city〕',
          'Tax identifier (IF): 〔•〕 · Business tax: 〔•〕 · CNSS: 〔•〕',
          'Publication director: 〔manager’s name〕, as manager',
          'Contact: contact@baitly.ma · +212 〔•〕',
        ],
      },
      {
        heading: '2. Hosting',
        paragraphs: [
          'The Service is hosted by 〔OVHcloud — 2 rue Kellermann, 59100 Roubaix, France — +33 9 72 10 10 07〕. Production data is hosted in data centres located in the European Union. Some technical subprocessors listed in the Privacy policy may operate from other jurisdictions, under the conditions described there.',
        ],
      },
      {
        heading: '3. Intellectual property',
        paragraphs: [
          'Every element making up the site and the platform (architecture, code, text, graphics, logos, the “Baitly” trademark, the animated mark, databases, documentation) is protected by Moroccan law no. 17-97 on the protection of industrial property and law no. 2-00 on copyright and neighbouring rights, as well as by the applicable international conventions.',
          'Any reproduction, representation, adaptation or extraction, in whole or in part, without the publisher’s prior written consent is prohibited and constitutes infringement. Third-party trademarks and logos mentioned (Airbnb, Booking.com, Google, Stripe, CMI, PayZone, YouCan Pay, Nuki, Minut, Channex, etc.) remain the property of their respective owners; mentioning them implies neither partnership nor endorsement on their part, unless expressly stated.',
        ],
      },
      {
        heading: '4. Liability for the site’s content',
        paragraphs: [
          'The information published on the site (features, indicative prices, educational content, market data) is provided for information only and may change at any time. It constitutes neither legal, accounting nor tax advice. The regulatory obligations described (police record, tourist tax, invoicing) are implemented by the Service according to the regulations as currently known; it is for each client to check, with their own advisers, that they fit their situation.',
        ],
      },
      {
        heading: '5. Hypertext links',
        paragraphs: [
          'The site may contain links to third-party sites. The publisher exercises no control over those sites and disclaims all liability for their content. Setting up a link to the baitly site requires no prior authorisation, provided it does not harm the publisher’s image; the publisher reserves the right to request its removal.',
        ],
      },
      {
        heading: '6. Personal data and cookies',
        paragraphs: [
          'The processing of personal data (site visitors, prospects, platform users, guests) is described in the Privacy policy, which forms an integral part of this notice. Placing non-essential cookies is subject to your prior consent, collected and changeable through the dedicated banner.',
        ],
      },
      {
        heading: '7. Governing law',
        paragraphs: [
          'The site is governed by Moroccan law. This notice is provided in French; in the event of translation, the French version prevails.',
        ],
      },
    ],
  },

  /* ────────────────────────────── PRIVACY POLICY ───────────────────────── */
  {
    slug: 'confidentialite',
    title: 'Privacy policy',
    updated: '24 July 2026',
    intro:
      'This policy describes how 〔Baitly SARL〕 processes personal data, in compliance with Moroccan law no. 09-08 on the protection of individuals with regard to the processing of personal data and, where the processing falls within its territorial scope, with Regulation (EU) 2016/679 (“GDPR”).',
    blocks: [
      {
        heading: '1. Controller and roles',
        paragraphs: [
          'For the data of site visitors, prospects and account holders, 〔Baitly SARL〕 acts as controller.',
          'For the data our clients (property managers, hosts, agencies) import or collect in the platform — in particular their guests’ data (identity, contact details, identity documents for police records, stay and payment data) — Baitly acts as processor within the meaning of article 28 of the GDPR and of law 09-08: the client remains the controller and Baitly processes that data only on their documented instructions. A data processing agreement (DPA) is annexed to the Terms of sale.',
        ],
      },
      {
        heading: '2. Filings with the CNDP',
        paragraphs: [
          'Processing carried out in Morocco is subject to the prior formalities required by the National Commission for the Control of Personal Data Protection (CNDP): filing(s) no. 〔•〕 and, where applicable, authorisation requests for processing subject to them (sensitive data, transfers abroad). The references are kept up to date on this page.',
        ],
      },
      {
        heading: '3. Data processed and purposes',
        table: {
          headers: ['Category', 'Examples of data', 'Purposes', 'Legal basis'],
          rows: [
            ['Site visitors', 'Browsing data, cookies, audience measurement', 'Operating and improving the site, statistics', 'Legitimate interest / consent (non-essential cookies)'],
            ['Prospects', 'Identity, contact details, portfolio size, current tool', 'Answering demo requests, B2B prospecting', 'Pre-contractual measures / legitimate interest'],
            ['Clients & users', 'Identity, contact details, role, login logs, billing', 'Providing the Service, support, billing, security', 'Performance of the contract / legal obligation (accounting)'],
            ['Guests (on behalf of clients)', 'Identity, contact details, identity document (police record), stays, communications', 'Managing bookings, reporting obligations (DGSN, tourist tax), messaging', 'Instructions of the client acting as controller'],
            ['Payment data', 'Transaction references (never full card numbers, which are kept by PCI-DSS certified providers)', 'Collection, refunds, fraud prevention', 'Performance of the contract / legal obligation'],
          ],
        },
      },
      {
        heading: '4. Artificial intelligence features',
        paragraphs: [
          'Some features (agents, suggested replies, document analysis) call on AI models supplied by specialised subprocessors. Data sent to those providers is limited to what the feature strictly requires, is not used by them to train their models under our agreements, and actions with significant effect remain subject to human approval by the client (“human-in-the-loop” operation). A record of automated decisions is kept in the platform (audit log).',
        ],
      },
      {
        heading: '5. Subprocessors and recipients',
        paragraphs: [
          'Data is accessible only to authorised Baitly staff and to our subprocessors, within the limits of their assignments:',
        ],
        list: [
          'Hosting and infrastructure: 〔OVHcloud (EU)〕',
          'Payments: Stripe (EU/United States), CMI / PayZone (Morocco), YouCan Pay (Morocco)',
          'Transactional email: 〔Brevo (EU)〕 · WhatsApp messaging: Meta Platforms (United States)',
          'AI models: 〔Anthropic / other providers listed in the DPA〕',
          'Channel connectivity: Channex (OTA distribution)',
          'Public authorities where the law requires it (DGSN for police records, tax authorities for the tourist tax), on behalf of and on the instructions of the client',
        ],
      },
      {
        heading: '6. International transfers',
        paragraphs: [
          'Where data is transferred outside Morocco, the transfer is carried out in accordance with articles 43 and 44 of law 09-08 (prior CNDP authorisation where required); where data subject to the GDPR is transferred outside the European Economic Area, it is framed by appropriate safeguards (the European Commission’s standard contractual clauses, with supplementary measures where needed). The up-to-date list of transfers is in the DPA.',
        ],
      },
      {
        heading: '7. Retention periods',
        list: [
          'Prospects: 3 years after the last contact.',
          'Client accounts: the term of the contract, then billing data archived for 10 years (accounting obligations).',
          'Guest data processed as a processor: according to the instructions and periods set by the client acting as controller; deletion or return at the end of the contract (reversibility clause of the Terms of sale).',
          'Technical and security logs: 12 months.',
          'Cookies: 13 months maximum; consent sought again beyond that.',
        ],
      },
      {
        heading: '8. Security',
        paragraphs: [
          'Baitly applies appropriate technical and organisational measures: encryption in transit (TLS) and at rest, strict data partitioning per organisation (multi-tenant), role-based access control, authentication through a dedicated identity provider, logging, regular tested backups, periodic penetration tests and documented vulnerability management. Card details never pass through our servers: they are handled by PCI-DSS certified providers.',
          'In the event of a data breach likely to create a risk for individuals, Baitly notifies the competent authority and, where applicable, the clients concerned within the legal deadlines (72 hours under the GDPR), and documents the incident.',
        ],
      },
      {
        heading: '9. Your rights',
        paragraphs: [
          'Under law 09-08 and, where applicable, the GDPR, you have the rights of access, rectification, erasure, objection, restriction and portability of your data, as well as the right to set post-mortem directives and to withdraw your consent at any time.',
          'Exercising your rights: privacy@baitly.ma (answer within 30 days; proof of identity required in the event of reasonable doubt). Guests whose data is processed on behalf of a client are asked to contact their host or manager first, as controller; Baitly forwards without delay any request received directly.',
          'You may lodge a complaint with the CNDP (www.cndp.ma) or, for persons covered by the GDPR, with the supervisory authority of your Member State (in France, the CNIL).',
        ],
      },
      {
        heading: '10. Cookies',
        paragraphs: [
          'The site uses strictly necessary cookies (session, security, consent preferences) which are exempt from consent and, subject to your agreement, audience measurement cookies. No third-party advertising cookie is placed. You may withdraw your consent at any time through the “Manage cookies” link in the footer.',
        ],
      },
      {
        heading: '11. Updates to this policy',
        paragraphs: [
          'This policy may be updated to reflect changes in the Service or in regulations. In the event of a substantial change, account holders are informed by email or in-app notification at least 30 days before it takes effect.',
        ],
      },
    ],
  },

  /* ──────────────────────────── TERMS OF SALE ──────────────────────────── */
  {
    slug: 'cgv',
    title: 'Terms of sale and use',
    updated: '24 July 2026',
    intro:
      'These terms (the “Terms”) govern the subscription to and use of the Baitly platform by professional clients. They prevail over any other document, subject to signed special conditions. Subscribing online or signing an order form constitutes full and unreserved acceptance of them.',
    blocks: [
      {
        heading: 'Article 1 — Definitions',
        list: [
          '“Service”: the Baitly SaaS platform (PMS, channel manager, booking engine, AI agents, modules and add-ons), its documentation and its APIs.',
          '“Client”: any professional (legal entity or individual acting for professional purposes) who has taken out a subscription. The Service is not intended for consumers.',
          '“User”: any individual authorised by the Client to access the Service (employee, provider, instructing owner).',
          '“Client Data”: all data imported into or generated in the Service by or for the Client, including their guests’ data.',
          '“Subscription”: the right to access the Service for a given number of properties and a given plan, on a monthly or yearly term.',
        ],
      },
      {
        heading: 'Article 2 — Purpose and description of the Service',
        paragraphs: [
          'Baitly provides SaaS software for managing short-term rentals: booking and calendar management, synchronisation with distribution platforms, a direct booking engine, collection through third-party payment providers, housekeeping and maintenance operations, invoicing, an owner portal and artificial intelligence assistance features.',
          'The compliance features (police record, tourist tax, invoicing statements) are tools to help the Client meet their obligations; the Client remains solely responsible for their legal, reporting and tax obligations.',
        ],
      },
      {
        heading: 'Article 3 — Subscription, trial and account',
        paragraphs: [
          'Subscription takes place online or by order form. A free trial may be offered; at its end, access is suspended unless a Subscription is taken out. The Client warrants the accuracy of the information provided (in particular ICE/RC or SIRET, address, billing contact) and keeps it up to date.',
          'The Client is responsible for managing User accounts, for the confidentiality of credentials and for the use made of the Service under their access. Baitly may suspend an access in the event of a proven security risk.',
        ],
      },
      {
        heading: 'Article 4 — Prices, invoicing and payment',
        paragraphs: [
          'Current prices are published on the Pricing page, stated exclusive of tax, per property and per month, according to the plan chosen; add-ons are billed in addition. Prices in dirhams apply to Moroccan invoicing (Moroccan VAT applicable); prices in euros to invoicing from or to the EU under the applicable VAT rules.',
          'Invoicing is monthly or yearly, in advance, by direct debit or card through our payment providers. Invoices are issued electronically, numbered sequentially and deemed accepted in the absence of a reasoned dispute within 15 days.',
          'Any late payment automatically entails, after a formal notice left without effect for 8 days, suspension of access to the Service, immediate payability of the sums due and late payment penalties calculated at the legal rate in force, without prejudice to the fixed recovery indemnity applicable between professionals.',
          'Baitly may revise its prices with 60 days’ notice given by email; the revision applies to the following billing period. In the event of disagreement, the Client may terminate before it takes effect without penalty.',
        ],
      },
      {
        heading: 'Article 5 — Term, termination and reversibility',
        paragraphs: [
          'The monthly Subscription has no commitment and may be terminated at any time with effect at the end of the current period. The yearly Subscription may be terminated at its anniversary with 30 days’ notice; failing that, it renews automatically.',
          'Reversibility: throughout the term of the contract and for 60 days after its end, the Client may export their Client Data in standard formats (CSV/JSON) through the Service’s export functions or on request. After that period, Client Data is deleted from production systems, then from backups as their rotation cycle runs (90 days maximum), except for data whose retention is legally required.',
          'Baitly may terminate automatically in the event of a serious breach not remedied within 15 days of a formal notice (in particular non-payment, unlawful use, breach of security).',
        ],
      },
      {
        heading: 'Article 6 — Obligations and prohibited uses',
        list: [
          'Use the Service in accordance with its purpose, with the applicable laws (in particular tourist accommodation, taxation, data protection) and with the terms of the connected third-party platforms;',
          'Do not attempt to access other organisations’ data, to circumvent security measures, or to carry out penetration tests without written agreement;',
          'Do not resell, sublicense or make the Service available to third parties other than authorised Users;',
          'Do not use the Service for unlawful content or activities, nor to send unsolicited communications in breach of the applicable rules;',
          'Obtain from guests the information and consents required when the Client activates connected equipment (sensors, locks, outdoor cameras).',
        ],
      },
      {
        heading: 'Article 7 — Personal data',
        paragraphs: [
          'Each party undertakes to comply with the applicable regulations. For Client Data containing personal data, Baitly acts as processor under the annexed data processing agreement (DPA), which sets out the subject matter, duration, nature and purposes, categories of data and of data subjects, security obligations, conditions for engaging further subprocessors, assistance and the fate of the data. The Privacy policy supplements this article.',
        ],
      },
      {
        heading: 'Article 8 — AI features and responsibility for decisions',
        paragraphs: [
          'The Service’s AI agents and assistants produce proposals (prices, replies, assignments) based on the available data. Unless the Client expressly activates an automatic mode, those proposals are subject to human approval. The Client retains control of, and responsibility for, the decisions applied; Baitly guarantees traceability (audit log) and configurable safeguards (price bounds, floors, rest periods), but does not guarantee that any particular economic result will be achieved.',
        ],
      },
      {
        heading: 'Article 9 — Service levels and support',
        paragraphs: [
          'Baitly targets monthly Service availability of 99.5%, measured excluding planned maintenance windows notified at least 48 hours in advance and excluding external causes (third-party platform outages, force majeure). The status of the Service and the incident history are published on the Service status page.',
          'Support is available by email and WhatsApp during business hours (Mon.–Fri., 9am–6pm, Rabat time), targeting a first response within 4 business hours (1 business hour for blocking incidents). Custom plans may provide for stronger commitments through special conditions.',
        ],
      },
      {
        heading: 'Article 10 — Warranties and liability',
        paragraphs: [
          'The Service is provided under an obligation of means. Baitly does not warrant the complete absence of errors nor compatibility with undocumented particular needs, and is not responsible for the decisions of third-party platforms (delisting, API changes, OTA account suspension) nor for payment services, whose contractual relationships are direct between the Client and those third parties.',
          'Baitly’s total cumulative liability, on all grounds combined, is capped at the sums actually paid by the Client over the 12 months preceding the triggering event. Indirect damages are excluded (loss of revenue, of custom, of image, of data not attributable to a failure by Baitly to meet its backup obligations). Nothing in these terms excludes liability that cannot be excluded by law.',
        ],
      },
      {
        heading: 'Article 11 — Intellectual property',
        paragraphs: [
          'The Service, its developments and its documentation remain the exclusive property of Baitly. The Client has a personal, non-exclusive and non-transferable right of use for the term of the Subscription. Client Data remains the property of the Client, who grants Baitly a licence limited to the sole purpose of providing the Service. Baitly may exploit aggregated and anonymised data (allowing identification of neither the Client nor individuals) for statistical and improvement purposes, including for its market indicators.',
        ],
      },
      {
        heading: 'Article 12 — Confidentiality',
        paragraphs: [
          'Each party undertakes to preserve the confidentiality of the other party’s non-public information that it learns in connection with the contract, for its term and for 3 years after its end, save where disclosure is legally required.',
        ],
      },
      {
        heading: 'Article 13 — Force majeure',
        paragraphs: [
          'Neither party shall be liable for a failure caused by an event of force majeure as defined by the applicable law and case law. If the event exceeds 30 days, either party may terminate the affected Subscriptions without indemnity.',
        ],
      },
      {
        heading: 'Article 14 — Miscellaneous',
        list: [
          'Subcontracting and assignment: Baitly may engage subprocessors and assign the contract as part of a reorganisation, provided its commitments are maintained; the Client may not assign without written agreement.',
          'Commercial references: unless refused in writing, the Client authorises the mention of their name and logo as a reference.',
          'No waiver, partial invalidity, entire agreement: the usual clauses apply.',
          'Evidence: the Service’s logs and records are authoritative between the parties, save evidence to the contrary.',
        ],
      },
      {
        heading: 'Article 15 — Governing law and jurisdiction',
        paragraphs: [
          'These terms are governed by Moroccan law. Failing an amicable resolution within 30 days of a written notice, any dispute shall fall under the exclusive jurisdiction of the Commercial Court of 〔Casablanca / Marrakech〕, notwithstanding multiple defendants or third-party proceedings. Special conditions may stipulate a different law and forum for clients established in the EU.',
          'These terms are published in French, English and Arabic. In the event of any discrepancy between these versions, the French version prevails.',
        ],
      },
    ],
  },
];

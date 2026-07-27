import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
} from '../../src/components/ui';
import { cn } from '../../src/utils/cn';
import Reveal from '../components/Reveal';

const PLANS = [
  {
    name: 'Essentiel',
    price: '290 MAD',
    unit: '/logement/mois',
    copy: 'Pour démarrer proprement.',
    features: ['PMS & channel manager', 'Booking engine & site', 'Fiche police + taxe de séjour', 'Facturation conforme', 'Support WhatsApp'],
    featured: false,
  },
  {
    name: 'Pro',
    price: '490 MAD',
    unit: '/logement/mois',
    copy: 'Le PMS piloté par les agents.',
    features: ['Tout Essentiel', 'Agents IA (4 agents, HITL)', 'Yield automatique borné', 'Market data par ville', 'Portail propriétaire + e-signature', 'Opérations ménage avec preuve photo'],
    featured: true,
  },
  {
    name: 'Sur mesure',
    price: 'Devis',
    unit: '',
    copy: '50+ logements, groupes.',
    features: ['Multi-organisations', 'SLA & support dédié', 'Migration accompagnée', 'Journal d’audit exportable'],
    featured: false,
  },
];

const ADDONS = [
  { name: 'Objets connectés', copy: 'Serrures, capteurs de bruit, vidéosurveillance.' },
  { name: 'Site de réservation avancé', copy: 'Templates premium + domaine dédié.' },
  { name: 'Messagerie WhatsApp', copy: 'Conversations et alertes via l’API Meta.' },
  { name: 'Market data étendu', copy: 'Comps concurrentiels et rapports de marché.' },
];

const PRICING_FAQ = [
  { q: 'Les prix sont-ils vraiment publics ?', a: 'Oui — en dirhams et en euros, dégressifs par logement. Aucun frais caché, aucune commission sur vos réservations directes.' },
  { q: 'Puis-je payer à la réservation plutôt qu’à l’abonnement ?', a: 'Une option « % par réservation » est à l’étude pour les petits portefeuilles — parlez-en avec nous.' },
  { q: 'Go Siyaha peut-il financer Baitly ?', a: 'Oui : le programme subventionne la digitalisation jusqu’à 90 % pour les établissements éligibles. Nous vous aidons à monter le dossier.' },
  { q: 'Y a-t-il un engagement ?', a: 'Non — mensuel sans engagement, remise sur l’annuel.' },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12 text-center">
          <Reveal>
            <Badge variant="outline">Tarifs</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Des tarifs publics. En dirhams.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Dégressif par logement, sans commission cachée, sans engagement. Aussi disponibles en
              euros.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={(index + 1) as 1 | 2 | 3}>
              <div
                className={cn(
                  'flex h-full flex-col rounded-2xl border p-6',
                  plan.featured
                    ? 'border-primary bg-primary-soft shadow-brand'
                    : 'border-border bg-card',
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                  {plan.featured && <Badge>Recommandé</Badge>}
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">{plan.unit}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.copy}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" /> {feature}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6" variant={plan.featured ? 'default' : 'outline'} asChild>
                  <Link to="/demo">
                    {plan.price === 'Devis' ? 'Parler à l’équipe' : 'Commencer'}
                  </Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4">
          <p className="text-center text-xs text-muted-foreground">
            Éligible Go Siyaha : jusqu'à 90 % de la première année subventionnée.{' '}
            <Link to="/demo" className="font-medium text-foreground underline">
              Vérifier mon éligibilité
            </Link>
          </p>
        </Reveal>
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Add-ons à la carte
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Activables à tout moment depuis Paramètres → Abonnement.
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADDONS.map((addon, index) => (
              <Reveal key={addon.name} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{addon.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{addon.copy}</p>
                  <p className="mt-3 text-xs">
                    <span className="font-semibold tabular-nums">—</span>
                    <span className="text-muted-foreground"> /mois · </span>
                    <Badge variant="outline">À définir</Badge>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
            Questions sur les tarifs
          </h2>
        </Reveal>
        <Accordion type="single" collapsible className="w-full">
          {PRICING_FAQ.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Reveal className="mt-8 text-center">
          <Button size="lg" asChild>
            <Link to="/demo">
              Réserver une démo <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}

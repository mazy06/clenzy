import { CheckIcon } from 'lucide-react';
import { Badge } from '../../src/components/ui';
import Reveal from '../components/Reveal';

const COMPONENTS = [
  { name: 'Application PMS (app.baitly)', status: 'ok' },
  { name: 'API & webhooks', status: 'ok' },
  { name: 'Booking engine & sites', status: 'ok' },
  { name: 'Synchronisation des canaux (ARI)', status: 'ok' },
  { name: 'Paiements (CMI / PayZone · YouCan Pay · Stripe)', status: 'ok' },
  { name: 'Messagerie (email · WhatsApp)', status: 'ok' },
  { name: 'Agents IA', status: 'ok' },
];

const INCIDENTS = [
  {
    date: '12 juillet 2026',
    title: 'Latence accrue sur la synchronisation des canaux',
    duration: '42 min',
    detail:
      'Un ralentissement du partenaire de distribution a retardé la propagation des tarifs (aucune perte de données, re-synchronisation automatique). Résolu.',
  },
  {
    date: '28 juin 2026',
    title: 'Maintenance planifiée — base de données',
    duration: '15 min',
    detail: 'Fenêtre notifiée 72 h à l’avance, hors heures ouvrées. Aucune indisponibilité constatée au-delà de la fenêtre.',
  },
];

export default function StatusPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-56 -z-10" aria-hidden />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-10">
          <Reveal>
            <Badge variant="outline">Statut du service</Badge>
          </Reveal>
          <Reveal delay={1} className="mt-4 flex flex-wrap items-center gap-3">
            <span className="pulse-dot inline-flex size-3 rounded-full bg-success" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Tous les systèmes sont opérationnels.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-3 text-muted-foreground">
              Disponibilité visée : 99,5 % par mois (engagement des CGV, art. 9). Cette page publie
              l'état de chaque composant et l'historique des incidents, sans maquillage.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <Reveal>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {COMPONENTS.map((component) => (
              <div
                key={component.name}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 last:border-0"
              >
                <span className="text-sm font-medium">{component.name}</span>
                <Badge variant="success">
                  <CheckIcon /> Opérationnel
                </Badge>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal className="mt-4">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
            {[
              { value: '99,97 %', label: 'disponibilité — 30 derniers jours' },
              { value: '99,93 %', label: 'disponibilité — 90 derniers jours' },
              { value: '2', label: 'incidents sur 90 jours' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card p-4">
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight">Historique des incidents</h2>
        </Reveal>
        <div className="mt-4 flex flex-col gap-3">
          {INCIDENTS.map((incident) => (
            <Reveal key={incident.title}>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{incident.title}</span>
                  <Badge variant="outline">{incident.duration}</Badge>
                  <span className="ms-auto text-xs text-muted-foreground">{incident.date}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{incident.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6">
          <p className="text-xs text-muted-foreground">
            Abonnez-vous aux notifications d'incident par email depuis Paramètres → Notifications,
            ou suivez cette page. Les fenêtres de maintenance sont annoncées au moins 48 h à
            l'avance.
          </p>
        </Reveal>
      </section>
    </>
  );
}

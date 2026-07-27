import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, DatabaseIcon, FileSpreadsheetIcon, GlobeIcon, PlugIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';

const IMPORT_CHANNELS = [
  { icon: GlobeIcon, name: 'Extranets Airbnb / Booking', copy: 'CSV « Historique des transactions » et XLS « Réservations », reconnus tels quels.', tag: 'Le plus courant' },
  { icon: FileSpreadsheetIcon, name: 'Export de votre ancien PMS', copy: 'Mapping pré-câblé : Superhote, Smoobu, Guesty, Hostaway, Beds24, OwnerRez…', tag: null },
  { icon: PlugIcon, name: 'Connexion API directe', copy: 'Beds24, OwnerRez, Smoobu, Hostaway, iGMS, Tokeet, Smily — une clé et tout arrive.', tag: null },
  { icon: DatabaseIcon, name: 'Votre Excel maison', copy: 'Modèle Baitly + écran de mapping des colonnes.', tag: null },
];

const STEPS = [
  { title: 'Exportez avant de résilier', copy: 'Aucun PMS ne rend vos données après la coupure. Nous vous donnons la checklist exacte pour votre outil.' },
  { title: 'Importez votre historique', copy: 'Logements, réservations passées (2-3 ans) et voyageurs — dédupliqués par code de confirmation, sans déclencher d’automatisation.' },
  { title: 'Connectez vos canaux', copy: 'Le claim de vos annonces conserve avis et note ; les réservations futures arrivent automatiquement par l’API.' },
  { title: 'Basculez sans trou', copy: 'Filet iCal pendant la transition — vos calendriers restent bloqués pendant le re-mapping.' },
];

const GUARANTEES = [
  'Historique de 2 à 3 ans importé — vos rapports et votre yield sont nourris dès le premier jour',
  'Aucune automatisation déclenchée sur les données importées',
  'Avis et notes conservés sur vos annonces au moment du claim',
  'Accompagnement humain inclus, en français ou en darija',
];

export default function MigrationPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12">
          <Reveal>
            <Badge variant="outline">Migration</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Changez de PMS sans rien perdre.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Que vous veniez d'un autre logiciel ou d'Excel + WhatsApp, l'import Baitly récupère
              votre historique — et personne d'autre ne le fait en self-service.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <Reveal>
          <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
            Quatre façons d'importer vos données
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {IMPORT_CHANNELS.map((channel, index) => (
            <Reveal key={channel.name} delay={((index % 2) + 1) as 1 | 2}>
              <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <channel.icon className="size-4.5" />
                  </span>
                  <h3 className="text-sm font-semibold">{channel.name}</h3>
                  {channel.tag && (
                    <Badge variant="success" className="ms-auto">
                      {channel.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{channel.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              La bascule, en quatre étapes
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="relative">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="site-shell py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Ce que nous garantissons
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {GUARANTEES.map((guarantee) => (
                <li key={guarantee} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckIcon className="size-3" />
                  </span>
                  {guarantee}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={2}>
            <div className="rounded-2xl bg-foreground p-8 text-background">
              <h3 className="text-lg font-semibold">Et ce que personne ne peut migrer</h3>
              <p className="mt-2 text-sm text-background/70">
                L'historique de messages et les avis ne s'exportent d'aucun outil — nous préférons
                vous le dire ici que vous le laisser découvrir. Vos avis restent attachés à vos
                annonces sur les plateformes.
              </p>
              <Button variant="secondary" className="mt-5" asChild>
                <Link to="/demo">
                  Planifier ma migration <ArrowRightIcon />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

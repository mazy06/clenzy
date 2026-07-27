import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, MinusIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';

const COMPETITORS = [
  { name: 'Baitly vs Superhote', copy: 'Le leader français des conciergeries — sans agents IA HITL ni conformité Maroc.' },
  { name: 'Baitly vs Guesty', copy: 'L’enterprise américain — puissant, mais au prix et à la complexité d’un enterprise.' },
  { name: 'Baitly vs Hostaway', copy: '« AI PMS » revendiqué, pricing opaque, pas d’ancrage local.' },
  { name: 'Baitly vs Lodgify', copy: 'Fort sur le site direct, léger sur les opérations terrain.' },
  { name: 'Baitly vs Nozoul', copy: 'Le local marocain — fiche police oui, mais ni agents IA, ni booking engine, ni yield.' },
  { name: 'Baitly vs Excel + WhatsApp', copy: 'Votre organisation actuelle, sans les nuits blanches.' },
];

const MATRIX: Array<{ label: string; baitly: boolean; intl: boolean; local: boolean }> = [
  { label: 'Agents IA avec validation humaine (HITL)', baitly: true, intl: false, local: false },
  { label: 'Fiche police DGSN + taxe de séjour', baitly: true, intl: false, local: true },
  { label: 'Encaissement MAD (CMI/PayZone, YouCan Pay)', baitly: true, intl: false, local: false },
  { label: 'Yield automatique borné + market data', baitly: true, intl: true, local: false },
  { label: 'Booking engine + galerie de templates', baitly: true, intl: true, local: false },
  { label: 'Tarifs publics en dirhams', baitly: true, intl: false, local: false },
  { label: 'Import self-service depuis votre ancien outil', baitly: true, intl: false, local: false },
];

function Mark({ on }: { on: boolean }) {
  return on ? (
    <CheckIcon className="mx-auto size-4 text-success" />
  ) : (
    <MinusIcon className="mx-auto size-4 text-muted-foreground/50" />
  );
}

export default function ComparePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12">
          <Reveal>
            <Badge variant="outline">Comparer</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Comparez honnêtement. Choisissez sereinement.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Chaque outil a ses forces — nous les citons. Voici où Baitly est structurellement
              différent, et pour qui.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse bg-card text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th className="p-4 text-start font-medium text-muted-foreground">Capacité</th>
                  <th className="p-4 font-semibold">Baitly</th>
                  <th className="p-4 font-medium text-muted-foreground">PMS internationaux</th>
                  <th className="p-4 font-medium text-muted-foreground">Outils locaux</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="p-4">{row.label}</td>
                    <td className="p-4 text-center">
                      <Mark on={row.baitly} />
                    </td>
                    <td className="p-4 text-center">
                      <Mark on={row.intl} />
                    </td>
                    <td className="p-4 text-center">
                      <Mark on={row.local} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal className="mt-2">
          <p className="text-xs text-muted-foreground">
            « PMS internationaux » : Guesty, Hostaway, Lodgify, Smoobu… · « Outils locaux » :
            Nozoul, Kiraty, gestion via extranets + Excel.
          </p>
        </Reveal>
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Les comparatifs détaillés
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pages en cours de rédaction — chacune avec ses concessions honnêtes.
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITORS.map((competitor, index) => (
              <Reveal key={competitor.name} delay={((index % 3) + 1) as 1 | 2 | 3}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-5">
                  <h3 className="text-sm font-semibold">{competitor.name}</h3>
                  <p className="flex-1 text-xs text-muted-foreground">{competitor.copy}</p>
                  <Badge variant="outline" className="self-start">
                    Bientôt
                  </Badge>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Le plus simple : voyez-le tourner.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            30 minutes sur vos propres logements valent mieux que tous les tableaux comparatifs.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link to="/demo">
              Réserver une démo <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}

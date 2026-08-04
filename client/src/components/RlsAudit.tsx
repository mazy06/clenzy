import React from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Layers, Clock, Check, Info, TriangleAlert, CircleAlert } from 'lucide-react';
import { rlsAuditApi } from '../services/api/rlsAuditApi';
import type { RlsAuditFinding } from '../services/api/rlsAuditApi';
import StatTile from './StatTile';
import EmptyState from './EmptyState';

/** Palette validee du projet (l'API StatTile attend un hex). */
const VERT = '#4A9B8E';
const AMBRE = '#D4A574';
const ROUGE = '#C97A7A';
const BLEU = '#7BA3C2';

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const joursDepuis = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * Inventaire des chemins echappant a la Row-Level Security — audit securite 2026-07-26,
 * plan REM-T-01.
 *
 * Remplace un releve manuel qu'il fallait penser a lancer. L'ecran repond a une seule
 * question : peut-on activer la RLS sans vider les ecrans ?
 */
const RlsAudit: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['rls-audit'],
    queryFn: rlsAuditApi.etat,
    refetchInterval: 60_000,
  });

  const marquerTraite = useMutation({
    mutationFn: rlsAuditApi.marquerTraite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rls-audit'] }),
  });

  if (error) {
    // Distinguer les causes : un message unique ferait chercher au mauvais endroit.
    // Un 404 signifie que le backend ne connait pas encore cette route — cas frequent en
    // developpement, ou le front recharge a chaud pendant que le serveur tourne un build
    // anterieur.
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Backend non a jour</AlertTitle>
          <AlertDescription>
            Cette instance ne connait pas encore l'endpoint <code>/api/admin/rls-audit</code>.
            Le front a ete recharge a chaud, mais le serveur tourne un build anterieur —
            le reconstruire et le relancer.
          </AlertDescription>
        </Alert>
      );
    }
    if (status === 403) {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Acces reserve</AlertTitle>
          <AlertDescription>
            Cet inventaire designe du code et sert une decision d'infrastructure : il est
            reserve au personnel plateforme (SUPER_ADMIN ou SUPER_MANAGER).
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Inventaire indisponible</AlertTitle>
        <AlertDescription>
          {(error as { message?: string }).message ?? 'Erreur inattendue lors du chargement.'}
        </AlertDescription>
      </Alert>
    );
  }

  const enAttente = data?.enAttente ?? 0;
  const ouverts = data?.chemins.filter((c) => !c.resolvedAt) ?? [];
  const traites = data?.chemins.filter((c) => c.resolvedAt) ?? [];
  const plusAncien = ouverts.length
    ? ouverts.reduce((a, b) => (a.firstSeenAt < b.firstSeenAt ? a : b))
    : null;

  return (
    <div>
      {/* Le drapeau le plus important de l'ecran : sans lui, on lirait un inventaire
          trompeur comme un vrai constat. */}
      {data && data.auditActif && !data.mesureExploitable && (
        <Alert variant="destructive" className="mb-[18px]">
          <CircleAlert />
          <AlertTitle>Cet inventaire est sans valeur</AlertTitle>
          <AlertDescription>
            L'instrumentation tourne, mais l'aspect qui pose le contexte tenant est inactif
            (<code>clenzy.security.rls.enabled=false</code>). Toutes les requetes sont donc
            signalees, pas seulement les chemins a risque — et un inventaire vide ne
            signifierait rien non plus. Poser ce parametre a <code>true</code> : sans risque
            tant que la RLS n'est pas appliquee en base, puisque aucune politique ne lit ces
            valeurs.
          </AlertDescription>
        </Alert>
      )}

      {data && !data.auditActif && (
        <Alert variant="info" className="mb-[18px]">
          <Info />
          <AlertTitle>Mesure a l'arret</AlertTitle>
          <AlertDescription>
            L'instrumentation est desactivee. Les chemins ci-dessous datent de la derniere
            campagne ; aucun nouveau constat n'est enregistre.
          </AlertDescription>
        </Alert>
      )}

      {data?.sature && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>Inventaire incomplet</AlertTitle>
          <AlertDescription>
            Le tampon a atteint son plafond : de nouveaux chemins ne sont plus enregistres.
            Traiter ceux deja remontes avant de poursuivre la mesure — d'ici la, l'absence de
            nouveaux constats ne prouve rien.
          </AlertDescription>
        </Alert>
      )}

      {data?.rlsDejaActive && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>La RLS est deja active</AlertTitle>
          <AlertDescription>
            Les chemins listes ci-dessous ne renvoient plus zero ligne « en cas d'activation » :
            ils le font <strong>deja</strong>. A traiter en priorite.
          </AlertDescription>
        </Alert>
      )}

      {enAttente > 0 && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>{enAttente} constat(s) en attente d'ecriture</AlertTitle>
          <AlertDescription>
            Des chemins viennent d'etre detectes mais ne sont pas encore enregistres — le
            vidage a lieu toutes les 5 minutes. Ils apparaitront ci-dessous au prochain
            passage. D'ici la, ne pas lire cet ecran comme « aucun chemin a traiter ».
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-12 gap-3 mb-[18px]">
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={ouverts.length === 0 ? <ShieldCheck /> : <ShieldAlert />}
            label="Chemins a traiter"
            value={isLoading ? '—' : ouverts.length + enAttente}
            color={ouverts.length + enAttente === 0 ? VERT : ROUGE}
            loading={isLoading}
            hint={
              ouverts.length + enAttente === 0
                ? 'Condition d’activation remplie'
                : enAttente > 0 && ouverts.length === 0
                  ? `${enAttente} constat(s) detecte(s), pas encore ecrit(s)`
                  : 'La RLS ne peut pas etre activee'
            }
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Check />}
            label="Chemins traites"
            value={isLoading ? '—' : traites.length}
            color={VERT}
            loading={isLoading}
            hint="Conserves : une reapparition serait visible"
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Clock />}
            label="Plus ancien constat"
            value={plusAncien ? `${joursDepuis(plusAncien.firstSeenAt)} j` : '—'}
            color={AMBRE}
            loading={isLoading}
            hint="Anciennete du plus vieux chemin ouvert"
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Layers />}
            label="En attente d'ecriture"
            value={isLoading ? '—' : enAttente}
            color={BLEU}
            loading={isLoading}
            hint="Vidage automatique toutes les 5 min"
          />
        </div>
      </div>

      <Card>
        <CardContent>
          <h6 className="cn-text-h6 text-[var(--ink)] mb-0.5">
            Chemins sans contexte tenant
          </h6>
          <p className="cn-text-body2 text-[var(--ink-muted)] mb-3">
            Une fois la RLS active, ces requetes renverront zero ligne — sans lever
            d'erreur. Le nombre d'occurrences indique l'urgence : un chemin tres emprunte
            casserait plus d'ecrans qu'un chemin marginal.
          </p>

          {!isLoading && ouverts.length === 0 && traites.length === 0 && enAttente === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title="Aucun chemin detecte"
              description={
                data?.mesureExploitable
                  ? 'Aucune requete ne s’execute sans contexte tenant depuis le debut de la mesure. Laisser courir un cycle d’usage complet — fins de mois, exports, taches planifiees — avant d’en conclure que la RLS peut etre activee.'
                  : 'La mesure n’est pas exploitable en l’etat : ce vide ne prouve rien.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origine</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-end">Occurrences</TableHead>
                    <TableHead>Premier constat</TableHead>
                    <TableHead>Dernier constat</TableHead>
                    <TableHead className="text-end">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...ouverts, ...traites].map((chemin: RlsAuditFinding) => {
                    const reapparu =
                      chemin.resolvedAt !== null && chemin.lastSeenAt > chemin.resolvedAt;
                    return (
                      <TableRow key={chemin.id}>
                        <TableCell className="font-mono text-[0.8125rem]">
                          {/* Sans extrait SQL il n'y a rien a survoler : le Tooltip du kit
                              afficherait une bulle vide la ou MUI n'en montrait aucune. */}
                          {chemin.sqlExcerpt ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{chemin.origin}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start">
                                {chemin.sqlExcerpt}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>{chemin.origin}</span>
                          )}
                          {reapparu && (
                            <Badge variant="secondary" className="ms-1.5 bg-[var(--warn-soft)] text-[var(--warn)]">reapparu apres correction</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{chemin.tableName}</Badge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {chemin.occurrences.toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {dateCourte(chemin.firstSeenAt)}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {dateCourte(chemin.lastSeenAt)}
                        </TableCell>
                        <TableCell className="text-end">
                          {chemin.resolvedAt && !reapparu ? (
                            <Badge variant="secondary" className="bg-[var(--ok-soft)] text-[var(--ok)]">traite</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={marquerTraite.isPending}
                              onClick={() => marquerTraite.mutate(chemin.id)}
                            >
                              Marquer traite
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RlsAudit;

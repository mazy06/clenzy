import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import { GppGood } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { frRegulatoryApi, type FrComplianceOverviewRow } from '../../services/api/frRegulatoryApi';

type Tone = 'secondary' | 'destructive' | 'outline';

/**
 * Réglages › Fiscal — synthèse « Conformité France » : pour chaque logement situé en
 * France, l'état des obligations que la landing promet (numéro d'enregistrement, plafond
 * de nuitées, fiche de police, barème de taxe de séjour). Chaque ligne mène à l'onglet
 * Conformité du logement, où tout se corrige. Masquée sans logement en France.
 */
export default function FrComplianceOverviewSection() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<FrComplianceOverviewRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    frRegulatoryApi.overview()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) {
    return <div className="flex justify-center py-6"><Spinner className="size-6" /></div>;
  }
  if (rows.length === 0) return null;

  const chip = (tone: Tone, key: string, fallback: string) => (
    <Badge variant={tone}>{t(key, fallback)}</Badge>
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <GppGood size={18} strokeWidth={1.75} className="text-muted-foreground" />
        <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
          {t('frCompliance.title', 'Conformité France')}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('frCompliance.property', 'Logement')}</TableHead>
              <TableHead>{t('frCompliance.registration', 'N° d’enregistrement')}</TableHead>
              <TableHead>{t('frCompliance.nightsCap', 'Plafond de nuitées')}</TableHead>
              <TableHead>{t('frCompliance.policeForm', 'Fiche de police')}</TableHead>
              <TableHead>{t('frCompliance.touristTax', 'Taxe de séjour')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ propertyId, propertyName, profile, touristTaxConfigured }) => (
              <TableRow key={propertyId}>
                <TableCell>
                  <Link to={`/properties/${propertyId}?tab=compliance`} className="font-medium text-foreground hover:underline">
                    {propertyName ?? `#${propertyId}`}
                  </Link>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {profile.communeInseeCode
                      ? `INSEE ${profile.communeInseeCode}`
                      : t('frCompliance.communeUnresolved', 'Commune introuvable — vérifier l’adresse')}
                  </span>
                </TableCell>
                <TableCell>
                  {!profile.registrationRequired
                    ? chip('outline', 'frCompliance.notRequired', 'Non requis')
                    : profile.registrationVerdict === 'VALID'
                      ? chip('secondary', 'frCompliance.ok', 'Conforme')
                      : profile.registrationVerdict === 'ABSENT'
                        ? chip('destructive', 'frCompliance.missing', 'Manquant')
                        : chip('destructive', 'frCompliance.toFix', 'À corriger')}
                </TableCell>
                <TableCell className="tabular-nums">
                  {!profile.nightsCapEnabled
                    ? chip('outline', 'frCompliance.noCap', 'Sans plafond')
                    : (
                      <Badge variant={profile.nightsRemainingThisYear > 0 ? 'secondary' : 'destructive'}>
                        {profile.nightsRentedThisYear} / {profile.maxNightsPerYear}
                      </Badge>
                    )}
                </TableCell>
                <TableCell>
                  {profile.policeFormEnabled
                    ? chip('secondary', 'frCompliance.active', 'Active')
                    : chip('destructive', 'frCompliance.inactive', 'Inactive')}
                </TableCell>
                <TableCell>
                  {touristTaxConfigured
                    ? chip('secondary', 'frCompliance.configured', 'Barème défini')
                    : chip('destructive', 'frCompliance.noBareme', 'Sans barème')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

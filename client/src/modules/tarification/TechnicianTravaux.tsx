import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '../../components/ui';
import { InputGroup, InputGroupAddon, InputGroupInput, Switch } from '../../components/ui';
import { Save, Build } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import PageHeader from '../../components/PageHeader';
import { technicianPrestationsApi } from '../../services/api/technicianPrestationsApi';
import type { ServicePriceConfig } from '../../services/api/pricingConfigApi';

/**
 * Écran « Mes tarifs travaux » du technicien : le catalogue org (services actifs)
 * est PRÉ-LISTÉ, le technicien coche ce qu'il propose et fixe SON prix. Sa
 * surcouche (org + user, côté serveur) n'est visible que de lui.
 */
interface Row {
  interventionType: string;
  label: string;
  domain: string;
  offered: boolean;
  price: number;
}

export default function TechnicianTravaux() {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const { notify } = useNotification();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const otherDomain = t('tarification.travaux.otherDomain', 'Autre');

  const merge = useCallback((catalogue: ServicePriceConfig[], mine: ServicePriceConfig[]): Row[] => {
    const catalogueTypes = new Set(catalogue.map((c) => c.interventionType));
    const mineByType = new Map(mine.map((m) => [m.interventionType, m]));
    const list: Row[] = catalogue.map((c) => {
      const m = mineByType.get(c.interventionType);
      return {
        interventionType: c.interventionType,
        label: c.label || c.interventionType,
        domain: c.domain || otherDomain,
        offered: !!m?.enabled,
        price: m?.basePrice ?? 0,
      };
    });
    // Prestations propres hors catalogue (services personnalisés ou désactivés côté org).
    for (const m of mine) {
      if (!catalogueTypes.has(m.interventionType)) {
        list.push({
          interventionType: m.interventionType,
          label: m.label || m.interventionType,
          domain: m.domain || otherDomain,
          offered: !!m.enabled,
          price: m.basePrice ?? 0,
        });
      }
    }
    return list;
  }, [otherDomain]);

  useEffect(() => {
    Promise.all([
      technicianPrestationsApi.catalogue().catch(() => [] as ServicePriceConfig[]),
      technicianPrestationsApi.getMine().catch(() => [] as ServicePriceConfig[]),
    ])
      .then(([catalogue, mine]) => setRows(merge(catalogue, mine)))
      .finally(() => setLoading(false));
  }, [merge]);

  const updateRow = useCallback((index: number, partial: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  }, []);

  // Groupement par domaine, en conservant l'index d'origine pour l'édition.
  const grouped = useMemo(() => {
    const map = new Map<string, { row: Row; index: number }[]>();
    rows.forEach((row, index) => {
      if (!map.has(row.domain)) map.set(row.domain, []);
      map.get(row.domain)!.push({ row, index });
    });
    return Array.from(map.entries());
  }, [rows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ServicePriceConfig[] = rows.flatMap((r) =>
        r.offered ? [{ interventionType: r.interventionType, basePrice: r.price, enabled: true }] : [],
      );
      const saved = await technicianPrestationsApi.updateMine(payload);
      // Re-merge avec le catalogue courant pour rester pré-listé.
      const catalogue = await technicianPrestationsApi.catalogue().catch(() => [] as ServicePriceConfig[]);
      setRows(merge(catalogue, saved));
      notify.success(t('tarification.saveSuccess', 'Enregistré'));
    } catch {
      notify.error(t('tarification.saveError', "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('technicianPrestations.title', 'Mes tarifs travaux')}
        subtitle={t('technicianPrestations.subtitle', 'Cochez les prestations que vous proposez et fixez vos prix — visibles de vous seul.')}
        iconBadge={<Build />}
        backPath="/dashboard"
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : <Save />}
            {t('tarification.save', 'Enregistrer')}
          </Button>
        }
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tarification.travaux.prestation', 'Prestation')}</TableHead>
              <TableHead className="text-center">{t('technicianPrestations.offered', 'Je propose')}</TableHead>
              <TableHead className="text-end">{t('technicianPrestations.myPrice', 'Mon prix')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(([domain, entries]) => (
              <React.Fragment key={domain}>
                <TableRow>
                  <TableCell colSpan={3} className="py-[4.5px] bg-[var(--field)]">
                    <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
                      {domain}
                    </p>
                  </TableCell>
                </TableRow>
                {entries.map(({ row, index }) => (
                  <TableRow key={row.interventionType}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        aria-label={row.label}
                        checked={row.offered}
                        onCheckedChange={(checked) => updateRow(index, { offered: checked })}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-end w-[140px]">
                      {/* Pas de libelle propre : l'entete de colonne « Mon prix »
                          nomme la saisie, d'ou l'aria-label porte par le champ. */}
                      <InputGroup className="w-[120px] ms-auto">
                        <InputGroupInput
                          id={`technician-price-${row.interventionType}`}
                          type="number"
                          step={1}
                          min={0}
                          className="text-end"
                          aria-label={row.label}
                          value={row.price}
                          onChange={(e) => {
                            const num = parseFloat(e.target.value);
                            if (!isNaN(num)) updateRow(index, { price: num });
                          }}
                          disabled={!row.offered}
                        />
                        <InputGroupAddon align="inline-end">
                          <CurrencySymbol code={currency} />
                        </InputGroupAddon>
                      </InputGroup>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  NativeSelect,
  Textarea,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Add, Percent, LocalOffer, Refresh, CheckCircle, TrendingUp } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useNotification } from '../../hooks/useNotification';
import StatTile from '../../components/baitly/StatTile';
import EmptyState from '../../components/EmptyState';
import {
  promoCodesApi,
  type PromoCode,
  type PromoCodeCreatePayload,
} from '../../services/api/promoCodesApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterMode = 'active' | 'inactive' | 'expired' | 'all';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return DATE_TIME_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

function isExpired(promo: PromoCode): boolean {
  if (!promo.validUntil) return false;
  return new Date(promo.validUntil).getTime() < Date.now();
}

function discountLabel(promo: PromoCode): string {
  if (promo.discountType === 'PERCENTAGE') {
    return `-${promo.discountValue}%`;
  }
  return `-${(promo.discountValue / 100).toFixed(2).replace('.', ',')}€`;
}

function usageLabel(promo: PromoCode): string {
  if (promo.maxUses === null) {
    return `${promo.usedCount} / ∞`;
  }
  return `${promo.usedCount} / ${promo.maxUses}`;
}

// ─── Modal de creation ────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateCodeDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: PromoCodeCreatePayload) => promoCodesApi.create(payload),
    onSuccess: () => {
      onCreated();
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la création du code.');
    },
  });

  const handleClose = () => {
    setCode('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('');
    setMaxUses('');
    setValidFrom('');
    setValidUntil('');
    setDescription('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    if (!code.trim()) {
      setError('Le code est requis.');
      return;
    }
    const valueNum = parseInt(discountValue, 10);
    if (isNaN(valueNum) || valueNum <= 0) {
      setError('La valeur de réduction doit être un entier positif.');
      return;
    }
    if (discountType === 'PERCENTAGE' && (valueNum < 1 || valueNum > 100)) {
      setError('Un pourcentage doit être entre 1 et 100.');
      return;
    }
    const payload: PromoCodeCreatePayload = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: valueNum,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
      validFrom: validFrom ? `${validFrom}T00:00:00` : null,
      validUntil: validUntil ? `${validUntil}T23:59:59` : null,
      description: description.trim() || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      {/* `aria-describedby={undefined}` : la modale n'a pas de texte descriptif. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex flex-row items-center gap-1.5 pe-8">
            <Add size={20} strokeWidth={1.75} />
            Nouveau code promo
          </DialogTitle>
        </DialogHeader>
        {/* Le contenu de la modale du kit ne defile pas de lui-meme : ce
            formulaire est long, on lui donne sa propre zone de defilement. */}
        <div className="flex flex-col gap-3 max-h-[65vh] overflow-y-auto -mx-0.5 px-0.5">
          {error && (
            <BuiAlert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
                  <X />
                </BuiButton>
              </AlertAction>
            </BuiAlert>
          )}

          <Field>
            <FieldLabel htmlFor="promo-code">Code *</FieldLabel>
            <Input
              id="promo-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME2026"
              maxLength={50}
              className="uppercase"
              autoFocus
            />
            <FieldDescription>Sera normalisé en majuscules</FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="promo-discount-type">Type de réduction *</FieldLabel>
              <NativeSelect
                id="promo-discount-type"
                className="w-full"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
              >
                <option value="PERCENTAGE">Pourcentage (%)</option>
                <option value="FIXED">Montant fixe (€)</option>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="promo-discount-value">
                {discountType === 'PERCENTAGE' ? 'Pourcentage *' : 'Montant en centimes *'}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="promo-discount-value"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={discountType === 'PERCENTAGE' ? '30' : '500'}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{discountType === 'PERCENTAGE' ? '%' : 'centimes'}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {discountType === 'PERCENTAGE' ? 'Entre 1 et 100' : 'Centimes (500 = 5,00€)'}
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="promo-max-uses">Nombre maximum d'utilisations</FieldLabel>
            <Input
              id="promo-max-uses"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Laisser vide pour illimité"
            />
            <FieldDescription>Vide = utilisations illimitées</FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="promo-valid-from">Valide à partir du</FieldLabel>
              <Input
                id="promo-valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
              <FieldDescription>Optionnel</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="promo-valid-until">Valide jusqu'au</FieldLabel>
              <Input
                id="promo-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              <FieldDescription>Optionnel</FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="promo-description">Description (interne)</FieldLabel>
            <Textarea
              id="promo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : campagne lancement Q3 2026"
              rows={2}
              maxLength={255}
            />
          </Field>
        </div>
        <DialogFooter>
          <BuiButton variant="ghost" onClick={handleClose} disabled={createMutation.isPending}>
            Annuler
          </BuiButton>
          <BuiButton onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Spinner className="size-4" /> : <Add />}
            Créer
          </BuiButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { notify } = useNotification();

  const {
    data: promoCodes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['promoCodes', 'list'],
    queryFn: () => promoCodesApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: number; activate: boolean }) =>
      activate ? promoCodesApi.activate(id) : promoCodesApi.deactivate(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] });
      notify.success(variables.activate ? 'Code activé.' : 'Code désactivé.');
    },
    onError: () => {
      notify.error('Erreur lors de la modification du code.');
    },
  });

  // Filtrage
  const filtered = useMemo(() => {
    if (!promoCodes) return [];
    return promoCodes.filter((p) => {
      const expired = isExpired(p);
      switch (filterMode) {
        case 'active':
          return p.active && !expired;
        case 'inactive':
          return !p.active;
        case 'expired':
          return expired;
        case 'all':
        default:
          return true;
      }
    });
  }, [promoCodes, filterMode]);

  // KPIs
  const stats = useMemo(() => {
    if (!promoCodes) return null;
    const active = promoCodes.filter((p) => p.active && !isExpired(p)).length;
    const totalUses = promoCodes.reduce((s, p) => s + p.usedCount, 0);
    const topUsed = [...promoCodes].sort((a, b) => b.usedCount - a.usedCount)[0];
    return { total: promoCodes.length, active, totalUses, topUsed };
  }, [promoCodes]);

  return (
    <div>
      <PageHeader
        title="Codes promo"
        subtitle="Gestion centralisée des codes promo / cooptation utilisés à l'inscription"
        iconBadge={<LocalOffer />}
        showBackButton={false}
        actions={
          <div className="flex gap-1.5">
            <BuiButton
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] })}
              disabled={isLoading}
            >
              <Refresh />
              Rafraîchir
            </BuiButton>
            <BuiButton onClick={() => setCreateOpen(true)}>
              <Add />
              Créer un code
            </BuiButton>
          </div>
        }
      />

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-3 mb-[18px]">
          <StatTile icon={<LocalOffer />} label="Total" value={stats.total} iconClassName="text-primary" />
          <StatTile icon={<CheckCircle />} label="Actifs" value={stats.active} iconClassName="text-success" />
          <StatTile icon={<Percent />} label="Utilisations totales" value={stats.totalUses} iconClassName="text-info" />
          <StatTile
            icon={<TrendingUp />}
            label="Top code"
            value={stats.topUsed?.code ?? '—'}
            iconClassName="text-warning"
            hint={stats.topUsed ? `${stats.topUsed.usedCount} usages` : undefined}
          />
        </div>
      )}

      {/* Filtre — segmented du kit (ToggleGroup jointif, variante contour) */}
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filtre
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={filterMode}
          onValueChange={(v) => v && setFilterMode(v as FilterMode)}
        >
          <ToggleGroupItem value="all">Tous ({promoCodes?.length ?? 0})</ToggleGroupItem>
          <ToggleGroupItem value="active">Actifs ({stats?.active ?? 0})</ToggleGroupItem>
          <ToggleGroupItem value="inactive">Inactifs</ToggleGroupItem>
          <ToggleGroupItem value="expired">Expirés</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error && (
        <BuiAlert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>Impossible de charger les codes promo : {(error as Error).message}</AlertDescription>
        </BuiAlert>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LocalOffer />}
          title="Aucun code promo"
          description={
            filterMode !== 'all'
              ? `Aucun code ne correspond au filtre « ${filterMode} ».`
              : 'Créez votre premier code promo avec le bouton « Créer un code ».'
          }
        />
      ) : (
        // `Card` porte le fond, l'arrondi, le filet et l'ecretage ; le
        // defilement horizontal vit dans un conteneur interne.
        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Réduction</TableHead>
                  <TableHead>Utilisations</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((promo) => {
                  const expired = isExpired(promo);
                  return (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">
                          {promo.code}
                        </p>
                      </TableCell>
                      <TableCell>
                        {/* Un code expire se lit comme un code eteint : meme ton neutre qu'un code desactive. */}
                        <StatusChip
                          tone={promo.active && !expired ? 'accent' : 'neutral'}
                          label={discountLabel(promo)}
                          icon={
                            promo.discountType === 'PERCENTAGE' ? (
                              <Percent size={12} strokeWidth={2} />
                            ) : undefined
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <p className="text-xs tabular-nums">
                          {usageLabel(promo)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Du {formatDate(promo.validFrom)}
                        </span>
                        {/* `-ink` et non la teinte vive : c'est du TEXTE. */}
                        <span className={cn('block text-xs tabular-nums', expired ? 'text-destructive-ink font-semibold' : 'text-muted-foreground font-normal')}>
                          Au {formatDate(promo.validUntil)}
                          {expired && ' (expiré)'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {/* line-clamp-2 pose display/-webkit-box-orient/overflow d'un bloc */}
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {promo.description || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(promo.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* Enveloppe : un interrupteur desactive n'emet plus
                                d'evenement de survol, l'infobulle a besoin d'une
                                cible qui en emette. */}
                            <span className="inline-flex">
                              <Switch
                                size="sm"
                                aria-label={promo.active ? 'Désactiver' : 'Activer'}
                                checked={promo.active}
                                disabled={toggleMutation.isPending}
                                onCheckedChange={(checked) =>
                                  toggleMutation.mutate({ id: promo.id, activate: checked })
                                }
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {expired
                              ? "Code expiré — le toggle n'a pas d'effet"
                              : promo.active
                                ? 'Désactiver'
                                : 'Activer'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <CreateCodeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] });
          notify.success('Code promo créé.');
        }}
      />
    </div>
  );
}

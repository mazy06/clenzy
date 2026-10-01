/* ============================================================
   <ActionParamsModal> — montrer ce que l'agent avait deviné

   Famille « décider ». L'agent a choisi une fenêtre, un pourcentage, un nombre
   de nuits au moment du scan, et la carte appliquait ces valeurs telles quelles :
   le bouton disait « Appliquer », jamais quoi.

   La modale les présente pré-remplies — ce que l'agent proposait reste le point
   de départ — avec leurs bornes affichées, celles que le serveur applique de
   toute façon. Les découvrir par un refus serait absurde.

   Le schéma par type vit dans actionRegistry.ts ; ici, il n'y a que le rendu.
   ============================================================ */

import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter, ActionModalFacts, ActionModalSection } from './ActionModal';
import { useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Spinner,
  Switch,
} from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { entryOf, initialValues, type ParamField } from './actionRegistry';
import { ActionDescription } from './ActionDescription';
import { descriptionTitle, parseStockDescription, readActionParams } from '../core/actionDescription';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface ActionParamsModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Confirme : le parent applique la carte avec ces paramètres. */
  onConfirm: (params: Record<string, number | string | boolean>) => void;
}

/** Borne la saisie sans la corriger en douce pendant la frappe. */
function outOfRange(field: ParamField, value: number): boolean {
  if (field.min !== undefined && value < field.min) return true;
  if (field.max !== undefined && value > field.max) return true;
  return false;
}

export function ActionParamsModal({ action, onClose, onConfirm }: ActionParamsModalProps) {
  const { t } = useTranslation();
  const entry = entryOf(action.applyActionType);
  const spec = entry?.params ?? null;

  const isStockOrder = action.applyActionType === 'LINEN_STOCK_ORDER';
  const [values, setValues] = useState<Record<string, number | string | boolean>>(() => {
    const initial = spec ? initialValues(spec, action.actionParams) : {};
    const stock = isStockOrder ? parseStockDescription(action) : null;
    if (stock?.quantity != null && readActionParams(action.actionParams).quantity == null) {
      initial.quantity = stock.quantity;
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [simulation, setSimulation] = useState<string[]>([]);
  const [simulating, setSimulating] = useState(false);
  const simulationRequest = useRef(0);
  const [simulationFailed, setSimulationFailed] = useState(false);

  /**
   * Demande au serveur l'effet des valeurs en cours de saisie.
   *
   * <p>Lecture seule malgré le POST, qu'impose le corps de requête. Un échec
   * n'empêche pas d'appliquer : on efface simplement la prévision plutôt que de
   * laisser affichée une projection qui ne correspond plus.</p>
   */
  const simulate = async () => {
    const request = ++simulationRequest.current;
    setSimulating(true);
    setSimulationFailed(false);
    try {
      const token = getAccessToken();
      const response = await fetch(
        buildApiUrl(`/ai/supervision/suggestions/${action.id}/preview`),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ params: values }),
        },
      );
      const preview = response.ok ? ((await response.json()) as { facts?: string[] }) : null;
      if (request === simulationRequest.current) {
        setSimulation(preview?.facts ?? []);
        setSimulationFailed(!preview);
      }
    } catch {
      if (request === simulationRequest.current) {
        setSimulation([]);
        setSimulationFailed(true);
      }
    } finally {
      if (request === simulationRequest.current) setSimulating(false);
    }
  };

  const invalid = useMemo(() => {
    if (!spec) return true;
    return spec.fields.some((field) => {
      const value = values[field.name];
      if (field.kind === 'integer' || field.kind === 'percent') {
        return typeof value !== 'number' || Number.isNaN(value) || outOfRange(field, value);
      }
      if (field.kind === 'date' || field.kind === 'time' || field.kind === 'text') {
        // Un champ facultatif vide n'interdit pas de valider — la référence
        // d'un dépôt fiscal, par exemple, n'est pas toujours connue.
        return !field.optional && (typeof value !== 'string' || value.trim() === '');
      }
      return false;
    });
  }, [spec, values]);

  // Type hors registre : le parent ne devrait pas nous ouvrir.
  if (!entry || !spec) return null;

  const set = (name: string, value: number | string | boolean) => {
    // A forecast only describes the values that were submitted to it.
    simulationRequest.current++;
    setSimulation([]);
    setSimulating(false);
    setSimulationFailed(false);
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const confirm = () => {
    if (invalid) return;
    setSubmitting(true);
    onConfirm(values);
  };

  const renderField = (field: ParamField) => {
    const value = values[field.name];
    const label = t(field.labelKey, field.labelFallback);
    const hint = field.hintKey ? t(field.hintKey, field.hintFallback ?? '') : null;
    const id = `param-${field.name}`;

    if (field.kind === 'boolean') {
      return (
        <Field key={field.name} orientation="horizontal" data-wide="true">
          <Switch
            id={id}
            checked={Boolean(value)}
            disabled={submitting}
            onCheckedChange={(checked) => set(field.name, checked)}
          />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {hint && <FieldDescription>{hint}</FieldDescription>}
          </div>
        </Field>
      );
    }

    const numeric = field.kind === 'integer' || field.kind === 'percent';
    const bounds =
      numeric && field.min !== undefined && field.max !== undefined
        ? t('supervision.params.range', {
            min: field.min,
            max: field.max,
            defaultValue: 'Entre {{min}} et {{max}}',
          })
        : null;

    return (
      <Field key={field.name} data-wide={field.kind === 'text'}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          type={field.kind === 'date' ? 'date' : field.kind === 'time' ? 'time' : numeric ? 'number' : 'text'}
          value={value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? '' : String(value)}
          disabled={submitting}
          min={field.min}
          max={field.max}
          onChange={(e) =>
            set(field.name, numeric ? (e.target.value === '' ? NaN : Number(e.target.value)) : e.target.value)
          }
          className={numeric ? 'tabular-nums' : undefined}
          aria-invalid={numeric && typeof value === 'number' && (Number.isNaN(value) || outOfRange(field, value))}
          aria-describedby={hint || bounds ? `${id}-hint` : undefined}
        />
        {(hint || bounds) && (
          <FieldDescription id={`${id}-hint`}>{[hint, bounds].filter(Boolean).join(' · ')}</FieldDescription>
        )}
      </Field>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <ActionModalContent className="sm:max-w-[520px]">
        <ActionModalHeader action={action} title={t(entry.titleKey, entry.titleFallback)} description={descriptionTitle(action)} />
        <ActionModalBody>

        <div className="flex flex-col gap-4">
          {isStockOrder && <ActionDescription action={action} stockOrderEditable />}
          <p className="text-sm text-[var(--bui-muted-foreground)] text-pretty">
            {t(spec.leadKey, spec.leadFallback)}
          </p>
          <div className="baitly-action-params">{spec.fields.map(renderField)}</div>

          {/* Effet des valeurs saisies, demandé au serveur. « 7 nuits » ne dit
              rien ; « du 24 au 30 août » si. Repris de l'éditeur tarifaire, qui
              seul offrait de voir avant de s'engager. */}
          {simulation.length > 0 && (
            <ActionModalSection title={t('supervision.modal.simulation', 'Effet des paramètres choisis')}>
              <div aria-live="polite"><ActionModalFacts facts={simulation} /></div>
            </ActionModalSection>
          )}
          {simulationFailed && <p role="status" className="baitly-action-modal-note">
            {t('supervision.price.simError', 'Simulation impossible pour le moment.')}
          </p>}
        </div>

        </ActionModalBody>
        <ActionModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button variant="outline" onClick={simulate} disabled={invalid || simulating || submitting}>
            {simulating && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {t('supervision.params.simulate', 'Simuler')}
          </Button>
          <Button onClick={confirm} disabled={invalid || submitting}>
            {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {t(entry.ctaKey, entry.ctaFallback)}
          </Button>
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}

export default ActionParamsModal;

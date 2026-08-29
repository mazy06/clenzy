import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Spinner,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import StatusChip from '../../components/StatusChip';
import type { StatusTone } from '../../components/StatusChip';
import { Description, UploadFile, DeleteOutline, Preview } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import {
  providerDocumentsApi,
  REQUIRED_PROVIDER_DOCUMENTS,
  type ProviderDocument,
  type ProviderDocumentType,
} from '../../services/api/providerDocumentsApi';

interface Props {
  /** Averti le parcours d'onboarding quand le dossier vient d'etre complete. */
  onFileComplete?: () => void;
}

/** Ordre d'affichage : les trois obligatoires d'abord, l'identite ensuite. */
const DOCUMENT_TYPES: ProviderDocumentType[] = [
  ...REQUIRED_PROVIDER_DOCUMENTS,
  'IDENTITY',
];

const STATUS_TONES: Record<ProviderDocument['status'], StatusTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
};

/**
 * Justificatifs professionnels de l'intervenant.
 *
 * <p>Une conciergerie qui fait travailler des independants doit collecter ces
 * pieces — l'absence d'attestation de vigilance l'expose a la solidarite
 * financiere en cas de travail dissimule. L'ecran s'adresse donc au deposant :
 * il montre ce qui manque, ce qui est en attente de validation et ce qui a ete
 * refuse, avec le motif.</p>
 *
 * <p>Une ligne par type attendu, meme sans piece deposee : un emplacement vide
 * dit ce qu'on attend, la ou une liste vide ne dit rien.</p>
 */
export default function ProviderDocumentsCard({ onFileComplete }: Props) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [documents, setDocuments] = useState<ProviderDocument[] | null>(null);
  const [uploadingType, setUploadingType] = useState<ProviderDocumentType | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Partial<Record<ProviderDocumentType, HTMLInputElement | null>>>({});
  const notifiedComplete = useRef(false);

  const typeLabel = (type: ProviderDocumentType) => t(`providerDocuments.types.${type}`, {
    COMPANY_REGISTRATION: 'Kbis ou avis SIRENE',
    URSSAF_VIGILANCE: 'Attestation de vigilance URSSAF',
    LIABILITY_INSURANCE: 'Assurance responsabilité civile pro',
    IDENTITY: "Pièce d'identité",
    OTHER: 'Autre document',
  }[type]);

  const statusLabel = (status: ProviderDocument['status']) => t(`providerDocuments.status.${status}`, {
    PENDING: 'En cours de validation',
    APPROVED: 'Validé',
    REJECTED: 'Refusé',
  }[status]);

  const reload = useCallback(() => {
    providerDocumentsApi.listMine()
      .then(setDocuments)
      .catch(() => {
        setDocuments([]);
        setError(t('providerDocuments.loadError', 'Impossible de charger vos justificatifs.'));
      });
  }, [t]);

  useEffect(() => { reload(); }, [reload]);

  // Le dossier vient d'etre complete : on le signale UNE fois, sinon chaque
  // rechargement de la liste relancerait la completion d'etape.
  useEffect(() => {
    if (!documents || notifiedComplete.current) return;
    const complete = REQUIRED_PROVIDER_DOCUMENTS.every((type) =>
      documents.some((doc) => doc.documentType === type && doc.currentlyValid));
    if (complete) {
      notifiedComplete.current = true;
      onFileComplete?.();
    }
  }, [documents, onFileComplete]);

  const pickFile = (type: ProviderDocumentType) => {
    setError(null);
    fileInputs.current[type]?.click();
  };

  const upload = async (type: ProviderDocumentType, file: File) => {
    setUploadingType(type);
    setError(null);
    try {
      // L'echeance ne concerne que la vigilance URSSAF (validite 6 mois) — la
      // demander pour un Kbis n'aurait pas de sens.
      await providerDocumentsApi.upload(type, file, type === 'URSSAF_VIGILANCE' ? expiresAt || null : null);
      notify.success(t('providerDocuments.uploaded', 'Justificatif déposé'));
      if (type === 'URSSAF_VIGILANCE') setExpiresAt('');
      reload();
    } catch {
      setError(t('providerDocuments.uploadError',
        'Dépôt impossible — PDF, JPEG, PNG, HEIC ou WEBP, 10 Mo maximum.'));
    } finally {
      setUploadingType(null);
    }
  };

  const remove = async (doc: ProviderDocument) => {
    try {
      await providerDocumentsApi.remove(doc.id);
      reload();
    } catch {
      setError(t('providerDocuments.removeError',
        'Retrait impossible — une pièce déjà validée se remplace par un nouveau dépôt.'));
    }
  };

  const latestFor = (type: ProviderDocumentType) =>
    documents?.find((doc) => doc.documentType === type) ?? null;

  const missing = REQUIRED_PROVIDER_DOCUMENTS.filter((type) => !latestFor(type)?.currentlyValid).length;

  return (
    <Card size="sm" className="shadow-none">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Description size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <p className="m-0 text-2xs font-bold uppercase tracking-wider text-faint">
              {t('providerDocuments.title', 'Justificatifs professionnels')}
            </p>
          </div>
          {documents && (
            <StatusChip
              tone={missing === 0 ? 'ok' : 'warn'}
              label={missing === 0
                ? t('providerDocuments.complete', 'Dossier complet')
                : t('providerDocuments.missing', '{{count}} pièce(s) manquante(s)', { count: missing })}
              size="sm"
              dot
            />
          )}
        </div>

        <p className="m-0 text-xs text-muted-foreground">
          {t('providerDocuments.help',
            'Votre conciergerie doit conserver ces pièces pour vous confier des missions. Formats acceptés : PDF, JPEG, PNG, HEIC, WEBP (10 Mo maximum).')}
        </p>

        {error && (
          <Alert variant="destructive" className="py-1.5">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {documents === null ? (
          <div className="flex justify-center py-5"><Spinner className="size-6" /></div>
        ) : (
          <ItemGroup className="gap-2">
            {DOCUMENT_TYPES.map((type) => {
              const doc = latestFor(type);
              const required = REQUIRED_PROVIDER_DOCUMENTS.includes(type);
              return (
                <Item key={type} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle className="flex items-center gap-1.5">
                      {typeLabel(type)}
                      {required && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {t('providerDocuments.required', '· obligatoire')}
                        </span>
                      )}
                    </ItemTitle>
                    <ItemDescription>
                      {doc
                        ? `${doc.fileName}${doc.expiresAt ? ` · ${t('providerDocuments.until', "valable jusqu'au")} ${doc.expiresAt}` : ''}`
                        : t('providerDocuments.none', 'Aucune pièce déposée')}
                    </ItemDescription>
                    {/* Le motif de refus est rendu au deposant : sans lui, il ne
                        peut que redeposer la meme piece. */}
                    {doc?.status === 'REJECTED' && doc.reviewNote && (
                      <p className="m-0 text-xs text-destructive-ink">{doc.reviewNote}</p>
                    )}
                  </ItemContent>

                  <ItemActions>
                    {doc && (
                      <StatusChip
                        tone={STATUS_TONES[doc.status]}
                        label={statusLabel(doc.status)}
                        size="sm"
                        dot
                      />
                    )}
                    {doc && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('providerDocuments.view', 'Consulter')}
                        onClick={() => window.open(providerDocumentsApi.downloadUrl(doc.id), '_blank', 'noopener')}
                      >
                        <Preview size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                    {doc && doc.status !== 'APPROVED' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive-ink"
                        aria-label={t('providerDocuments.remove', 'Retirer')}
                        onClick={() => remove(doc)}
                      >
                        <DeleteOutline size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                    <Button
                      variant={doc ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={uploadingType === type}
                      onClick={() => pickFile(type)}
                    >
                      {uploadingType === type
                        ? <Spinner className="size-4" />
                        : <UploadFile size={16} strokeWidth={1.75} />}
                      {doc
                        ? t('providerDocuments.replace', 'Remplacer')
                        : t('providerDocuments.upload', 'Déposer')}
                    </Button>
                  </ItemActions>

                  {/* Echeance : demandee uniquement pour la vigilance, seule
                      piece qui se perime d'office (6 mois). `w-full` la renvoie
                      a la ligne — `Item` est un flex enroulant. */}
                  {type === 'URSSAF_VIGILANCE' && (
                    <div className="flex w-full items-center gap-2 border-t border-solid border-border pt-2">
                      <label htmlFor="urssaf-expires" className="text-xs text-muted-foreground">
                        {t('providerDocuments.expiresAt', 'Valable jusqu’au')}
                      </label>
                      <Input
                        id="urssaf-expires"
                        type="date"
                        className="w-auto tabular-nums"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                      />
                    </div>
                  )}

                  <input
                    ref={(el) => { fileInputs.current[type] = el; }}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) upload(type, file);
                      event.target.value = '';
                    }}
                  />
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

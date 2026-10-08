import React, { useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { organizationMembersApi, type OrganizationMemberDto } from '../../services/api/organizationMembersApi';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  open: boolean;
  onClose: () => void;
  member: OrganizationMemberDto | null;
  organizationId: number;
  onMemberRemoved: () => void;
}

export default function RemoveMemberDialog({ open, onClose, member, organizationId, onMemberRemoved }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleRemove = async () => {
    if (!member) return;

    setLoading(true);
    setError(null);

    try {
      await organizationMembersApi.remove(organizationId, member.id);
      onMemberRemoved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('organization.errors.removeMember');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email : '';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('organizations.removeMember.title')}</DialogTitle>
        </DialogHeader>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            {t('organizations.removeMember.confirmHead')} <strong>{memberName}</strong> {t('organizations.removeMember.confirmTail')}
          </p>
          {/* Avertissement : du TEXTE → encre `-ink` (la teinte vive plafonne à 2,2:1). */}
          <p className="text-xs text-destructive-ink">
            {t('organizations.removeMember.warning')}
          </p>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={loading}
          >
            {loading ? <Spinner className="size-4" /> : null}
            {loading ? 'Retrait...' : 'Retirer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { ASSIGNABLE_ORG_ROLES } from '../../utils/orgRoleLabels';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  Send,
  ContentCopy,
  CheckCircle,
  PersonAdd,
} from '../../icons';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import apiClient from '../../services/apiClient';

// ─── Types for user search ───────────────────────────────────────────────────

interface UserSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  hasOrganization: boolean;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const searchUsers = async (q: string): Promise<UserSearchResult[]> => {
  return apiClient.get<UserSearchResult[]>('/v2/users/search', { params: { q } });
};

const addMemberDirect = async (orgId: number, userId: number, role: string) => {
  return apiClient.post(`/organizations/${orgId}/members`, { userId, role });
};

type Mode = 'email' | 'existing';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  onInvitationSent: () => void;
}

const ROLES = ASSIGNABLE_ORG_ROLES;

export default function SendInvitationDialog({ open, onClose, organizationId, onInvitationSent }: Props) {
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationDto | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Existing member mode state ──────────────────────────────────────────
  const [userOptions, setUserOptions] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberSuccess, setMemberSuccess] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const handleUserSearch = useCallback(async (value: string) => {
    if (value.length < 2) {
      setUserOptions([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const results = await searchUsers(value);
      setUserOptions(results);
    } catch {
      setUserOptions([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);
    setError(null);
    try {
      await addMemberDirect(organizationId, selectedUser.id, memberRole);
      setMemberSuccess(true);
      onInvitationSent();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "Erreur lors de l'ajout du membre.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Veuillez saisir un email.');
      return;
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const invitation = await invitationsApi.send(organizationId, {
        email: email.trim(),
        role,
      });
      setResult(invitation);
      onInvitationSent();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors de l\'envoi de l\'invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.invitationLink) return;
    try {
      await navigator.clipboard.writeText(result.invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pour les navigateurs sans clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = result.invitationLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setMode('email');
    setEmail('');
    setRole('MEMBER');
    setError(null);
    setResult(null);
    setCopied(false);
    setSelectedUser(null);
    setUserOptions([]);
    setMemberRole('MEMBER');
    setMemberSuccess(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && !result) {
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[600px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {result ? 'Invitation envoyee' : memberSuccess ? 'Membre ajoute' : 'Inviter un membre'}
          </DialogTitle>
        </DialogHeader>

        {/* `dividers` du DialogContent MUI : filets haut/bas + corps defilant. */}
        <div className="max-h-[60vh] overflow-y-auto border-y border-solid border-[var(--line)] py-3">
        {!result && !memberSuccess ? (
          <div className="flex flex-col gap-3.5 pt-1.5">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full [&>*]:flex-1"
              value={mode}
              // Radix renvoie '' quand on re-clique l'option active : le garde-fou
              // evite de laisser le formulaire sans mode.
              onValueChange={(v) => { if (v) { setMode(v as Mode); setError(null); } }}
            >
              <ToggleGroupItem value="email">Inviter par email</ToggleGroupItem>
              <ToggleGroupItem value="existing">Membre existant</ToggleGroupItem>
            </ToggleGroup>

            {mode === 'email' ? (
              <>
                <Field>
                  <FieldLabel htmlFor="invitation-email">Adresse email</FieldLabel>
                  <Input
                    id="invitation-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    placeholder="exemple@email.com"
                    disabled={loading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="invitation-role">Role</FieldLabel>
                  <NativeSelect
                    id="invitation-role"
                    className="w-full"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                  >
                    {ROLES.map((r) => (
                      <NativeSelectOption key={r.value} value={r.value}>
                        {r.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Le role attribue au nouvel utilisateur</FieldDescription>
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="invitation-user-search">Rechercher un utilisateur...</FieldLabel>
                  {/* `filter={null}` : la liste vient deja filtree du serveur, on
                      ne veut pas d'un second filtrage local (equivalent du
                      `filterOptions={(x) => x}` de l'Autocomplete). */}
                  <Combobox
                    items={userOptions}
                    filter={null}
                    itemToStringLabel={(u: UserSearchResult) =>
                      `${u.firstName} ${u.lastName} (${u.email})`
                    }
                    itemToStringValue={(u: UserSearchResult) => u.email}
                    isItemEqualToValue={(a: UserSearchResult, b: UserSearchResult) => a.id === b.id}
                    value={selectedUser}
                    onValueChange={(next: UserSearchResult | null) => setSelectedUser(next)}
                    onInputValueChange={(inputValue: string) => { void handleUserSearch(inputValue); }}
                  >
                    <ComboboxInput
                      id="invitation-user-search"
                      placeholder="Nom, prenom ou email (min. 2 caracteres)"
                    >
                      {userSearchLoading ? (
                        <InputGroupAddon align="inline-end">
                          <Spinner className="size-[18px]" />
                        </InputGroupAddon>
                      ) : null}
                    </ComboboxInput>
                    {/* Le popup est porte hors du DialogContent, ou Radix coupe les
                        pointer-events du reste du document : sans `pointer-events-auto`
                        les options ne seraient pas cliquables. */}
                    <ComboboxContent className="pointer-events-auto">
                      <ComboboxEmpty>
                        {userSearchLoading ? 'Recherche...' : 'Aucun utilisateur trouve'}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {(option: UserSearchResult) => (
                          <ComboboxItem key={option.id} value={option}>
                            <span className="flex items-center gap-1.5 w-full">
                              <span className="grow">
                                <span className="cn-text-body2 block">
                                  {option.firstName} {option.lastName}
                                </span>
                                <span className="cn-text-caption text-muted-foreground">
                                  {option.email}
                                </span>
                              </span>
                              {option.hasOrganization && (
                                <Badge variant="warning">Deja dans une org</Badge>
                              )}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>

                <Field>
                  <FieldLabel htmlFor="invitation-member-role">Role</FieldLabel>
                  <NativeSelect
                    id="invitation-member-role"
                    className="w-full"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    disabled={addingMember}
                  >
                    {ROLES.map((r) => (
                      <NativeSelectOption key={r.value} value={r.value}>
                        {r.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Le role attribue au membre</FieldDescription>
                </Field>
              </>
            )}

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
          </div>
        ) : memberSuccess ? (
          <div className="flex flex-col gap-3 pt-1.5 items-center">
            <span className="inline-flex text-[var(--ok)]"><CheckCircle size={56} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 text-center">
              <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> a ete ajoute a l'organisation.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1.5 items-center">
            <span className="inline-flex text-[var(--ok)]"><CheckCircle size={56} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 text-center">
              L'invitation a ete envoyee a <strong>{result?.invitedEmail}</strong>
            </p>

            {result?.invitationLink && (
              <div className="w-full">
                <label
                  htmlFor="invitation-link"
                  className="cn-text-body2 text-muted-foreground mb-1.5 block"
                >
                  Vous pouvez aussi partager ce lien directement :
                </label>
                <InputGroup>
                  <InputGroupInput
                    id="invitation-link"
                    readOnly
                    className="text-[0.8rem] font-mono"
                    value={result?.invitationLink ?? ''}
                  />
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BuiButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Copier le lien d'invitation"
                          onClick={handleCopyLink}
                          className={cn(copied && 'text-[var(--ok)]')}
                        >
                          {copied ? <CheckCircle size={16} /> : <ContentCopy size={16} />}
                        </BuiButton>
                      </TooltipTrigger>
                      <TooltipContent>{copied ? 'Copie !' : 'Copier le lien'}</TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            )}

            <span className="cn-text-caption text-[var(--muted)] text-center">
              L'invitation expire le{' '}
              {result?.expiresAt ? new Date(result.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }) : ''}
            </span>
          </div>
        )}
        </div>

      <DialogFooter>
        {!result && !memberSuccess ? (
          <>
            <BuiButton variant="outline" onClick={handleClose} disabled={loading || addingMember}>
              Annuler
            </BuiButton>
            {mode === 'email' ? (
              <BuiButton
                onClick={handleSend}
                disabled={loading || !email.trim()}
              >
                {loading ? <Spinner className="size-4" /> : <Send />}
                {loading ? 'Envoi...' : 'Envoyer'}
              </BuiButton>
            ) : (
              <BuiButton
                onClick={handleAddMember}
                disabled={addingMember || !selectedUser}
              >
                {addingMember ? <Spinner className="size-4" /> : <PersonAdd />}
                {addingMember ? 'Ajout...' : 'Ajouter'}
              </BuiButton>
            )}
          </>
        ) : (
          <BuiButton onClick={handleClose}>
            Fermer
          </BuiButton>
        )}
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

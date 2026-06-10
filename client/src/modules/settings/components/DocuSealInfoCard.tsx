import { Box, Paper, Typography, Alert, Chip } from '@mui/material';
import ProviderLogo from './ProviderLogos';
import { CheckCircle } from '../../../icons';

/**
 * Panneau d'information DocuSeal — provider de signature open source
 * auto-hébergé. Contrairement à Yousign (clé API per-org saisie ici), DocuSeal
 * est un service partagé de la plateforme : son branchement est une opération
 * d'infrastructure (clenzy-infra), pas une saisie utilisateur. Ce panneau
 * explique l'état et la marche à suivre.
 */

interface DocuSealInfoCardProps {
  /** Instance configurée côté backend (DOCUSEAL_BASE_URL + DOCUSEAL_API_KEY). */
  available: boolean;
  /** Provider actif (SIGNATURE_PROVIDER=docuseal). */
  active: boolean;
}

const STEPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Déployer l’instance (clenzy-infra)',
    detail: 'Ajouter le container DocuSeal au docker-compose + reverse proxy nginx (ex. sign.clenzy.fr).',
  },
  {
    title: 'Configurer le backend',
    detail: 'Renseigner DOCUSEAL_BASE_URL et DOCUSEAL_API_KEY (clé générée dans DocuSeal → Réglages → API) sur le service pms-server.',
  },
  {
    title: 'Activer le provider',
    detail: 'Basculer SIGNATURE_PROVIDER=docuseal puis redéployer. Sans cette bascule, le workflow interne Clenzy (SES) reste utilisé.',
  },
];

export default function DocuSealInfoCard({ available, active }: DocuSealInfoCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'flex-start', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <ProviderLogo provider="DOCUSEAL" size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>DocuSeal</Typography>
            {active ? (
              <Chip label="Provider actif" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: '#4A9B8E', backgroundColor: '#4A9B8E14', border: '1px solid #4A9B8E40' }} />
            ) : available ? (
              <Chip label="Instance connectée — non activé" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: '#4A9B8E', backgroundColor: '#4A9B8E14', border: '1px solid #4A9B8E40' }} />
            ) : (
              <Chip label="Prêt — à brancher" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: '#D4A574', backgroundColor: '#D4A57414', border: '1px solid #D4A57440' }} />
            )}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            Alternative open source (AGPL) auto-hébergée à DocuSign — signature SES avec scellement cryptographique du PDF, données sur votre infrastructure, 0 € de licence.
          </Typography>
        </Box>
      </Box>

      {/* Corps */}
      <Box sx={{ px: 2, py: 1.75 }}>
        <Alert severity={available ? 'success' : 'info'} variant="outlined" sx={{ borderRadius: '8px', fontSize: '0.75rem', py: 0.25, mb: 1.5 }}>
          {available
            ? "L'instance DocuSeal est configurée. Le provider est implémenté et fonctionnel — il ne sera utilisé qu'après la bascule SIGNATURE_PROVIDER=docuseal."
            : "L'intégration est entièrement implémentée côté code (création de la demande, lien de signature, statut, téléchargement du document signé). Elle est inactive tant que l'instance self-hosted n'est pas déployée et branchée — opération d'infrastructure, pas de saisie ici."}
        </Alert>

        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1 }}>
          Branchement (opération infra)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {STEPS.map((step, i) => (
            <Box key={step.title} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700,
                  bgcolor: 'rgba(107,138,154,0.10)', color: '#6B8A9A',
                }}
              >
                {i + 1}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3 }}>{step.title}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.45 }}>{step.detail}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: '#4A9B8E' }}>
            <CheckCircle size={13} strokeWidth={2} />
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            En attendant, la signature électronique fonctionne via le workflow interne Clenzy (SES, lien public + certificat de preuve).
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

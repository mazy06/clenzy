import { Box, Button, Stack, Typography, Paper } from '@mui/material'
import keycloak, { isAuthenticated, getParsedAccessToken, clearTokens, getAccessToken } from '../../keycloak'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_CONFIG } from '../../config/api'

// keycloak instance is provided by src/keycloak.ts

export default function Home() {
  const [initialized, setInitialized] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [apiResult, setApiResult] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    // Eviter de relancer une init Keycloak qui écrase le token injecté
    setInitialized(true)
    const parsed = getParsedAccessToken()
    if (parsed) {
      setProfile({ firstName: parsed.given_name })
    }
  }, [])

  const header = useMemo(() => (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography variant="h4" fontWeight={700} color="secondary.main">Clenzy</Typography>
      <Stack direction="row" spacing={2}>
        {!isAuthenticated() ? (
          <Button variant="contained" onClick={() => navigate('/login')}>Se connecter</Button>
        ) : (
          <>
            <Typography>Bonjour {profile?.firstName ?? 'Utilisateur'}</Typography>
            <Button variant="outlined" color="secondary" onClick={async () => {
              try {
                const refreshToken = (keycloak as any).refreshToken || localStorage.getItem('kc_refresh_token')
                await fetch(API_CONFIG.ENDPOINTS.LOGOUT, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken }),
                })
              } catch {}
              clearTokens()
              ;(keycloak as any).token = undefined
              ;(keycloak as any).refreshToken = undefined
              ;(keycloak as any).authenticated = false
              window.location.assign('/login')
            }}>Se déconnecter</Button>
          </>
        )}
      </Stack>
    </Stack>
  ), [initialized, profile])

  const apiCall = async () => {
    try {
      const token = getAccessToken()
      if (!token) {
        alert('Token non disponible. Merci de vous reconnecter.')
        return
      }
      console.info('Appel /api/me avec token (longueur):', token.length)
              const resp = await fetch(API_CONFIG.ENDPOINTS.ME, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) {
        const txt = await resp.text()
        setApiResult(`Erreur HTTP ${resp.status}: ${txt}`)
        return
      }
      const json = await resp.json()
      setApiResult(JSON.stringify(json, null, 2))
    } catch (e: any) {
      console.error('Erreur appel /api/me:', e)
      setApiResult(`Erreur appel API: ${e?.message || e}`)
    }
  }

  return (
    <Box>
      {header}
      <Box mt={6}>
        <Typography variant="h5" gutterBottom>Plateforme de gestion Clenzy</Typography>
        <Typography color="text.secondary">Connectée à Keycloak et au backend Spring Boot</Typography>
        {keycloak.authenticated && (
          <Button sx={{ mt: 3 }} variant="contained" onClick={apiCall}>Tester /api/me</Button>
        )}
        {apiResult && (
          <Paper sx={{ mt: 3, p: 2, bgcolor: '#0B1026', color: 'white', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {apiResult}
          </Paper>
        )}
      </Box>
    </Box>
  )
}



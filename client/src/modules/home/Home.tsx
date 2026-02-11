import { Box, Button, Stack, Typography, Paper } from '@mui/material'
import keycloak, { isAuthenticated, getParsedAccessToken, clearTokens, getAccessToken } from '../../keycloak'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import { getRefreshToken } from '../../services/storageService'

// keycloak instance is provided by src/keycloak.ts

export default function Home() {
  const [initialized, setInitialized] = useState(false)
  const [profile, setProfile] = useState<{ firstName?: string } | null>(null)
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
                const refreshToken = keycloak.refreshToken || getRefreshToken()
                await apiClient.post('/logout', { refreshToken })
              } catch {}
              clearTokens()
              keycloak.token = undefined
              keycloak.refreshToken = undefined
              keycloak.authenticated = false
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
      const json = await apiClient.get<any>('/me')
      setApiResult(JSON.stringify(json, null, 2))
    } catch (e: any) {
      if (e.status) {
        setApiResult(`Erreur HTTP ${e.status}: ${e.message}`)
      } else {
        setApiResult(`Erreur appel API: ${e instanceof Error ? e.message : String(e)}`)
      }
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



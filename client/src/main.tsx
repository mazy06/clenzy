import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './modules/App'
import lightTheme from './theme/theme'
import darkTheme from './theme/darkTheme'
import ThemeSafetyWrapper from './components/ThemeSafetyWrapper'
import { NotificationProvider } from './hooks/useNotification'
import { ThemeModeProvider, useThemeMode } from './hooks/useThemeMode'
import './i18n/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppWithTheme() {
  const { isDark } = useThemeMode();
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <NotificationProvider>
          <ThemeSafetyWrapper>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ThemeSafetyWrapper>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <AppWithTheme />
    </ThemeModeProvider>
  </React.StrictMode>
)

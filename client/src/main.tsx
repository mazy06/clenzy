import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import App from './modules/App'
import lightTheme from './theme/theme'
import darkTheme from './theme/darkTheme'
import ThemeSafetyWrapper from './components/ThemeSafetyWrapper'
import { NotificationProvider } from './hooks/useNotification'
import { ThemeModeProvider, useThemeMode } from './hooks/useThemeMode'
import './i18n/config'

function AppWithTheme() {
  const { isDark } = useThemeMode();
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
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
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <AppWithTheme />
    </ThemeModeProvider>
  </React.StrictMode>
)

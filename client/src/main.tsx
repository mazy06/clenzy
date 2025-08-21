import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import App from './modules/App'
import theme from './theme/theme'
import ThemeSafetyWrapper from './components/ThemeSafetyWrapper'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeSafetyWrapper>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeSafetyWrapper>
    </ThemeProvider>
  </React.StrictMode>
)



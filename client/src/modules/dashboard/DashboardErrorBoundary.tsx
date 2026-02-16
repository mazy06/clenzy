import React, { Component } from 'react';
import { Card, CardContent, Typography, Button, Box } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error card (e.g. "Graphiques", "Activites") */
  widgetName?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary that catches render errors in dashboard widgets
 * and shows a friendly fallback instead of crashing the whole page.
 */
class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[DashboardErrorBoundary${this.props.widgetName ? ` — ${this.props.widgetName}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <ErrorOutline color="error" sx={{ fontSize: 28, mb: 0.5, opacity: 0.6 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 1 }}>
              {this.props.widgetName
                ? `Erreur lors du chargement de "${this.props.widgetName}"`
                : 'Erreur lors du chargement du widget'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Refresh sx={{ fontSize: 14 }} />}
              onClick={this.handleRetry}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Reessayer
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;

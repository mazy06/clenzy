import React, { Component } from 'react';
import { Button, Card, CardContent } from '../../components/ui';
import { ErrorOutline, Refresh } from '../../icons';

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
        <Card className="h-full flex items-center justify-center">
          <CardContent className="text-center py-3">
            {/* `color="error"` etait un jeton MUI passe a une icone lucide : invalide
                en CSS, donc sans effet. Remplace par le jeton de couleur du kit. */}
            <span className="inline-flex mb-0.5 opacity-60"><ErrorOutline color="var(--err)" size={28} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 text-muted-foreground text-[0.75rem] mb-1.5">
              {this.props.widgetName
                ? `Erreur lors du chargement de "${this.props.widgetName}"`
                : 'Erreur lors du chargement du widget'}
            </p>
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <Refresh size={14} strokeWidth={1.75} />
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

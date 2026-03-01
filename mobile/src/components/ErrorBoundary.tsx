import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // TODO: Send to Sentry/Crashlytics in production
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: '#F8FAFC',
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>!</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#1E293B',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Une erreur est survenue
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#64748B',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            L'application a rencontre un probleme inattendu. Veuillez reessayer.
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView
              style={{
                maxHeight: 120,
                backgroundColor: '#FEF2F2',
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                width: '100%',
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#B05A5A' }}>
                {this.state.error.message}
              </Text>
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              backgroundColor: '#6B8A9A',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Reessayer"
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Reessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

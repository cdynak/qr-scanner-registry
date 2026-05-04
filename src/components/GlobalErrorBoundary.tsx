import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "./ui/button";
import { logError, createErrorInfo } from "../lib/errors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}`;

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log error with additional context
    logError(error, {
      component: "GlobalErrorBoundary",
      errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to external error tracking service
    this.reportError(error, errorInfo, errorId);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    // In a real application, you would send this to an error tracking service
    // like Sentry, Bugsnag, or LogRocket
    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Example: Send to error tracking service
    // errorTrackingService.captureException(error, errorReport);

    // For now, just log to console in development
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Error Report:", errorReport);
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleReportBug = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
    };

    // Create a bug report URL or open a modal
    const bugReportUrl = `mailto:support@example.com?subject=Bug Report - ${errorDetails.errorId}&body=Error Details: ${JSON.stringify(errorDetails, null, 2)}`;
    window.open(bugReportUrl);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      const showDetails = this.props.showErrorDetails ?? isDevelopment;

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">Oops! Something went wrong</h1>
              <p className="text-lg text-muted-foreground">
                We're sorry, but something unexpected happened. Our team has been notified and is working on a fix.
              </p>
              {this.state.errorId && (
                <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>

            {showDetails && this.state.error && (
              <div className="text-left bg-muted p-4 rounded-lg border">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Error Details (Development Mode)
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Error Message:</p>
                    <pre className="text-xs text-foreground bg-background p-2 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Stack Trace:</p>
                      <pre className="text-xs text-muted-foreground bg-background p-2 rounded overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Component Stack:</p>
                      <pre className="text-xs text-muted-foreground bg-background p-2 rounded overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="default" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
              <Button onClick={this.handleReportBug} variant="outline" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Report Bug
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>If this problem persists, please try refreshing the page or contact support.</p>
              <p>You can also try clearing your browser cache and cookies for this site.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;

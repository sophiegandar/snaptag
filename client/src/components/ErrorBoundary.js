import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report error to monitoring service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const errorReport = {
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // Copy error report to clipboard
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => alert('Error report copied to clipboard. Please share this with support.'))
      .catch(() => console.log('Error report:', errorReport));
  };

  render() {
    if (this.state.hasError) {
      const isImageError = this.state.error?.message?.includes('image') || 
                          this.state.error?.message?.includes('Image') ||
                          this.state.errorInfo?.componentStack?.includes('ImageCard') ||
                          this.state.errorInfo?.componentStack?.includes('ImageGallery');
      
      const isNetworkError = this.state.error?.message?.includes('fetch') ||
                            this.state.error?.message?.includes('network') ||
                            this.state.error?.message?.includes('Failed to load');

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h1>
              
              {/* Contextual error messages */}
              {isImageError && (
                <p className="text-gray-600 mb-4">
                  There was a problem loading images. This might be due to a network issue or corrupted image data.
                </p>
              )}
              
              {isNetworkError && (
                <p className="text-gray-600 mb-4">
                  Unable to connect to the server. Please check your internet connection and try again.
                </p>
              )}
              
              {!isImageError && !isNetworkError && (
                <p className="text-gray-600 mb-4">
                  An unexpected error occurred. The app has been safely contained to prevent further issues.
                </p>
              )}

              {/* Error details for developers */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-left">
                  <p className="text-sm font-medium text-red-800 mb-1">Development Error:</p>
                  <p className="text-xs text-red-700 font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  disabled={this.state.retryCount >= 3}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {this.state.retryCount >= 3 ? 'Max retries reached' : 'Try Again'}
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </button>
                
                <button
                  onClick={this.handleReportBug}
                  className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Report Issue
                </button>
              </div>

              {/* Helpful tips */}
              <div className="mt-4 text-xs text-gray-500">
                <p>💡 Tips:</p>
                <ul className="text-left mt-1 space-y-1">
                  <li>• Try refreshing the page</li>
                  <li>• Check your internet connection</li>
                  <li>• Clear browser cache if issues persist</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

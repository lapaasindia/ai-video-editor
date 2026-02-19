import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 40,
                    background: '#1e1e1e',
                    color: '#e0e0e0',
                    height: '100vh',
                    overflow: 'auto',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <h1 style={{ color: '#e74c3c', marginBottom: 16 }}>Application Crashed</h1>
                    <p style={{ marginBottom: 24, fontSize: 16 }}>An unexpected error occurred. Please reload the application.</p>

                    <div style={{
                        background: '#2d2d2d',
                        padding: 20,
                        borderRadius: 8,
                        border: '1px solid #444',
                        marginBottom: 24
                    }}>
                        <strong style={{ display: 'block', marginBottom: 8, color: '#f39c12' }}>Error:</strong>
                        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#fff', fontSize: 13 }}>
                            {this.state.error && this.state.error.toString()}
                        </div>
                    </div>

                    <div style={{
                        background: '#2d2d2d',
                        padding: 20,
                        borderRadius: 8,
                        border: '1px solid #444',
                        marginBottom: 24
                    }}>
                        <strong style={{ display: 'block', marginBottom: 8, color: '#f39c12' }}>Components Stack:</strong>
                        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 12, overflowX: 'auto' }}>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </div>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

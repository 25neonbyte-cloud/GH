import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError:false, message:'' };
  }

  static getDerivedStateFromError(error) {
    return { hasError:true, message:error?.message || 'Erro inesperado na interface' };
  }

  componentDidCatch(error, info) {
    console.error('Erro de renderização:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError:false, message:'' });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <div className="card p-8 max-w-3xl">
      <h1 className="text-xl font-bold mb-2">Não foi possível carregar esta área</h1>
      <p className="text-slate-600 mb-4">A navegação continua disponível. O erro foi isolado nesta tela para evitar uma página em branco.</p>
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{this.state.message}</div>
      <div className="flex gap-2"><button className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar</button><a className="btn btn-secondary" href="/">Ir ao Dashboard</a></div>
    </div>;
  }
}

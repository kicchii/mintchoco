import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi gangguan saat memuat aplikasi.',
    };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed.error) {
          friendly = `Operasi basis data (${parsed.operationType || 'akses'}) gagal: ${parsed.error}`;
        }
      } catch {
        // Keep original message
      }

      return (
        <div className="min-h-screen bg-[#FBF8F1] text-[#3E2723] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#DFD3C3] rounded-2xl p-8 space-y-4 shadow-sm">
            <p className="text-xs font-semibold tracking-wider text-[#8D6E63]">Kicchive</p>
            <h1 className="text-2xl font-display font-semibold text-[#3E2723]">
              Terjadi kendala pada sistem
            </h1>
            <p className="text-sm text-[#6D4C41] leading-relaxed break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] transition-colors whitespace-nowrap"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

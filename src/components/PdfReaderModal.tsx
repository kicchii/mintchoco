import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ReaderTheme = 'paper' | 'sepia' | 'night';

interface PdfReaderModalProps {
  title: string;
  author: string;
  pdfUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onClose: () => void;
}

export function PdfReaderModal({
  title,
  author,
  pdfUrl,
  initialPage = 1,
  onPageChange,
  onClose,
}: PdfReaderModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [scale, setScale] = useState<number>(1.2);
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
    });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage((prev) => Math.min(Math.max(1, prev), doc.numPages));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error
            ? `Berkas PDF tidak dapat dimuat (${err.message}).`
            : 'Berkas PDF tidak dapat dimuat.'
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => undefined);
    };
  }, [pdfUrl, reloadKey]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;
    setRendering(true);

    pdfDoc
      .getPage(currentPage)
      .then((page) => {
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        return renderTask.promise;
      })
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setRendering(false);
        }
      });

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (onPageChange && pdfDoc) {
      onPageChange(currentPage);
    }
  }, [currentPage, pdfDoc, onPageChange]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrentPage((p) => Math.min(totalPages, p + 1));
      if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, totalPages]);

  const surfaceStyles: Record<ReaderTheme, string> = {
    paper: 'bg-[#F3ECE1] text-[#3E2723]',
    sepia: 'bg-[#F6EBD8] text-[#3E2723]',
    night: 'bg-[#261D1A] text-[#F5EFE6]',
  };

  const canvasFilter: Record<ReaderTheme, string> = {
    paper: 'none',
    sepia: 'sepia(22%) contrast(96%)',
    night: 'invert(90%) hue-rotate(180deg) contrast(92%)',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${surfaceStyles[theme]} transition-colors duration-150`}
      role="dialog"
      aria-modal="true"
      aria-label={`Pembaca PDF: ${title}`}
    >
      {/* Top Reader Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-b border-[#DFD3C3] bg-[#FBF8F1]/95 text-[#3E2723] backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#8D6E63] truncate">
            Pembaca Daring Kicchive · {author}
          </p>
          <h2 className="font-display text-lg font-semibold text-[#3E2723] truncate">
            {title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Page Navigation */}
          <div className="flex items-center rounded-xl border border-[#DFD3C3] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
              className="p-2 text-[#3E2723] hover:bg-[#E2F5EC] disabled:opacity-35 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono tabular-nums whitespace-nowrap">
              Hal. {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Halaman berikutnya"
              className="p-2 text-[#3E2723] hover:bg-[#E2F5EC] disabled:opacity-35 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center rounded-xl border border-[#DFD3C3] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.15).toFixed(2))))}
              aria-label="Perkecil"
              className="p-2 text-[#3E2723] hover:bg-[#E2F5EC] transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono tabular-nums whitespace-nowrap">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.1, Number((s + 0.15).toFixed(2))))}
              aria-label="Perbesar"
              className="p-2 text-[#3E2723] hover:bg-[#E2F5EC] transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Reading Theme Switch */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[#EFE6D8] text-xs">
            {(
              [
                { id: 'paper', label: 'Kertas' },
                { id: 'sepia', label: 'Sepia' },
                { id: 'night', label: 'Gelap' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  theme === opt.id
                    ? 'bg-[#9CE0C2] text-[#3E2723] font-semibold'
                    : 'text-[#6D4C41] hover:text-[#3E2723]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4E342E] text-[#FFFDF8] hover:bg-[#3E2723] transition-colors whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Tutup Pembaca
          </button>
        </div>
      </header>

      {/* Main Canvas Scroll Viewport */}
      <div className="flex-1 overflow-auto flex flex-col items-center py-8 px-4">
        {loading && (
          <div className="my-auto text-center space-y-3 py-16">
            <div className="w-8 h-8 border-2 border-[#4E342E] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm opacity-80">Menyiapkan halaman naskah PDF...</p>
          </div>
        )}

        {errorMsg && !loading && (
          <div className="my-auto max-w-md w-full bg-white text-[#3E2723] border border-[#DFD3C3] rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-xl font-semibold">Berkas PDF gagal dirender</h3>
            <p className="text-sm text-[#6D4C41]">{errorMsg}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Coba Muat Ulang
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-[#DFD3C3] text-[#3E2723] hover:bg-[#F3ECE1]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Tautan Berkas
              </a>
            </div>
          </div>
        )}

        {!loading && !errorMsg && (
          <div className="relative shadow-lg border border-[#DFD3C3] rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              style={{ filter: canvasFilter[theme] }}
              className="block max-w-full h-auto"
            />
            {rendering && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#3E2723]">
                  Merender halaman...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Reading Progress Strip */}
      <footer className="px-5 py-2.5 border-t border-[#DFD3C3] bg-[#FBF8F1]/95 text-[#6D4C41] flex items-center justify-between text-xs">
        <span className="truncate">
          Progres baca tersimpan otomatis ke akun peminjaman Anda
        </span>
        <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
          {Math.round((currentPage / Math.max(1, totalPages)) * 100)}% selesai
        </span>
      </footer>
    </div>
  );
}

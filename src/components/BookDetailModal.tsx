import { BookOpen, CheckCircle2, Clock, X } from 'lucide-react';
import type { Book, Loan } from '../types/library';
import { CoverImage } from './CoverImage';

interface BookDetailModalProps {
  book: Book;
  activeLoan?: Loan;
  isSignedIn: boolean;
  isBorrowing: boolean;
  onBorrow: (book: Book) => void;
  onRead: (book: Book, loan?: Loan) => void;
  onSignIn: () => void;
  onClose: () => void;
}

export function BookDetailModal({
  book,
  activeLoan,
  isSignedIn,
  isBorrowing,
  onBorrow,
  onRead,
  onSignIn,
  onClose,
}: BookDetailModalProps) {
  const fileSizeKb = Math.max(1, Math.round(book.fileSizeBytes / 1024));

  return (
    <div
      className="fixed inset-0 z-40 bg-[#3E2723]/45 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail buku: ${book.title}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#FBF8F1] border border-[#DFD3C3] rounded-3xl shadow-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFD3C3] bg-[#E2F5EC]/60">
          <p className="text-xs font-semibold tracking-wider text-[#6D4C41] font-mono">
            {book.accessionNumber} · {book.category}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail buku"
            className="p-2 rounded-xl text-[#6D4C41] hover:text-[#3E2723] hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Cover Column */}
          <div className="md:col-span-5 bg-[#E2F5EC]/45 p-6 sm:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-[#DFD3C3]">
            <div className="w-full max-w-[260px] aspect-[3/4] rounded-2xl shadow-md border-2 border-[#FEF3C7] overflow-hidden bg-white">
              <CoverImage
                src={book.coverUrl}
                alt={`Sampul buku ${book.title}`}
                title={book.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right Metadata & Actions */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#FBF8F1]">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#3E2723] leading-tight text-balance">
                  {book.title}
                </h2>
                <p className="text-sm text-[#6D4C41] mt-1.5">oleh {book.author}</p>
              </div>

              <p className="text-sm text-[#5D4037] leading-relaxed">{book.synopsis}</p>

              {/* Accession Definition List */}
              <dl className="divide-y divide-[#E7DDD0] border-y border-[#DFD3C3] text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#8D6E63]">Nomor Induk</dt>
                  <dd className="font-mono tabular-nums text-[#3E2723]">{book.accessionNumber}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#8D6E63]">ISBN</dt>
                  <dd className="font-mono tabular-nums text-[#3E2723]">{book.isbn}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#8D6E63]">Tahun Terbit & Halaman</dt>
                  <dd className="font-mono tabular-nums text-[#3E2723]">
                    {book.publishedYear} · {book.pageCount} hlm · {fileSizeKb} KB
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#8D6E63]">Durasi Pinjam Standar</dt>
                  <dd className="font-mono tabular-nums text-[#3E2723]">
                    {book.loanDurationDays} hari kalender
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#8D6E63]">Ketersediaan Eksemplar</dt>
                  <dd className="font-mono tabular-nums text-[#3E2723]">
                    {book.availableCopies} dari {book.totalCopies} tersedia
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {activeLoan ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRead(book, activeLoan)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] transition-colors whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" />
                    Lanjutkan Baca PDF (Hal. {activeLoan.lastReadPage})
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#2B6B53] font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Sedang Anda pinjam
                  </span>
                </>
              ) : !isSignedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRead(book)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] transition-colors whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" />
                    Baca PDF Langsung
                  </button>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#3E2723] hover:bg-[#FDE68A] transition-colors whitespace-nowrap"
                  >
                    Masuk untuk Pinjam ({book.loanDurationDays} Hari)
                  </button>
                </>
              ) : book.availableCopies > 0 ? (
                <button
                  type="button"
                  disabled={isBorrowing}
                  onClick={() => onBorrow(book)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4" />
                  {isBorrowing ? 'Memproses Peminjaman...' : `Pinjam Daring (${book.loanDurationDays} Hari)`}
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#FEF3C7] text-[#6D4C41]">
                  <Clock className="w-4 h-4" />
                  Semua eksemplar sedang dipinjam
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

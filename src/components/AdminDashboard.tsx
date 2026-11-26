import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CheckCircle2,
  Clock,
  FileUp,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { COVER_PRESETS } from '../data/seedBooks';
import {
  createBookRecord,
  deleteBookRecord,
  getDaysOverdue,
  getDaysRemaining,
  returnBookAtomic,
  seedInitialCatalog,
  sendManualOverdueReminder,
  simulateOverdueLoanForTesting,
  updateBookCopiesAndDuration,
  uploadPdfFile,
} from '../services/libraryService';
import type { Book, Loan, UploadedPdfResult } from '../types/library';

interface AdminDashboardProps {
  adminUid: string;
  books: Book[];
  loans: Loan[];
  onPreviewPdf: (book: Book) => void;
  onStatusMessage: (msg: string, isError?: boolean) => void;
}

type AdminTab = 'upload' | 'books' | 'loans';

const CATEGORIES = ['Arsitektur', 'Ekologi', 'Desain', 'Filsafat', 'Sejarah', 'Sains', 'Sastra'];

export function AdminDashboard({
  adminUid,
  books,
  loans,
  onPreviewPdf,
  onStatusMessage,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('upload');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfResult | null>(null);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [busyBookId, setBusyBookId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Arsitektur');
  const [isbn, setIsbn] = useState('978-602-8912-60-2');
  const [accessionNumber, setAccessionNumber] = useState(
    `KCV-2026-${String(books.length + 1).padStart(3, '0')}`
  );
  const [publishedYear, setPublishedYear] = useState(2026);
  const [pageCount, setPageCount] = useState(12);
  const [totalCopies, setTotalCopies] = useState(4);
  const [loanDurationDays, setLoanDurationDays] = useState(7);
  const [coverUrl, setCoverUrl] = useState<string>(COVER_PRESETS[0].url);
  const [synopsis, setSynopsis] = useState('');

  const activeLoans = loans.filter((l) => l.status === 'borrowed');
  const overdueLoans = activeLoans.filter((l) => l.dueAt.toMillis() < Date.now());
  const totalCopiesAll = books.reduce((sum, b) => sum + b.totalCopies, 0);

  async function handlePdfFileSelect(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onStatusMessage('Harap pilih berkas dengan format .pdf.', true);
      return;
    }

    setUploadingPdf(true);
    try {
      const result = await uploadPdfFile(file);
      setUploadedPdf(result);
      setPageCount(result.pageCount);
      if (!title) {
        const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
        setTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
      }
      onStatusMessage(
        `PDF "${file.name}" berhasil diunggah (${result.pageCount} halaman).`
      );
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal mengunggah PDF.',
        true
      );
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handlePublishBook(e: FormEvent) {
    e.preventDefault();
    if (!uploadedPdf) {
      onStatusMessage('Silakan unggah berkas PDF terlebih dahulu.', true);
      return;
    }
    if (!title.trim() || !author.trim() || !synopsis.trim()) {
      onStatusMessage('Judul, penulis, dan sinopsis wajib diisi.', true);
      return;
    }

    setSubmittingBook(true);
    try {
      await createBookRecord({
        title,
        author,
        category,
        isbn,
        accessionNumber,
        publishedYear,
        pageCount: uploadedPdf.pageCount || pageCount,
        synopsis,
        coverUrl,
        pdfUrl: uploadedPdf.pdfUrl,
        fileName: uploadedPdf.fileName,
        fileSizeBytes: uploadedPdf.fileSizeBytes,
        totalCopies,
        loanDurationDays,
        createdBy: adminUid,
      });

      setTitle('');
      setAuthor('');
      setSynopsis('');
      setUploadedPdf(null);
      setAccessionNumber(`KCV-2026-${String(books.length + 2).padStart(3, '0')}`);
      onStatusMessage('Buku baru dan berkas PDF berhasil dipublikasikan ke katalog Kicchive.');
      setActiveTab('books');
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan buku ke katalog.',
        true
      );
    } finally {
      setSubmittingBook(false);
    }
  }

  async function handleSeedCatalog() {
    setSeeding(true);
    try {
      await seedInitialCatalog(adminUid);
      onStatusMessage('5 koleksi kurasi awal Kicchive berhasil dimuat ke katalog.');
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal memuat koleksi awal.',
        true
      );
    } finally {
      setSeeding(false);
    }
  }

  async function handleSendReminder(loan: Loan) {
    setBusyLoanId(loan.id);
    try {
      await sendManualOverdueReminder(loan);
      onStatusMessage(`Notifikasi pengingat telah dikirim kepada ${loan.userName}.`);
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal mengirim pengingat.',
        true
      );
    } finally {
      setBusyLoanId(null);
    }
  }

  async function handleSimulateOverdue(loan: Loan) {
    setBusyLoanId(loan.id);
    try {
      await simulateOverdueLoanForTesting(loan);
      onStatusMessage(
        `Jatuh tempo "${loan.bookTitle}" disimulasikan terlambat 3 hari. Notifikasi keterlambatan akan aktif otomatis.`
      );
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal memperbarui jatuh tempo.',
        true
      );
    } finally {
      setBusyLoanId(null);
    }
  }

  async function handleAdminReturn(loan: Loan) {
    setBusyLoanId(loan.id);
    try {
      const targetBook = books.find((b) => b.id === loan.bookId);
      await returnBookAtomic(loan, targetBook);
      onStatusMessage(`Buku "${loan.bookTitle}" telah ditandai dikembalikan.`);
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal memproses pengembalian.',
        true
      );
    } finally {
      setBusyLoanId(null);
    }
  }

  async function handleAdjustCopies(book: Book, delta: number) {
    setBusyBookId(book.id);
    try {
      const nextTotal = Math.max(1, book.totalCopies + delta);
      await updateBookCopiesAndDuration(book, nextTotal, book.loanDurationDays);
      onStatusMessage(`Stok "${book.title}" diperbarui menjadi ${nextTotal} eksemplar.`);
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal memperbarui stok buku.',
        true
      );
    } finally {
      setBusyBookId(null);
    }
  }

  async function handleDeleteBook(book: Book) {
    setBusyBookId(book.id);
    try {
      await deleteBookRecord(book.id);
      onStatusMessage(`Buku "${book.title}" dihapus dari katalog.`);
    } catch (err) {
      onStatusMessage(
        err instanceof Error ? err.message : 'Gagal menghapus buku.',
        true
      );
    } finally {
      setBusyBookId(null);
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header & Quick Seed */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DFD3C3] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#8D6E63]">
            Konsol Pengelola Kicchive
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-1">
            Dasbor Admin & Unggah PDF
          </h1>
        </div>
        {books.length === 0 && (
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedCatalog}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {seeding ? 'Memuat Koleksi...' : 'Muat 5 Koleksi Kurasi Awal'}
          </button>
        )}
      </div>

      {/* 4-Column Circulation KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-[#DFD3C3] bg-white divide-y lg:divide-y-0 lg:divide-x divide-[#DFD3C3] overflow-hidden">
        <div className="p-5">
          <p className="text-xs text-[#8D6E63]">Total Judul Buku</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#3E2723] mt-1">
            {books.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#8D6E63]">Total Eksemplar</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#3E2723] mt-1">
            {totalCopiesAll}
          </p>
        </div>
        <div className="p-5 bg-[#E2F5EC]/40">
          <p className="text-xs text-[#6D4C41]">Sedang Dipinjam</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#2B6B53] mt-1">
            {activeLoans.length}
          </p>
        </div>
        <div className="p-5 bg-[#FEF3C7]/45">
          <p className="text-xs text-[#6D4C41]">Pinjaman Terlambat</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-[#C62828] mt-1">
            {overdueLoans.length}
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DFD3C3] pb-3">
        {(
          [
            { id: 'upload', label: 'Unggah PDF & Buku Baru' },
            { id: 'books', label: `Kelola Koleksi (${books.length})` },
            { id: 'loans', label: `Monitoring Pinjaman (${activeLoans.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#4E342E] text-[#FFFDF8]'
                : 'bg-[#EFE6D8] text-[#5D4037] hover:bg-[#E2F5EC] hover:text-[#3E2723]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Upload PDF & Publish Book */}
      {activeTab === 'upload' && (
        <form
          onSubmit={handlePublishBook}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white border border-[#DFD3C3] rounded-2xl p-6 sm:p-8"
        >
          {/* Left: PDF File Dropzone */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#3E2723]">
                1. Unggah Berkas PDF
              </h2>
              <p className="text-xs text-[#8D6E63] mt-1">
                Format PDF hingga 25 MB. Jumlah halaman akan dibaca otomatis dari berkas.
              </p>
            </div>

            <label className="block rounded-2xl border-2 border-dashed border-[#BCE3D3] bg-[#E2F5EC]/35 hover:bg-[#E2F5EC]/70 transition-colors p-8 text-center cursor-pointer">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => handlePdfFileSelect(e.target.files?.[0])}
              />
              <FileUp className="w-8 h-8 mx-auto text-[#4E342E] mb-3" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-[#3E2723]">
                {uploadingPdf ? 'Mengunggah berkas PDF...' : 'Pilih berkas PDF dari perangkat'}
              </p>
              <p className="text-xs text-[#6D4C41] mt-1">
                Berkas disimpan langsung di peladen Kicchive untuk pembacaan daring.
              </p>
            </label>

            {uploadedPdf && (
              <div className="rounded-xl border border-[#9CE0C2] bg-[#E2F5EC] p-4 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[#2B6B53]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>PDF Siap Dipublikasikan</span>
                </div>
                <p className="text-[#3E2723] truncate font-mono">{uploadedPdf.fileName}</p>
                <p className="text-[#6D4C41] font-mono tabular-nums">
                  {uploadedPdf.pageCount} halaman ·{' '}
                  {Math.max(1, Math.round(uploadedPdf.fileSizeBytes / 1024))} KB
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#5D4037]">
                Pilih Sampul Arsip
              </label>
              <select
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#FBF8F1] border border-[#DFD3C3] text-[#3E2723] focus:outline-none focus:border-[#4E342E]"
              >
                {COVER_PRESETS.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Metadata Form */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#3E2723]">
                2. Metadata Katalog Buku
              </h2>
              <p className="text-xs text-[#8D6E63] mt-1">
                Lengkapi informasi bibliografi agar pengguna dapat meminjam dan membaca buku ini.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Judul Buku
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Pengantar Arsip Digital Modern"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Penulis
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Nama lengkap penulis"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  ISBN
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Nomor Induk
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={accessionNumber}
                  onChange={(e) => setAccessionNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Tahun Terbit
                </label>
                <input
                  type="number"
                  min={1000}
                  max={2100}
                  value={publishedYear}
                  onChange={(e) => setPublishedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono tabular-nums bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Jumlah Halaman
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={pageCount}
                  onChange={(e) => setPageCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono tabular-nums bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Jumlah Eksemplar Daring
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={totalCopies}
                  onChange={(e) => setTotalCopies(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono tabular-nums bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Durasi Peminjaman (Hari)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={loanDurationDays}
                  onChange={(e) => setLoanDurationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono tabular-nums bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Sinopsis Singkat
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Ringkasan isi naskah atau buku..."
                  className="w-full px-3 py-2 rounded-xl text-sm bg-[#FBF8F1] border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={submittingBook || uploadingPdf || !uploadedPdf}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] disabled:opacity-45 transition-colors whitespace-nowrap"
              >
                {submittingBook ? 'Menyimpan ke Katalog...' : 'Publikasikan ke Katalog'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Book Inventory Table */}
      {activeTab === 'books' && (
        <div className="bg-white border border-[#DFD3C3] rounded-2xl overflow-x-auto">
          {books.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-[#6D4C41]">
                Belum ada buku di katalog. Unggah PDF baru atau muat 5 koleksi awal.
              </p>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedCatalog}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
              >
                Muat Koleksi Awal
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#DFD3C3] bg-[#E2F5EC]/45 text-xs text-[#6D4C41]">
                  <th className="py-3 px-4 font-semibold">Buku & Penulis</th>
                  <th className="py-3 px-4 font-semibold">Nomor Induk</th>
                  <th className="py-3 px-4 font-semibold text-right">Halaman</th>
                  <th className="py-3 px-4 font-semibold text-right">Tersedia / Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Durasi</th>
                  <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6D8]">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-[#FBF8F1] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#3E2723]">{book.title}</p>
                      <p className="text-xs text-[#8D6E63]">
                        {book.author} · {book.category}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#5D4037]">
                      {book.accessionNumber}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {book.pageCount} hlm
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {book.availableCopies} / {book.totalCopies}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {book.loanDurationDays} hr
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewPdf(book)}
                          title="Pratinjau PDF"
                          className="px-2.5 py-1.5 rounded-lg text-xs border border-[#DFD3C3] hover:bg-[#E2F5EC] inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Baca
                        </button>
                        <button
                          type="button"
                          disabled={busyBookId === book.id}
                          onClick={() => handleAdjustCopies(book, 1)}
                          title="Tambah 1 eksemplar"
                          className="px-2 py-1.5 rounded-lg text-xs border border-[#DFD3C3] hover:bg-[#FEF3C7]"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          disabled={busyBookId === book.id}
                          onClick={() => handleDeleteBook(book)}
                          aria-label={`Hapus ${book.title}`}
                          className="p-1.5 rounded-lg text-[#C62828] hover:bg-[#C62828]/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Loan Monitoring & Overdue Reminders */}
      {activeTab === 'loans' && (
        <div className="bg-white border border-[#DFD3C3] rounded-2xl overflow-x-auto">
          {loans.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#6D4C41]">
              Belum ada transaksi peminjaman buku daring yang tercatat.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#DFD3C3] bg-[#E2F5EC]/45 text-xs text-[#6D4C41]">
                  <th className="py-3 px-4 font-semibold">Peminjam</th>
                  <th className="py-3 px-4 font-semibold">Judul Buku</th>
                  <th className="py-3 px-4 font-semibold">Jatuh Tempo</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6D8]">
                {loans.map((loan) => {
                  const daysOverdue =
                    loan.status === 'borrowed' ? getDaysOverdue(loan.dueAt) : 0;
                  const daysLeft =
                    loan.status === 'borrowed' ? getDaysRemaining(loan.dueAt) : 0;
                  const isOverdue = loan.status === 'borrowed' && daysOverdue > 0;

                  return (
                    <tr key={loan.id} className="hover:bg-[#FBF8F1] transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#3E2723]">{loan.userName}</p>
                        <p className="text-xs text-[#8D6E63]">{loan.userEmail}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#3E2723]">{loan.bookTitle}</p>
                        <p className="text-xs text-[#8D6E63] font-mono tabular-nums">
                          Progres: Hal. {loan.lastReadPage}/{loan.totalPages}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#5D4037]">
                        {loan.dueAt.toDate().toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {loan.status === 'returned' ? (
                          <span className="inline-flex items-center gap-1.5 text-[#8D6E63]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Dikembalikan
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#C62828]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Terlambat {daysOverdue} hari
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#2B6B53]">
                            <Clock className="w-3.5 h-3.5" />
                            Aktif (sisa {Math.max(0, daysLeft)} hari)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {loan.status === 'borrowed' && (
                          <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyLoanId === loan.id}
                              onClick={() => handleSendReminder(loan)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FEF3C7] text-[#3E2723] hover:bg-[#FDE68A] whitespace-nowrap"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              Kirim Pengingat
                            </button>
                            {!isOverdue && (
                              <button
                                type="button"
                                disabled={busyLoanId === loan.id}
                                onClick={() => handleSimulateOverdue(loan)}
                                title="Uji sistem pengingat keterlambatan dengan menggeser jatuh tempo ke 3 hari lalu"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[#DFD3C3] text-[#5D4037] hover:bg-[#EFE6D8] whitespace-nowrap"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Uji Terlambat
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyLoanId === loan.id}
                              onClick={() => handleAdminReturn(loan)}
                              className="px-2.5 py-1.5 rounded-lg text-xs border border-[#DFD3C3] text-[#3E2723] hover:bg-[#E2F5EC] whitespace-nowrap"
                            >
                              Kembalikan
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

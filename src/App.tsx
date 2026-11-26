import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal, type CustomAuthSession } from './components/AuthModal';
import { BookDetailModal } from './components/BookDetailModal';
import { CoverImage } from './components/CoverImage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PdfReaderModal } from './components/PdfReaderModal';
import { INITIAL_CATALOG_BOOKS } from './data/seedBooks';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './lib/firebase';
import {
  borrowBookAtomic,
  deleteNotificationItem,
  ensureUserDocument,
  fetchServerBooks,
  fetchServerLoans,
  fetchServerNotifications,
  getDaysOverdue,
  getDaysRemaining,
  isAdminEmail,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  returnBookAtomic,
  seedInitialCatalog,
  syncOverdueNotificationsForLoans,
  updateReadingProgress,
} from './services/libraryService';
import type { Book, Loan, NotificationItem } from './types/library';

type ActiveSection = 'catalog' | 'loans' | 'notifications' | 'admin';

const HERO_IMAGE_URL = '/src/assets/images/hero_kicchive_library_1795676519594.jpg';

function KicchiveWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [customSession, setCustomSession] = useState<CustomAuthSession | null>(null);

  const [authModalTab, setAuthModalTab] = useState<'admin' | 'member' | null>(null);

  const [firestoreBooks, setFirestoreBooks] = useState<Book[]>([]);
  const [serverBooks, setServerBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);

  const [firestoreLoans, setFirestoreLoans] = useState<Loan[]>([]);
  const [serverLoans, setServerLoans] = useState<Loan[]>([]);

  const [firestoreNotifications, setFirestoreNotifications] = useState<NotificationItem[]>([]);
  const [serverNotifications, setServerNotifications] = useState<NotificationItem[]>([]);

  const [activeSection, setActiveSection] = useState<ActiveSection>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [readerSession, setReaderSession] = useState<{
    title: string;
    author: string;
    pdfUrl: string;
    initialPage: number;
    loanId?: string;
  } | null>(null);

  const [busyBookId, setBusyBookId] = useState<string | null>(null);
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);

  const isSignedIn = Boolean(customSession || user);
  const isAdmin = Boolean(customSession?.role === 'admin' || (!customSession && isFirebaseAdmin));
  const activeUid = customSession?.uid || user?.uid || '';
  const customToken = customSession?.token || null;

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshServerData = useCallback(async () => {
    const nextBooks = await fetchServerBooks();
    setServerBooks(nextBooks);
    if (customToken) {
      const [nextLoans, nextNotifs] = await Promise.all([
        fetchServerLoans(customToken),
        fetchServerNotifications(customToken),
      ]);
      setServerLoans(nextLoans);
      setServerNotifications(nextNotifs);
    }
  }, [customToken]);

  useEffect(() => {
    testConnection();
    fetchServerBooks()
      .then((list) => setServerBooks(list))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!customToken) {
      setServerLoans([]);
      setServerNotifications([]);
      return;
    }
    refreshServerData().catch(() => undefined);
  }, [customToken, refreshServerData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const adminFlag = await ensureUserDocument(nextUser);
          setIsFirebaseAdmin(adminFlag);
        } catch {
          setIsFirebaseAdmin(isAdminEmail(nextUser.email));
        }
      } else {
        setIsFirebaseAdmin(false);
        setFirestoreLoans([]);
        setFirestoreNotifications([]);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const booksQuery = query(
      collection(db, 'books'),
      where('availableCopies', '>=', 0)
    );
    const unsubscribe = onSnapshot(
      booksQuery,
      (snapshot) => {
        const list: Book[] = snapshot.docs
          .map((docSnap) => ({
            ...(docSnap.data() as Omit<Book, 'id'>),
            id: docSnap.id,
          }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setFirestoreBooks(list);
        setBooksLoading(false);
      },
      (error) => {
        setBooksLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !isFirebaseAdmin || booksLoading || firestoreBooks.length > 0) return;
    seedInitialCatalog(user.uid).catch(() => undefined);
  }, [authReady, user, isFirebaseAdmin, booksLoading, firestoreBooks.length]);

  useEffect(() => {
    if (!authReady || !user) return;
    const loansQuery = isFirebaseAdmin
      ? query(collection(db, 'loans'))
      : query(collection(db, 'loans'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      loansQuery,
      (snapshot) => {
        const list: Loan[] = snapshot.docs
          .map((docSnap) => ({
            ...(docSnap.data() as Omit<Loan, 'id'>),
            id: docSnap.id,
          }))
          .sort((a, b) => (b.borrowedAt?.toMillis?.() ?? 0) - (a.borrowedAt?.toMillis?.() ?? 0));
        setFirestoreLoans(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'loans');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, isFirebaseAdmin]);

  useEffect(() => {
    if (!authReady || !user) return;
    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const list: NotificationItem[] = snapshot.docs
          .map((docSnap) => ({
            ...(docSnap.data() as Omit<NotificationItem, 'id'>),
            id: docSnap.id,
          }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setFirestoreNotifications(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );
    return () => unsubscribe();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || firestoreLoans.length === 0) return;
    syncOverdueNotificationsForLoans(firestoreLoans, firestoreNotifications, user.uid).catch(
      () => undefined
    );
  }, [authReady, user, firestoreLoans, firestoreNotifications]);

  // Unified catalog: combine server-persisted books + Firestore books + curated initial preview
  const catalogBooks = useMemo(() => {
    if (customToken) {
      return serverBooks.length > 0 ? serverBooks : INITIAL_CATALOG_BOOKS;
    }
    if (firestoreBooks.length > 0 && serverBooks.length > 0) {
      const merged = new Map<string, Book>();
      for (const b of serverBooks) merged.set(b.id, b);
      for (const b of firestoreBooks) merged.set(b.id, b);
      return Array.from(merged.values()).sort(
        (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
    }
    if (firestoreBooks.length > 0) return firestoreBooks;
    if (serverBooks.length > 0) return serverBooks;
    return INITIAL_CATALOG_BOOKS;
  }, [customToken, serverBooks, firestoreBooks]);

  const loans = customToken ? serverLoans : firestoreLoans;
  const notifications = customToken ? serverNotifications : firestoreNotifications;

  const myLoans = useMemo(() => {
    if (!activeUid) return [];
    return loans.filter((l) => l.userId === activeUid);
  }, [loans, activeUid]);

  const myActiveLoans = useMemo(
    () => myLoans.filter((l) => l.status === 'borrowed'),
    [myLoans]
  );

  const myOverdueLoans = useMemo(
    () => myActiveLoans.filter((l) => l.dueAt.toMillis() < Date.now()),
    [myActiveLoans]
  );

  const myReturnedLoans = useMemo(
    () => myLoans.filter((l) => l.status === 'returned'),
    [myLoans]
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const categories = useMemo(() => {
    const set = new Set<string>(['Semua']);
    for (const book of catalogBooks) {
      set.add(book.category);
    }
    return Array.from(set);
  }, [catalogBooks]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogBooks.filter((book) => {
      if (selectedCategory !== 'Semua' && book.category !== selectedCategory) return false;
      if (onlyAvailable && book.availableCopies < 1) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        book.accessionNumber.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q)
      );
    });
  }, [catalogBooks, searchQuery, selectedCategory, onlyAvailable]);

  const totalAvailableCopies = useMemo(
    () => catalogBooks.reduce((sum, b) => sum + b.availableCopies, 0),
    [catalogBooks]
  );

  async function handleGoogleSignIn() {
    try {
      await signInWithPopup(auth, googleProvider);
      setCustomSession(null);
      showToast('Berhasil masuk ke perpustakaan digital Kicchive.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Proses masuk Google dibatalkan atau gagal.',
        true
      );
    }
  }

  function handleCustomSessionLogin(session: CustomAuthSession) {
    setCustomSession(session);
    if (session.role === 'admin') {
      setActiveSection('admin');
      showToast(`Selamat datang di Dasbor Admin, ${session.name}.`);
    } else {
      showToast(`Halo ${session.name}, Anda siap meminjam buku daring.`);
    }
  }

  async function handleSignOut() {
    setCustomSession(null);
    if (user) {
      await signOut(auth);
    }
    setActiveSection('catalog');
    showToast('Anda telah keluar dari sesi Kicchive.');
  }

  async function handleBorrowBook(book: Book) {
    if (!isSignedIn) {
      setAuthModalTab('member');
      return;
    }

    if (!customToken && firestoreBooks.length === 0) {
      handleOpenReader(book);
      showToast(
        'Membuka pembaca PDF langsung. Masuk sebagai Admin satu kali untuk mengaktifkan pencatatan peminjaman cloud.'
      );
      return;
    }

    const existingActive = myActiveLoans.find((l) => l.bookId === book.id);
    if (existingActive) {
      setDetailBook(null);
      setReaderSession({
        title: book.title,
        author: book.author,
        pdfUrl: book.pdfUrl,
        initialPage: existingActive.lastReadPage,
        loanId: existingActive.id,
      });
      return;
    }

    setBusyBookId(book.id);
    try {
      const loanId = await borrowBookAtomic(book, user, customToken);
      await refreshServerData();
      showToast(
        `Berhasil meminjam "${book.title}". Batas pengembalian ${book.loanDurationDays} hari.`
      );
      setDetailBook(null);
      setReaderSession({
        title: book.title,
        author: book.author,
        pdfUrl: book.pdfUrl,
        initialPage: 1,
        loanId,
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal meminjam buku.',
        true
      );
    } finally {
      setBusyBookId(null);
    }
  }

  async function handleReturnLoan(loan: Loan) {
    setBusyLoanId(loan.id);
    try {
      const targetBook = catalogBooks.find((b) => b.id === loan.bookId);
      await returnBookAtomic(loan, targetBook, customToken);
      await refreshServerData();
      showToast(`Buku "${loan.bookTitle}" telah dikembalikan. Terima kasih.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal mengembalikan buku.',
        true
      );
    } finally {
      setBusyLoanId(null);
    }
  }

  function handleOpenReader(book: Book, loan?: Loan) {
    setDetailBook(null);
    setReaderSession({
      title: book.title,
      author: book.author,
      pdfUrl: book.pdfUrl,
      initialPage: loan?.lastReadPage || 1,
      loanId: loan?.id,
    });
  }

  const handleReaderPageChange = useCallback(
    (page: number) => {
      if (readerSession?.loanId) {
        updateReadingProgress(readerSession.loanId, page, customToken).catch(() => undefined);
      }
    },
    [readerSession?.loanId, customToken]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF8F1] text-[#3E2723]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FBF8F1]/95 backdrop-blur-sm border-b border-[#DFD3C3]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveSection('catalog')}
            className="font-display text-2xl font-bold tracking-tight text-[#3E2723] whitespace-nowrap shrink-0"
          >
            Kicchive
          </button>

          {/* Zone 2: Concise single-line text navigation links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#6D4C41]"
          >
            <button
              type="button"
              onClick={() => setActiveSection('catalog')}
              className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                activeSection === 'catalog'
                  ? 'text-[#3E2723] border-b-2 border-[#68B998]'
                  : 'hover:text-[#3E2723]'
              }`}
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('loans')}
              className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                activeSection === 'loans'
                  ? 'text-[#3E2723] border-b-2 border-[#68B998]'
                  : 'hover:text-[#3E2723]'
              }`}
            >
              {myActiveLoans.length > 0
                ? `Pinjaman Saya (${myActiveLoans.length})`
                : 'Pinjaman Saya'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('notifications')}
              className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                activeSection === 'notifications'
                  ? 'text-[#3E2723] border-b-2 border-[#68B998]'
                  : 'hover:text-[#3E2723]'
              }`}
            >
              {unreadNotifCount > 0 ? `Notifikasi (${unreadNotifCount})` : 'Notifikasi'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setActiveSection('admin');
                } else {
                  setAuthModalTab('admin');
                }
              }}
              className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                activeSection === 'admin'
                  ? 'text-[#3E2723] border-b-2 border-[#68B998]'
                  : 'hover:text-[#3E2723]'
              }`}
            >
              Dasbor Admin
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#4E342E] text-[#FFFDF8] hover:bg-[#3E2723] transition-colors whitespace-nowrap shrink-0"
              >
                Keluar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalTab('admin')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] transition-colors whitespace-nowrap shrink-0"
              >
                Masuk
              </button>
            )}
          </div>
        </div>

        {/* Mobile compact nav row */}
        <div className="md:hidden border-t border-[#DFD3C3] px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-semibold text-[#6D4C41]">
          <button
            type="button"
            onClick={() => setActiveSection('catalog')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'catalog'
                ? 'text-[#3E2723] underline decoration-[#68B998] decoration-2'
                : ''
            }`}
          >
            Katalog
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('loans')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'loans'
                ? 'text-[#3E2723] underline decoration-[#68B998] decoration-2'
                : ''
            }`}
          >
            Pinjaman ({myActiveLoans.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('notifications')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'notifications'
                ? 'text-[#3E2723] underline decoration-[#68B998] decoration-2'
                : ''
            }`}
          >
            Notifikasi ({unreadNotifCount})
          </button>
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setActiveSection('admin');
              } else {
                setAuthModalTab('admin');
              }
            }}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'admin'
                ? 'text-[#3E2723] underline decoration-[#68B998] decoration-2'
                : ''
            }`}
          >
            Dasbor Admin
          </button>
        </div>
      </header>

      {/* Overdue Return Alert Banner */}
      {isSignedIn && myOverdueLoans.length > 0 && (
        <div className="bg-[#FEF3C7] border-b border-[#FDE68A] text-[#3E2723] px-6 py-2.5 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-[#B91C1C]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Peringatan keterlambatan: Anda memiliki {myOverdueLoans.length} buku yang telah
                melewati tanggal pengembalian.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('loans')}
              className="underline font-semibold text-[#3E2723] whitespace-nowrap shrink-0 hover:text-[#6D4C41]"
            >
              Lihat & Kembalikan Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback Banner */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-40 max-w-md px-4 py-3 rounded-xl text-xs font-semibold shadow-lg border ${
            toast.isError
              ? 'bg-white border-[#C62828] text-[#C62828]'
              : 'bg-[#4E342E] border-[#4E342E] text-[#FFFDF8]'
          }`}
        >
          {toast.text}
        </div>
      )}

      <main className="flex-1">
        {/* SECTION 1: CATALOG */}
        {activeSection === 'catalog' && (
          <>
            {/* Editorial Marquee Hero (2-column balanced split) */}
            <section className="max-w-7xl mx-auto px-6 pt-10 pb-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between bg-[#E2F5EC]/75 border border-[#BCE3D3] rounded-3xl p-8 sm:p-10">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold tracking-wider text-[#5D4037]">
                      Perpustakaan Digital Kicchive · Ruang Baca Daring
                    </p>
                    <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#3E2723] leading-[1.12] text-balance">
                      Pinjam dan baca buku pilihan dengan nyaman dari layar Anda.
                    </h1>
                    <p className="text-sm sm:text-base text-[#5D4037] leading-relaxed max-w-xl">
                      Kicchive menghadirkan koleksi monograf arsitektur, ekologi, desain, filsafat,
                      dan sejarah dalam format PDF jernih lengkap dengan pengingat pengembalian
                      otomatis.
                    </p>
                  </div>

                  <div className="pt-8 flex flex-wrap items-center gap-3">
                    <a
                      href="#koleksi-buku"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#4E342E] text-[#FFFDF8] hover:bg-[#3E2723] transition-colors whitespace-nowrap"
                    >
                      Jelajahi Koleksi
                      <ArrowRight className="w-4 h-4" />
                    </a>
                    {isSignedIn ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection('loans')}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#3E2723] hover:bg-[#FDE68A] transition-colors whitespace-nowrap"
                      >
                        Pinjaman Saya ({myActiveLoans.length})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAuthModalTab('admin')}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#3E2723] hover:bg-[#FDE68A] transition-colors whitespace-nowrap"
                      >
                        Masuk Admin / Anggota
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[280px] lg:min-h-[400px] rounded-3xl border border-[#DFD3C3] overflow-hidden bg-[#EFE6D8]">
                  <CoverImage
                    src={HERO_IMAGE_URL}
                    alt="Ruang baca perpustakaan digital Kicchive dengan meja travertine dan rak kayu ek"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Operational Utility Strip (4 columns below hero split) */}
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-[#DFD3C3] bg-white divide-y lg:divide-y-0 lg:divide-x divide-[#DFD3C3] overflow-hidden">
                <div className="px-5 py-4">
                  <p className="text-xs text-[#8D6E63]">Koleksi Terpublikasi</p>
                  <p className="text-lg font-mono tabular-nums font-semibold text-[#3E2723] mt-0.5">
                    {catalogBooks.length} Judul
                  </p>
                </div>
                <div className="px-5 py-4 bg-[#E2F5EC]/35">
                  <p className="text-xs text-[#6D4C41]">Eksemplar Tersedia</p>
                  <p className="text-lg font-mono tabular-nums font-semibold text-[#2B6B53] mt-0.5">
                    {totalAvailableCopies} Unit
                  </p>
                </div>
                <div className="px-5 py-4 bg-[#FEF3C7]/45">
                  <p className="text-xs text-[#6D4C41]">Akses Pembaca</p>
                  <p className="text-lg font-display font-semibold text-[#3E2723] mt-0.5">
                    PDF Dalam Aplikasi
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-[#8D6E63]">Pengingat Keterlambatan</p>
                  <p className="text-lg font-display font-semibold text-[#3E2723] mt-0.5">
                    Notifikasi Otomatis
                  </p>
                </div>
              </div>
            </section>

            {/* Search & Filter Toolbar */}
            <section id="koleksi-buku" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#DFD3C3] pb-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-[#4E342E] text-[#FFFDF8]'
                          : 'bg-[#EFE6D8] text-[#5D4037] hover:bg-[#E2F5EC] hover:text-[#3E2723]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-[#8D6E63] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari judul, penulis, atau ISBN..."
                      aria-label="Cari katalog buku"
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyAvailable((v) => !v)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      onlyAvailable
                        ? 'border-[#9CE0C2] bg-[#E2F5EC] text-[#3E2723]'
                        : 'border-[#DFD3C3] bg-white text-[#6D4C41] hover:text-[#3E2723]'
                    }`}
                  >
                    Hanya Tersedia
                  </button>
                </div>
              </div>

              {/* Catalog Grid */}
              {booksLoading && catalogBooks.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-[#DFD3C3] rounded-2xl p-4 space-y-3 animate-pulse"
                    >
                      <div className="aspect-[3/4] rounded-xl bg-[#EFE6D8]" />
                      <div className="h-4 bg-[#EFE6D8] rounded w-3/4" />
                      <div className="h-3 bg-[#EFE6D8] rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="bg-white border border-[#DFD3C3] rounded-2xl p-12 text-center space-y-3">
                  <h2 className="font-display text-2xl font-semibold text-[#3E2723]">
                    Tidak ada buku yang sesuai pencarian
                  </h2>
                  <p className="text-sm text-[#6D4C41] max-w-md mx-auto">
                    Coba ubah kata kunci pencarian atau pilih kategori lain.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredBooks.map((book) => {
                    const activeLoan = myActiveLoans.find((l) => l.bookId === book.id);
                    return (
                      <article
                        key={book.id}
                        className="bg-white border border-[#DFD3C3] rounded-2xl overflow-hidden flex flex-col justify-between transition-colors hover:border-[#6D4C41]"
                      >
                        <div>
                          <button
                            type="button"
                            onClick={() => setDetailBook(book)}
                            className="w-full aspect-[3/4] bg-[#E2F5EC]/40 overflow-hidden border-b border-[#EFE6D8] block text-left group"
                          >
                            <CoverImage
                              src={book.coverUrl}
                              alt={`Sampul ${book.title}`}
                              title={book.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                          </button>

                          <div className="p-5 space-y-2">
                            <p className="text-xs text-[#8D6E63] truncate">
                              {book.category} · {book.publishedYear} · {book.pageCount} hlm
                            </p>
                            <h3 className="font-display text-xl font-semibold text-[#3E2723] leading-snug line-clamp-2">
                              <button
                                type="button"
                                onClick={() => setDetailBook(book)}
                                className="text-left hover:text-[#2B6B53] transition-colors"
                              >
                                {book.title}
                              </button>
                            </h3>
                            <p className="text-xs text-[#6D4C41] truncate">{book.author}</p>
                          </div>
                        </div>

                        <div className="px-5 pb-5 pt-3 border-t border-[#F3ECE1] flex items-center justify-between gap-2">
                          <span className="text-xs font-mono tabular-nums text-[#6D4C41]">
                            {book.availableCopies}/{book.totalCopies} stok
                          </span>

                          {activeLoan || !isSignedIn ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReader(book, activeLoan)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] transition-colors whitespace-nowrap"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Baca PDF
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyBookId === book.id || book.availableCopies < 1}
                              onClick={() => handleBorrowBook(book)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#3E2723] hover:bg-[#FDE68A] disabled:opacity-45 transition-colors whitespace-nowrap"
                            >
                              {busyBookId === book.id
                                ? 'Memproses...'
                                : book.availableCopies > 0
                                  ? 'Pinjam & Baca'
                                  : 'Habis'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* SECTION 2: MY LOANS */}
        {activeSection === 'loans' && (
          <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
            <div className="border-b border-[#DFD3C3] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#8D6E63]">
                  Rak Pinjaman Pribadi
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-1">
                  Pinjaman Saya
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('catalog')}
                className="text-xs font-semibold text-[#4E342E] hover:underline whitespace-nowrap"
              >
                Kembali ke Katalog Buku
              </button>
            </div>

            {!isSignedIn ? (
              <div className="bg-white border border-[#DFD3C3] rounded-2xl p-12 text-center space-y-4">
                <h2 className="font-display text-2xl font-semibold">
                  Masuk untuk melihat daftar pinjaman Anda
                </h2>
                <p className="text-sm text-[#6D4C41] max-w-md mx-auto">
                  Anda dapat masuk cepat pakai nama (tanpa Google) atau akun Google untuk meminjam
                  buku daring, menyimpan progres halaman, dan menerima pengingat pengembalian.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalTab('member')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
                >
                  Masuk sebagai Anggota
                </button>
              </div>
            ) : myActiveLoans.length === 0 && myReturnedLoans.length === 0 ? (
              <div className="bg-white border border-[#DFD3C3] rounded-2xl p-12 text-center space-y-4">
                <h2 className="font-display text-2xl font-semibold">
                  Belum ada buku yang sedang dipinjam
                </h2>
                <p className="text-sm text-[#6D4C41]">
                  Jelajahi katalog Kicchive untuk meminjam dan membaca PDF langsung di aplikasi.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('catalog')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
                >
                  Jelajahi Katalog
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="space-y-4">
                  <h2 className="font-display text-2xl font-semibold text-[#3E2723]">
                    Sedang Dipinjam ({myActiveLoans.length})
                  </h2>
                  {myActiveLoans.length === 0 ? (
                    <p className="text-sm text-[#6D4C41]">
                      Semua buku yang pernah Anda pinjam sudah dikembalikan.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {myActiveLoans.map((loan) => {
                        const daysOverdue = getDaysOverdue(loan.dueAt);
                        const daysLeft = getDaysRemaining(loan.dueAt);
                        const isOverdue = daysOverdue > 0;
                        const progressPct = Math.min(
                          100,
                          Math.round((loan.lastReadPage / Math.max(1, loan.totalPages)) * 100)
                        );

                        return (
                          <div
                            key={loan.id}
                            className="bg-white border border-[#DFD3C3] rounded-2xl p-5 flex gap-5"
                          >
                            <div className="w-24 aspect-[3/4] shrink-0 rounded-xl bg-[#E2F5EC]/50 border border-[#DFD3C3] overflow-hidden">
                              <CoverImage
                                src={loan.bookCoverUrl}
                                alt={`Sampul ${loan.bookTitle}`}
                                title={loan.bookTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex items-center gap-1.5 text-xs mb-1">
                                  {isOverdue ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#C62828]">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      Terlambat {daysOverdue} hari
                                    </span>
                                  ) : daysLeft <= 2 ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#B45309]">
                                      <Clock className="w-3.5 h-3.5" />
                                      Jatuh tempo {daysLeft} hari lagi
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#2B6B53]">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Aktif · Sisa {daysLeft} hari
                                    </span>
                                  )}
                                </div>

                                <h3 className="font-display text-xl font-semibold text-[#3E2723] leading-snug truncate">
                                  {loan.bookTitle}
                                </h3>
                                <p className="text-xs text-[#8D6E63] truncate">
                                  {loan.bookAuthor} · Batas:{' '}
                                  <span className="font-mono tabular-nums">
                                    {loan.dueAt.toDate().toLocaleDateString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </p>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-[#6D4C41] font-mono tabular-nums">
                                  <span>
                                    Hal. {loan.lastReadPage} / {loan.totalPages}
                                  </span>
                                  <span>{progressPct}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[#EFE6D8] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#68B998] transition-all"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReaderSession({
                                      title: loan.bookTitle,
                                      author: loan.bookAuthor,
                                      pdfUrl: loan.pdfUrl,
                                      initialPage: loan.lastReadPage,
                                      loanId: loan.id,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] whitespace-nowrap"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  Baca PDF
                                </button>
                                <button
                                  type="button"
                                  disabled={busyLoanId === loan.id}
                                  onClick={() => handleReturnLoan(loan)}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-[#DFD3C3] text-[#3E2723] hover:bg-[#FEF3C7] disabled:opacity-50 whitespace-nowrap"
                                >
                                  {busyLoanId === loan.id ? 'Memproses...' : 'Kembalikan Buku'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {myReturnedLoans.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="font-display text-2xl font-semibold text-[#3E2723]">
                      Riwayat Pengembalian ({myReturnedLoans.length})
                    </h2>
                    <div className="bg-white border border-[#DFD3C3] rounded-2xl divide-y divide-[#EFE6D8] overflow-hidden">
                      {myReturnedLoans.map((loan) => (
                        <div
                          key={loan.id}
                          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-[#3E2723]">{loan.bookTitle}</p>
                            <p className="text-xs text-[#8D6E63]">{loan.bookAuthor}</p>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-[#6D4C41]">
                            Dikembalikan{' '}
                            {loan.returnedAt
                              ? loan.returnedAt.toDate().toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* SECTION 3: NOTIFICATIONS (OVERDUE REMINDERS) */}
        {activeSection === 'notifications' && (
          <section className="max-w-4xl mx-auto px-6 py-10 space-y-6">
            <div className="border-b border-[#DFD3C3] pb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#8D6E63]">
                  Pusat Pemberitahuan
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-1">
                  Notifikasi & Pengingat Pengembalian
                </h1>
              </div>

              {isSignedIn && unreadNotifCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await markAllNotificationsAsRead(notifications, customToken);
                    await refreshServerData();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#DFD3C3] bg-white hover:bg-[#E2F5EC] whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  Tandai Semua Dibaca
                </button>
              )}
            </div>

            {!isSignedIn ? (
              <div className="bg-white border border-[#DFD3C3] rounded-2xl p-12 text-center space-y-4">
                <Bell className="w-8 h-8 mx-auto text-[#8D6E63]" strokeWidth={1.75} />
                <h2 className="font-display text-2xl font-semibold">
                  Masuk untuk melihat pengingat pengembalian buku
                </h2>
                <button
                  type="button"
                  onClick={() => setAuthModalTab('member')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
                >
                  Masuk sebagai Anggota
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="bg-white border border-[#DFD3C3] rounded-2xl p-12 text-center space-y-2">
                <Bell className="w-7 h-7 mx-auto text-[#8D6E63]" strokeWidth={1.75} />
                <h2 className="font-display text-2xl font-semibold">Tidak ada notifikasi baru</h2>
                <p className="text-sm text-[#6D4C41]">
                  Pengingat otomatis akan muncul di sini apabila ada buku yang mendekati atau
                  melewati batas pengembalian.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#DFD3C3] rounded-2xl divide-y divide-[#EFE6D8] overflow-hidden">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      notif.isRead ? 'bg-white' : 'bg-[#E2F5EC]/40'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        {notif.type === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#C62828]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Terlambat {notif.daysOverdue} hari
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#2B6B53]">
                            <Bell className="w-3.5 h-3.5" />
                            Pengingat Perpustakaan
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="text-[#8D6E63] font-mono tabular-nums">
                          {notif.createdAt
                            ? notif.createdAt.toDate().toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Baru saja'}
                        </span>
                        {!notif.isRead && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#4E342E]">Belum dibaca</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold text-[#3E2723]">
                        {notif.title}
                      </h3>
                      <p className="text-sm text-[#5D4037] leading-relaxed">{notif.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveSection('loans')}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] whitespace-nowrap"
                      >
                        Buka Pinjaman
                      </button>
                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={async () => {
                            await markNotificationAsRead(notif.id, customToken);
                            await refreshServerData();
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#DFD3C3] hover:bg-[#FEF3C7] whitespace-nowrap"
                        >
                          Dibaca
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteNotificationItem(notif.id, customToken);
                          await refreshServerData();
                        }}
                        aria-label="Hapus notifikasi"
                        className="p-1.5 rounded-lg text-[#8D6E63] hover:text-[#C62828]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 4: ADMIN DASHBOARD */}
        {activeSection === 'admin' && (
          <>
            {isSignedIn && isAdmin ? (
              <AdminDashboard
                adminUid={activeUid}
                customToken={customToken}
                books={catalogBooks}
                loans={loans}
                onDataMutated={refreshServerData}
                onPreviewPdf={(book) => handleOpenReader(book)}
                onStatusMessage={showToast}
              />
            ) : (
              <section className="max-w-xl mx-auto px-6 py-16 text-center space-y-4">
                <h1 className="font-display text-3xl font-semibold">
                  Masuk ke Dasbor Admin Kicchive
                </h1>
                <p className="text-sm text-[#6D4C41]">
                  Gunakan frasa akses admin (tanpa Google) untuk mengunggah berkas PDF, mengelola
                  koleksi, dan mengirim pengingat pengembalian.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthModalTab('admin')}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1]"
                  >
                    Masuk Admin (Frasa Akses)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('catalog')}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#4E342E] text-[#FFFDF8]"
                  >
                    Kembali ke Katalog
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#DFD3C3] bg-[#E2F5EC]/50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6D4C41]">
          <p className="font-display text-lg font-bold text-[#3E2723]">Kicchive</p>
          <p>
            Perpustakaan Digital Terkurasi · Peminjaman Daring & Pembaca PDF Dalam Aplikasi
          </p>
        </div>
      </footer>

      {/* Auth Modal (Admin Passphrase / Member Session / Google) */}
      {authModalTab && (
        <AuthModal
          initialTab={authModalTab}
          onCustomSession={handleCustomSessionLogin}
          onGoogleSignIn={handleGoogleSignIn}
          onClose={() => setAuthModalTab(null)}
        />
      )}

      {/* Book Detail Modal */}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          activeLoan={myActiveLoans.find((l) => l.bookId === detailBook.id)}
          isSignedIn={isSignedIn}
          isBorrowing={busyBookId === detailBook.id}
          onBorrow={handleBorrowBook}
          onRead={handleOpenReader}
          onSignIn={() => {
            setDetailBook(null);
            setAuthModalTab('member');
          }}
          onClose={() => setDetailBook(null)}
        />
      )}

      {/* In-App PDF Reader */}
      {readerSession && (
        <PdfReaderModal
          title={readerSession.title}
          author={readerSession.author}
          pdfUrl={readerSession.pdfUrl}
          initialPage={readerSession.initialPage}
          onPageChange={handleReaderPageChange}
          onClose={() => setReaderSession(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <KicchiveWorkspace />
    </ErrorBoundary>
  );
}

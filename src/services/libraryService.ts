import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { SEED_BOOKS } from '../data/seedBooks';
import {
  FIELD_LIMITS,
  type Book,
  type Loan,
  type NotificationItem,
  type UploadedPdfResult,
} from '../types/library';

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase());
}

interface ServerBookDto {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  accessionNumber: string;
  publishedYear: number;
  pageCount: number;
  synopsis: string;
  coverUrl: string;
  pdfUrl: string;
  fileName: string;
  fileSizeBytes: number;
  totalCopies: number;
  availableCopies: number;
  loanDurationDays: number;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

interface ServerLoanDto {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string;
  pdfUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'borrowed' | 'returned';
  borrowedAtMs: number;
  dueAtMs: number;
  returnedAtMs?: number;
  lastReadPage: number;
  totalPages: number;
  overdueNotified: boolean;
  updatedAtMs: number;
}

interface ServerNotificationDto {
  id: string;
  userId: string;
  loanId: string;
  bookId: string;
  bookTitle: string;
  type: 'overdue' | 'due_soon' | 'admin_reminder' | 'returned';
  title: string;
  message: string;
  daysOverdue: number;
  isRead: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

function mapServerBook(b: ServerBookDto): Book {
  return {
    ...b,
    createdAt: Timestamp.fromMillis(b.createdAtMs),
    updatedAt: Timestamp.fromMillis(b.updatedAtMs),
  };
}

function mapServerLoan(l: ServerLoanDto): Loan {
  return {
    ...l,
    borrowedAt: Timestamp.fromMillis(l.borrowedAtMs),
    dueAt: Timestamp.fromMillis(l.dueAtMs),
    returnedAt: l.returnedAtMs ? Timestamp.fromMillis(l.returnedAtMs) : undefined,
    updatedAt: Timestamp.fromMillis(l.updatedAtMs),
  };
}

function mapServerNotification(n: ServerNotificationDto): NotificationItem {
  return {
    ...n,
    createdAt: Timestamp.fromMillis(n.createdAtMs),
    updatedAt: Timestamp.fromMillis(n.updatedAtMs),
  };
}

export async function fetchServerBooks(): Promise<Book[]> {
  const res = await fetch('/api/books');
  if (!res.ok) return [];
  const data = (await res.json()) as { books?: ServerBookDto[] };
  return (data.books || []).map(mapServerBook);
}

export async function fetchServerLoans(customToken: string): Promise<Loan[]> {
  const res = await fetch('/api/loans', {
    headers: { Authorization: `Bearer ${customToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { loans?: ServerLoanDto[] };
  return (data.loans || []).map(mapServerLoan);
}

export async function fetchServerNotifications(customToken: string): Promise<NotificationItem[]> {
  const res = await fetch('/api/notifications', {
    headers: { Authorization: `Bearer ${customToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { notifications?: ServerNotificationDto[] };
  return (data.notifications || []).map(mapServerNotification);
}

export async function ensureUserDocument(user: User): Promise<boolean> {
  const userRef = doc(db, 'users', user.uid);
  const isBootAdmin = isAdminEmail(user.email) && user.emailVerified;
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Pembaca Kicchive').slice(
    0,
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );
  const email = (user.email || 'anggota@kicchive.local').slice(0, 200);

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName,
        email,
        role: isBootAdmin ? 'admin' : 'member',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        payload.photoURL = user.photoURL.slice(0, FIELD_LIMITS.URL_MAX);
      }
      await setDoc(userRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        updatePayload.photoURL = user.photoURL.slice(0, FIELD_LIMITS.URL_MAX);
      }
      await updateDoc(userRef, updatePayload);
    }

    if (isBootAdmin) {
      const adminRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email,
          displayName,
          createdAt: serverTimestamp(),
        });
      }
    }

    return isBootAdmin;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function seedInitialCatalog(adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  for (const item of SEED_BOOKS) {
    const bookRef = doc(db, 'books', item.id);
    batch.set(bookRef, {
      ...item,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'books');
  }
}

export async function uploadPdfFile(
  file: File,
  customToken?: string | null
): Promise<UploadedPdfResult> {
  let token = customToken || '';
  if (!token) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Silakan masuk sebagai admin terlebih dahulu untuk mengunggah berkas PDF.');
    }
    token = await currentUser.getIdToken();
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/uploads/pdf', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = (await response.json()) as UploadedPdfResult & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Gagal mengunggah berkas PDF ke server.');
  }
  return data;
}

export interface CreateBookInput {
  title: string;
  author: string;
  category: string;
  isbn: string;
  accessionNumber: string;
  publishedYear: number;
  pageCount: number;
  synopsis: string;
  coverUrl: string;
  pdfUrl: string;
  fileName: string;
  fileSizeBytes: number;
  totalCopies: number;
  loanDurationDays: number;
  createdBy: string;
}

export async function createBookRecord(
  input: CreateBookInput,
  customToken?: string | null
): Promise<string> {
  if (customToken) {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { book?: ServerBookDto; error?: string };
    if (!res.ok || !data.book) {
      throw new Error(data.error || 'Gagal menambahkan buku ke katalog.');
    }
    return data.book.id;
  }

  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'buku';
  const bookId = `kcv-${slug}-${Date.now().toString(36)}`;
  const bookRef = doc(db, 'books', bookId);

  try {
    await setDoc(bookRef, {
      id: bookId,
      title: input.title.trim().slice(0, FIELD_LIMITS.TITLE_MAX),
      author: input.author.trim().slice(0, FIELD_LIMITS.AUTHOR_MAX),
      category: input.category.trim().slice(0, FIELD_LIMITS.CATEGORY_MAX),
      isbn: input.isbn.trim().slice(0, FIELD_LIMITS.ISBN_MAX),
      accessionNumber: input.accessionNumber.trim().slice(0, FIELD_LIMITS.ACCESSION_MAX),
      publishedYear: Math.max(1000, Math.min(2100, Math.round(input.publishedYear))),
      pageCount: Math.max(1, Math.min(10000, Math.round(input.pageCount))),
      synopsis: input.synopsis.trim().slice(0, FIELD_LIMITS.SYNOPSIS_MAX),
      coverUrl: input.coverUrl.trim().slice(0, FIELD_LIMITS.URL_MAX),
      pdfUrl: input.pdfUrl.trim().slice(0, FIELD_LIMITS.URL_MAX),
      fileName: input.fileName.trim().slice(0, FIELD_LIMITS.FILENAME_MAX),
      fileSizeBytes: Math.max(1, Math.round(input.fileSizeBytes)),
      totalCopies: Math.max(1, Math.min(500, Math.round(input.totalCopies))),
      availableCopies: Math.max(1, Math.min(500, Math.round(input.totalCopies))),
      loanDurationDays: Math.max(1, Math.min(60, Math.round(input.loanDurationDays))),
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return bookId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `books/${bookId}`);
  }
}

export async function updateBookCopiesAndDuration(
  book: Book,
  totalCopies: number,
  loanDurationDays: number,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ totalCopies, loanDurationDays }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui stok buku.');
    return;
  }

  const safeTotal = Math.max(1, Math.min(500, Math.round(totalCopies)));
  const borrowedCount = Math.max(0, book.totalCopies - book.availableCopies);
  const safeAvailable = Math.max(0, Math.min(safeTotal, safeTotal - borrowedCount));
  const safeDays = Math.max(1, Math.min(60, Math.round(loanDurationDays)));

  try {
    await updateDoc(doc(db, 'books', book.id), {
      totalCopies: safeTotal,
      availableCopies: safeAvailable,
      loanDurationDays: safeDays,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `books/${book.id}`);
  }
}

export async function deleteBookRecord(
  bookId: string,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    const res = await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customToken}` },
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus buku.');
    return;
  }

  try {
    await deleteDoc(doc(db, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `books/${bookId}`);
  }
}

export async function borrowBookAtomic(
  book: Book,
  user: User | null,
  customToken?: string | null
): Promise<string> {
  if (customToken) {
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ bookId: book.id }),
    });
    const data = (await res.json()) as { loan?: ServerLoanDto; error?: string };
    if (!res.ok || !data.loan) {
      throw new Error(data.error || 'Gagal meminjam buku.');
    }
    return data.loan.id;
  }

  if (!user) {
    throw new Error('Silakan masuk terlebih dahulu untuk meminjam buku.');
  }
  if (book.availableCopies < 1) {
    throw new Error('Semua eksemplar buku ini sedang dipinjam.');
  }

  const loanRef = doc(collection(db, 'loans'));
  const bookRef = doc(db, 'books', book.id);
  const dueDate = new Date(Date.now() + book.loanDurationDays * 24 * 60 * 60 * 1000);

  const batch = writeBatch(db);
  batch.set(loanRef, {
    bookId: book.id,
    bookTitle: book.title.slice(0, FIELD_LIMITS.TITLE_MAX),
    bookAuthor: book.author.slice(0, FIELD_LIMITS.AUTHOR_MAX),
    bookCoverUrl: book.coverUrl.slice(0, FIELD_LIMITS.URL_MAX),
    pdfUrl: book.pdfUrl.slice(0, FIELD_LIMITS.URL_MAX),
    userId: user.uid,
    userName: (user.displayName || user.email?.split('@')[0] || 'Pembaca').slice(
      0,
      FIELD_LIMITS.DISPLAY_NAME_MAX
    ),
    userEmail: (user.email || 'anggota@kicchive.local').slice(0, 200),
    status: 'borrowed',
    borrowedAt: serverTimestamp(),
    dueAt: Timestamp.fromDate(dueDate),
    lastReadPage: 1,
    totalPages: Math.max(1, book.pageCount),
    overdueNotified: false,
    updatedAt: serverTimestamp(),
  });

  batch.update(bookRef, {
    availableCopies: book.availableCopies - 1,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return loanRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `loans/${loanRef.id}`);
  }
}

export async function returnBookAtomic(
  loan: Loan,
  book?: Book,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ action: 'return' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Gagal mengembalikan buku.');
    return;
  }

  const loanRef = doc(db, 'loans', loan.id);
  const bookRef = doc(db, 'books', loan.bookId);

  const batch = writeBatch(db);
  batch.update(loanRef, {
    status: 'returned',
    returnedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (book) {
    const nextAvailable = Math.min(book.totalCopies, book.availableCopies + 1);
    batch.update(bookRef, {
      availableCopies: nextAvailable,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `loans/${loan.id}`);
  }
}

export async function updateReadingProgress(
  loanId: string,
  page: number,
  customToken?: string | null
): Promise<void> {
  const safePage = Math.max(1, Math.min(10000, Math.round(page)));
  if (customToken) {
    await fetch(`/api/loans/${encodeURIComponent(loanId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ action: 'progress', lastReadPage: safePage }),
    });
    return;
  }

  try {
    await updateDoc(doc(db, 'loans', loanId), {
      lastReadPage: safePage,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `loans/${loanId}`);
  }
}

export function getDaysOverdue(dueAt: Timestamp): number {
  const diffMs = Date.now() - dueAt.toMillis();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function getDaysRemaining(dueAt: Timestamp): number {
  const diffMs = dueAt.toMillis() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export async function syncOverdueNotificationsForLoans(
  loans: Loan[],
  existingNotifications: NotificationItem[],
  currentUserId: string
): Promise<void> {
  const unnotifiedOverdue = loans.filter(
    (loan) =>
      loan.userId === currentUserId &&
      loan.status === 'borrowed' &&
      !loan.overdueNotified &&
      loan.dueAt.toMillis() < Date.now()
  );

  if (unnotifiedOverdue.length === 0) return;

  const batch = writeBatch(db);
  let hasWrites = false;

  for (const loan of unnotifiedOverdue) {
    const alreadyExists = existingNotifications.some(
      (n) => n.loanId === loan.id && n.type === 'overdue'
    );
    const daysOverdue = getDaysOverdue(loan.dueAt);

    if (!alreadyExists) {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: loan.userId,
        loanId: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.bookTitle.slice(0, FIELD_LIMITS.TITLE_MAX),
        type: 'overdue',
        title: `Pengingat Keterlambatan: ${loan.bookTitle}`.slice(0, FIELD_LIMITS.NOTIF_TITLE_MAX),
        message: `Masa pinjam buku "${loan.bookTitle}" telah melewati batas pengembalian selama ${daysOverdue} hari. Harap segera kembalikan melalui menu Pinjaman Saya.`,
        daysOverdue,
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    batch.update(doc(db, 'loans', loan.id), {
      overdueNotified: true,
      updatedAt: serverTimestamp(),
    });
    hasWrites = true;
  }

  if (!hasWrites) return;
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'notifications');
  }
}

export async function sendManualOverdueReminder(
  loan: Loan,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    const res = await fetch('/api/notifications/remind', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ loanId: loan.id }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengingat.');
    return;
  }

  const daysOverdue = getDaysOverdue(loan.dueAt);
  const isOverdue = daysOverdue > 0;
  const notifRef = doc(collection(db, 'notifications'));

  const batch = writeBatch(db);
  batch.set(notifRef, {
    userId: loan.userId,
    loanId: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.bookTitle.slice(0, FIELD_LIMITS.TITLE_MAX),
    type: isOverdue ? 'overdue' : 'admin_reminder',
    title: (isOverdue
      ? `Tagihan Pengembalian Terlambat (${daysOverdue} Hari)`
      : `Pengingat Pengembalian dari Admin Kicchive`
    ).slice(0, FIELD_LIMITS.NOTIF_TITLE_MAX),
    message: (isOverdue
      ? `Admin Kicchive mengingatkan bahwa buku "${loan.bookTitle}" telah terlambat dikembalikan selama ${daysOverdue} hari. Mohon segera proses pengembalian.`
      : `Admin Kicchive mengingatkan agar buku "${loan.bookTitle}" dikembalikan sebelum tanggal jatuh tempo.`
    ).slice(0, FIELD_LIMITS.NOTIF_MSG_MAX),
    daysOverdue,
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (isOverdue && !loan.overdueNotified) {
    batch.update(doc(db, 'loans', loan.id), {
      overdueNotified: true,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notifications/${notifRef.id}`);
  }
}

export async function simulateOverdueLoanForTesting(
  loan: Loan,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ action: 'simulate_overdue' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Gagal mensimulasikan keterlambatan.');
    return;
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  try {
    await updateDoc(doc(db, 'loans', loan.id), {
      dueAt: Timestamp.fromDate(threeDaysAgo),
      overdueNotified: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `loans/${loan.id}`);
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customToken}` },
    });
    return;
  }

  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsAsRead(
  notifications: NotificationItem[],
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    await fetch('/api/notifications/mark-all-read', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customToken}` },
    });
    return;
  }

  const unread = notifications.filter((n) => !n.isRead);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  for (const item of unread) {
    batch.update(doc(db, 'notifications', item.id), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'notifications');
  }
}

export async function deleteNotificationItem(
  notificationId: string,
  customToken?: string | null
): Promise<void> {
  if (customToken) {
    await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customToken}` },
    });
    return;
  }

  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}

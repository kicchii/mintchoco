import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'member' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Book {
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LoanStatus = 'borrowed' | 'returned';

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string;
  pdfUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: LoanStatus;
  borrowedAt: Timestamp;
  dueAt: Timestamp;
  returnedAt?: Timestamp;
  lastReadPage: number;
  totalPages: number;
  overdueNotified: boolean;
  updatedAt: Timestamp;
}

export type NotificationType = 'overdue' | 'due_soon' | 'admin_reminder' | 'returned';

export interface NotificationItem {
  id: string;
  userId: string;
  loanId: string;
  bookId: string;
  bookTitle: string;
  type: NotificationType;
  title: string;
  message: string;
  daysOverdue: number;
  isRead: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UploadedPdfResult {
  pdfUrl: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
}

export const FIELD_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  TITLE_MAX: 200,
  AUTHOR_MAX: 150,
  CATEGORY_MAX: 60,
  ISBN_MAX: 40,
  ACCESSION_MAX: 40,
  SYNOPSIS_MAX: 2000,
  URL_MAX: 500,
  FILENAME_MAX: 255,
  NOTIF_TITLE_MAX: 150,
  NOTIF_MSG_MAX: 600,
  DISPLAY_NAME_MAX: 100,
} as const;

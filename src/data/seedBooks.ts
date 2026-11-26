import { Timestamp } from 'firebase/firestore';
import type { Book } from '../types/library';

export interface SeedBookTemplate {
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
}

export const COVER_PRESETS = [
  {
    label: 'Kolonade Beton (Arsitektur)',
    url: '/src/assets/images/cover_arsitektur_cahaya_1795676519582.jpg',
  },
  {
    label: 'Herbari Pesisir (Ekologi)',
    url: '/src/assets/images/cover_ekologi_nusantara_1795676519895.jpg',
  },
  {
    label: 'Kisi Terakota (Desain)',
    url: '/src/assets/images/cover_tipografi_modern_1795676520648.jpg',
  },
  {
    label: 'Astrolab Kuningan (Filsafat)',
    url: '/src/assets/images/cover_filsafat_waktu_1795676519824.jpg',
  },
  {
    label: 'Peta Kepulauan (Sejarah)',
    url: '/src/assets/images/cover_sejarah_maritim_1795676521750.jpg',
  },
] as const;

export const SEED_BOOKS: SeedBookTemplate[] = [
  {
    id: 'kcv-arsitektur-cahaya',
    title: 'Arsitektur Cahaya dan Ruang Kontemplasi',
    author: 'Raka Pradipta',
    category: 'Arsitektur',
    isbn: '978-602-8912-11-4',
    accessionNumber: 'KCV-2026-001',
    publishedYear: 2025,
    pageCount: 4,
    synopsis:
      'Kajian mendalam tentang tata pencahayaan alami, materialitas kayu ek, batu travertine, dan kenyamanan akustik pada rancangan ruang baca perpustakaan publik kontemporer.',
    coverUrl: '/src/assets/images/cover_arsitektur_cahaya_1795676519582.jpg',
    pdfUrl: '/api/pdfs/arsitektur-cahaya.pdf',
    fileName: 'arsitektur-cahaya.pdf',
    fileSizeBytes: 18420,
    totalCopies: 5,
    availableCopies: 5,
    loanDurationDays: 7,
  },
  {
    id: 'kcv-ekologi-nusantara',
    title: 'Atlas Ekologi Pesisir dan Hutan Bakau Nusantara',
    author: 'Nadia Kusumawardhani',
    category: 'Ekologi',
    isbn: '978-602-8912-24-4',
    accessionNumber: 'KCV-2026-002',
    publishedYear: 2024,
    pageCount: 4,
    synopsis:
      'Dokumentasi botani tentang peran akar tunjang mangrove dalam menahan abrasi, herbari paku-pakuan tropis, serta pengelolaan pesisir berbasis komunitas kepulauan.',
    coverUrl: '/src/assets/images/cover_ekologi_nusantara_1795676519895.jpg',
    pdfUrl: '/api/pdfs/ekologi-nusantara.pdf',
    fileName: 'ekologi-nusantara.pdf',
    fileSizeBytes: 19240,
    totalCopies: 4,
    availableCopies: 4,
    loanDurationDays: 7,
  },
  {
    id: 'kcv-tipografi-modern',
    title: 'Kisi Tipografi Modern dan Tata Letak Editorial',
    author: 'Dimas Aryoseno',
    category: 'Desain',
    isbn: '978-602-8912-38-1',
    accessionNumber: 'KCV-2026-003',
    publishedYear: 2025,
    pageCount: 4,
    synopsis:
      'Panduan praktis proporsi kolom bacaan, hirarki huruf serif dan sans-serif, serta penerapan prinsip ruang negatif editorial pada publikasi cetak maupun pembaca PDF digital.',
    coverUrl: '/src/assets/images/cover_tipografi_modern_1795676520648.jpg',
    pdfUrl: '/api/pdfs/tipografi-modern.pdf',
    fileName: 'tipografi-modern.pdf',
    fileSizeBytes: 17980,
    totalCopies: 6,
    availableCopies: 6,
    loanDurationDays: 14,
  },
  {
    id: 'kcv-filsafat-waktu',
    title: 'Meditasi tentang Waktu, Memori, dan Keberlanjutan',
    author: 'Surya Hadiwijaya',
    category: 'Filsafat',
    isbn: '978-602-8912-45-9',
    accessionNumber: 'KCV-2026-004',
    publishedYear: 2023,
    pageCount: 3,
    synopsis:
      'Esai filsafat mengenai perbedaan antara durasi kronologis alat ukur langit dan pengalaman waktu batin dalam membaca mendalam serta tanggung jawab menjaga arsip antargenerasi.',
    coverUrl: '/src/assets/images/cover_filsafat_waktu_1795676519824.jpg',
    pdfUrl: '/api/pdfs/filsafat-waktu.pdf',
    fileName: 'filsafat-waktu.pdf',
    fileSizeBytes: 15640,
    totalCopies: 3,
    availableCopies: 3,
    loanDurationDays: 7,
  },
  {
    id: 'kcv-sejarah-maritim',
    title: 'Peta Laut dan Jalur Niaga Maritim Kepulauan',
    author: 'Laksmi Pramudita',
    category: 'Sejarah',
    isbn: '978-602-8912-52-7',
    accessionNumber: 'KCV-2026-005',
    publishedYear: 2024,
    pageCount: 3,
    synopsis:
      'Penelusuran arsip pelayaran angin muson, peta garis pantai bersejarah, dan catatan harian nakhoda yang membentuk jaringan niaga maritim di perairan Nusantara.',
    coverUrl: '/src/assets/images/cover_sejarah_maritim_1795676521750.jpg',
    pdfUrl: '/api/pdfs/sejarah-maritim.pdf',
    fileName: 'sejarah-maritim.pdf',
    fileSizeBytes: 16210,
    totalCopies: 4,
    availableCopies: 4,
    loanDurationDays: 10,
  },
];

const SEED_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 10, 1));

export const INITIAL_CATALOG_BOOKS: Book[] = SEED_BOOKS.map((item) => ({
  ...item,
  createdBy: 'kicchive_curatorial',
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
}));


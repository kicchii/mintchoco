import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads', 'pdfs');
const STORE_PATH = path.resolve(ROOT_DIR, 'uploads', 'kicchive-store.json');
const CONFIG_PATH = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface FirebaseAppletConfig {
  apiKey?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
}

interface StoredBook {
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

interface StoredLoan {
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

interface StoredNotification {
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

interface AdminCredentials {
  name: string;
  salt: string;
  hash: string;
  claimedAtMs: number;
}

interface LibraryStore {
  adminCreds: AdminCredentials | null;
  books: StoredBook[];
  loans: StoredLoan[];
  notifications: StoredNotification[];
}

interface SessionPayload {
  sub: string;
  name: string;
  role: 'admin' | 'member';
  exp: number;
}

function readFirebaseConfig(): FirebaseAppletConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

interface SeedPdfSpec {
  id: string;
  filename: string;
  title: string;
  author: string;
  accessionNumber: string;
  category: string;
  isbn: string;
  publishedYear: number;
  synopsis: string;
  coverUrl: string;
  totalCopies: number;
  loanDurationDays: number;
  chapters: Array<{ heading: string; paragraphs: string[] }>;
}

const SEED_SPECS: SeedPdfSpec[] = [
  {
    id: 'kcv-arsitektur-cahaya',
    filename: 'arsitektur-cahaya.pdf',
    title: 'Arsitektur Cahaya dan Ruang Kontemplasi',
    author: 'Raka Pradipta',
    accessionNumber: 'KCV-2026-001',
    category: 'Arsitektur',
    isbn: '978-602-8912-11-4',
    publishedYear: 2025,
    synopsis:
      'Kajian mendalam tentang tata pencahayaan alami, materialitas kayu ek, batu travertine, dan kenyamanan akustik pada rancangan ruang baca perpustakaan publik kontemporer.',
    coverUrl: '/src/assets/images/cover_arsitektur_cahaya_1795676519582.jpg',
    totalCopies: 5,
    loanDurationDays: 7,
    chapters: [
      {
        heading: 'Bab I. Geometri Bukaan dan Cahaya Alami',
        paragraphs: [
          'Cahaya matahari di wilayah khatulistiwa bergerak dengan sudut tinggi sepanjang tahun. Dalam perancangan ruang baca publik, bukaan tinggi di sisi utara dan selatan memungkinkan pencahayaan merata tanpa silau berlebih pada permukaan kertas.',
          'Kolonade beton ekspos bukan sekadar penopang struktur, melainkan penyaring ritmis yang membagi intensitas sinar pagi menjadi bayangan terukur di lantai travertine. Ketenangan visual lahir ketika kontras antara bidang terang dan teduh terjaga seimbang.',
        ],
      },
      {
        heading: 'Bab II. Materialitas Kayu Ek dan Batu Alam',
        paragraphs: [
          'Pemilihan material berpori lembut seperti batu kapur pucat dan papan kayu ek membantu meredam pantulan akustik di ruang perpustakaan. Pengunjung merasakan keheningan bukan karena larangan bersuara, melainkan karena ruang menyerap gema secara alami.',
          'Meja baca panjang sepanjang empat meter menyatukan para pembaca dalam satu horison kerja bersama sambil tetap memberi jarak personal yang cukup melalui lampu meja tembaga berfokus sempit.',
        ],
      },
      {
        heading: 'Bab III. Catatan Kuratorial Kicchive',
        paragraphs: [
          'Monograf ini menghimpun studi lapangan dari tujuh perpustakaan kota di Asia Tenggara antara tahun 2019 hingga 2025. Setiap denah menunjukkan bahwa kualitas bacaan masyarakat berbanding lurus dengan kenyamanan ruang tempat buku disimpan.',
        ],
      },
    ],
  },
  {
    id: 'kcv-ekologi-nusantara',
    filename: 'ekologi-nusantara.pdf',
    title: 'Atlas Ekologi Pesisir dan Hutan Bakau Nusantara',
    author: 'Nadia Kusumawardhani',
    accessionNumber: 'KCV-2026-002',
    category: 'Ekologi',
    isbn: '978-602-8912-24-4',
    publishedYear: 2024,
    synopsis:
      'Dokumentasi botani tentang peran akar tunjang mangrove dalam menahan abrasi, herbari paku-pakuan tropis, serta pengelolaan pesisir berbasis komunitas kepulauan.',
    coverUrl: '/src/assets/images/cover_ekologi_nusantara_1795676519895.jpg',
    totalCopies: 4,
    loanDurationDays: 7,
    chapters: [
      {
        heading: 'Bab I. Akar Tunjang dan Penahan Abrasi',
        paragraphs: [
          'Hutan bakau di pesisir timur Sumatra hingga teluk Papua bekerja sebagai benteng hidup yang mematahkan energi gelombang pasang. Jaringan akar tunjang memerangkap sedimen halus dan menciptakan habitat asuhan bagi ribuan spesies ikan karang.',
          'Pengamatan botani selama dua dekade membuktikan bahwa restorasi satu hektar zona mangrove mampu memulihkan keseimbangan salinitas air tanah desa pesisir dalam waktu kurang dari lima tahun.',
        ],
      },
      {
        heading: 'Bab II. Herbari Paku-Pakuan Tropis',
        paragraphs: [
          'Spesies paku-pakuan epifit dan darat menjadi indikator kesehatan kelembapan mikro di bawah kanopi hutan pantai. Ilustrasi botani beresolusi tinggi membantu peneliti lapangan mengenali variasi spora tanpa harus mencabut spesimen hidup.',
        ],
      },
      {
        heading: 'Bab III. Tata Kelola Ruang Pesisir Berkelanjutan',
        paragraphs: [
          'Pendekatan konservasi modern menempatkan komunitas nelayan lokal sebagai penjaga utama garis pantai. Dokumentasi terbuka melalui perpustakaan digital mempercepat pertukaran pengetahuan ekologi antarwilayah kepulauan.',
        ],
      },
    ],
  },
  {
    id: 'kcv-tipografi-modern',
    filename: 'tipografi-modern.pdf',
    title: 'Kisi Tipografi Modern dan Tata Letak Editorial',
    author: 'Dimas Aryoseno',
    accessionNumber: 'KCV-2026-003',
    category: 'Desain',
    isbn: '978-602-8912-38-1',
    publishedYear: 2025,
    synopsis:
      'Panduan praktis proporsi kolom bacaan, hirarki huruf serif dan sans-serif, serta penerapan prinsip ruang negatif editorial pada publikasi cetak maupun pembaca PDF digital.',
    coverUrl: '/src/assets/images/cover_tipografi_modern_1795676520648.jpg',
    totalCopies: 6,
    loanDurationDays: 14,
    chapters: [
      {
        heading: 'Bab I. Proporsi Kolom dan Ritme Baca',
        paragraphs: [
          'Panjang baris ideal dalam naskah panjang berkisar antara enam puluh hingga tujuh puluh lima karakter. Lebar kolom yang terlalu panjang melelahkan pergerakan mata saat berpindah dari akhir baris menuju awal baris berikutnya.',
          'Sistem kisi modular Swiss membagi bidang cetak menjadi satuan teratur agar foto dokumenter, catatan kaki, dan tubuh teks berada dalam harmoni matematika yang jernih.',
        ],
      },
      {
        heading: 'Bab II. Kontras Huruf Serif dan Sans-Serif',
        paragraphs: [
          'Memadukan huruf serif berkarakter tinggi untuk judul bab dengan huruf sans-serif geometris untuk indeks metadata menciptakan hirarki informasi instan tanpa perlu ornamentasi berlebihan.',
        ],
      },
      {
        heading: 'Bab III. Arsip Cetak di Era Layar Digital',
        paragraphs: [
          'Prinsip keterbacaan klasik tetap berlaku pada pembaca PDF modern: ruang putih yang lapang di sekeliling teks adalah bentuk penghormatan tertinggi kepada waktu dan perhatian pembaca.',
        ],
      },
    ],
  },
  {
    id: 'kcv-filsafat-waktu',
    filename: 'filsafat-waktu.pdf',
    title: 'Meditasi tentang Waktu, Memori, dan Keberlanjutan',
    author: 'Surya Hadiwijaya',
    accessionNumber: 'KCV-2026-004',
    category: 'Filsafat',
    isbn: '978-602-8912-45-9',
    publishedYear: 2023,
    synopsis:
      'Esai filsafat mengenai perbedaan antara durasi kronologis alat ukur langit dan pengalaman waktu batin dalam membaca mendalam serta tanggung jawab menjaga arsip antargenerasi.',
    coverUrl: '/src/assets/images/cover_filsafat_waktu_1795676519824.jpg',
    totalCopies: 3,
    loanDurationDays: 7,
    chapters: [
      {
        heading: 'Bab I. Astrolab dan Pengukuran Durasi',
        paragraphs: [
          'Sejak masa astronom klasik, manusia berusaha menerjemahkan perputaran benda langit ke dalam piringan kuningan yang dapat digenggam. Namun waktu yang diukur jarum jam tidak selalu sejalan dengan waktu yang dialami kesadaran.',
          'Dalam kegiatan membaca buku secara mendalam, durasi terasa melambat karena ingatan menyambungkan gagasan masa lalu dengan pertanyaan masa kini.',
        ],
      },
      {
        heading: 'Bab II. Etika Arsip dan Pengetahuan Bersama',
        paragraphs: [
          'Perpustakaan bukan sekadar gudang berkas, melainkan perjanjian antargenerasi untuk menjaga agar pemikiran berharga tidak lenyap ditelan kebisingan sesaat.',
        ],
      },
    ],
  },
  {
    id: 'kcv-sejarah-maritim',
    filename: 'sejarah-maritim.pdf',
    title: 'Peta Laut dan Jalur Niaga Maritim Kepulauan',
    author: 'Laksmi Pramudita',
    accessionNumber: 'KCV-2026-005',
    category: 'Sejarah',
    isbn: '978-602-8912-52-7',
    publishedYear: 2024,
    synopsis:
      'Penelusuran arsip pelayaran angin muson, peta garis pantai bersejarah, dan catatan harian nakhoda yang membentuk jaringan niaga maritim di perairan Nusantara.',
    coverUrl: '/src/assets/images/cover_sejarah_maritim_1795676521750.jpg',
    totalCopies: 4,
    loanDurationDays: 10,
    chapters: [
      {
        heading: 'Bab I. Angin Muson dan Pelayaran Nusantara',
        paragraphs: [
          'Selama berabad-abad, jadwal pelayaran di perairan Nusantara ditentukan oleh pergantian angin muson barat dan timur. Pelabuhan-pelabuhan niaga di selat strategis tumbuh menjadi pusat pertemuan bahasa, rempah, dan manuskrip ilmu pengetahuan.',
          'Peta laut kuno menandai gugus karang, arus balik, serta menara suar alami berupa puncak gunung berapi yang tampak dari jarak puluhan mil laut.',
        ],
      },
      {
        heading: 'Bab II. Kartografi dan Catatan Nakhoda',
        paragraphs: [
          'Buku log kapal mencatat kedalaman perairan, arah kompas, serta pertukaran barang di tiap bandar. Digitalisasi naskah kartografi membuka akses bagi sejarawan muda untuk menelusuri jaringan maritim secara langsung.',
        ],
      },
    ],
  },
];

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

async function ensureSeedPdfs(): Promise<void> {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  for (const spec of SEED_SPECS) {
    const targetPath = path.join(UPLOADS_DIR, spec.filename);
    if (fs.existsSync(targetPath)) {
      continue;
    }

    const pdfDoc = await PDFDocument.create();
    const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const serifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const sansRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const coverPage = pdfDoc.addPage([595, 842]);
    coverPage.drawRectangle({
      x: 0,
      y: 0,
      width: 595,
      height: 842,
      color: rgb(0.984, 0.976, 0.961),
    });
    coverPage.drawRectangle({
      x: 48,
      y: 48,
      width: 499,
      height: 746,
      borderColor: rgb(0.84, 0.81, 0.75),
      borderWidth: 1,
    });
    coverPage.drawText('KOLEKSI ARSIP DIGITAL KICCHIVE', {
      x: 72,
      y: 730,
      size: 10,
      font: sansRegular,
      color: rgb(0.08, 0.325, 0.176),
    });
    coverPage.drawText(`${spec.category.toUpperCase()}  |  ${spec.accessionNumber}`, {
      x: 72,
      y: 710,
      size: 9,
      font: sansRegular,
      color: rgb(0.45, 0.43, 0.4),
    });

    const titleLines = wrapText(spec.title, 28);
    let titleY = 580;
    for (const line of titleLines) {
      coverPage.drawText(line, {
        x: 72,
        y: titleY,
        size: 28,
        font: serifBold,
        color: rgb(0.11, 0.1, 0.09),
      });
      titleY -= 36;
    }

    coverPage.drawText(`Penulis: ${spec.author}`, {
      x: 72,
      y: titleY - 24,
      size: 14,
      font: serifRegular,
      color: rgb(0.28, 0.25, 0.23),
    });

    coverPage.drawLine({
      start: { x: 72, y: 150 },
      end: { x: 523, y: 150 },
      thickness: 0.75,
      color: rgb(0.84, 0.81, 0.75),
    });
    coverPage.drawText('Diterbitkan untuk pembacaan daring melalui aplikasi perpustakaan digital Kicchive.', {
      x: 72,
      y: 124,
      size: 10,
      font: sansRegular,
      color: rgb(0.42, 0.4, 0.37),
    });

    let pageCounter = 2;
    for (const chapter of spec.chapters) {
      const page = pdfDoc.addPage([595, 842]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 595,
        height: 842,
        color: rgb(0.992, 0.988, 0.98),
      });
      page.drawText(`${spec.title} — ${spec.author}`, {
        x: 72,
        y: 782,
        size: 9,
        font: sansRegular,
        color: rgb(0.48, 0.45, 0.42),
      });
      page.drawLine({
        start: { x: 72, y: 770 },
        end: { x: 523, y: 770 },
        thickness: 0.5,
        color: rgb(0.86, 0.83, 0.78),
      });

      let cursorY = 724;
      const headingLines = wrapText(chapter.heading, 44);
      for (const hLine of headingLines) {
        page.drawText(hLine, {
          x: 72,
          y: cursorY,
          size: 18,
          font: serifBold,
          color: rgb(0.08, 0.325, 0.176),
        });
        cursorY -= 26;
      }

      cursorY -= 12;
      for (const para of chapter.paragraphs) {
        const lines = wrapText(para, 66);
        for (const pLine of lines) {
          page.drawText(pLine, {
            x: 72,
            y: cursorY,
            size: 12,
            font: serifRegular,
            color: rgb(0.14, 0.13, 0.12),
          });
          cursorY -= 20;
        }
        cursorY -= 14;
      }

      page.drawLine({
        start: { x: 72, y: 76 },
        end: { x: 523, y: 76 },
        thickness: 0.5,
        color: rgb(0.86, 0.83, 0.78),
      });
      page.drawText(`Kicchive · ${spec.accessionNumber}`, {
        x: 72,
        y: 56,
        size: 9,
        font: sansRegular,
        color: rgb(0.5, 0.47, 0.44),
      });
      page.drawText(`Halaman ${pageCounter}`, {
        x: 472,
        y: 56,
        size: 9,
        font: sansRegular,
        color: rgb(0.5, 0.47, 0.44),
      });
      pageCounter += 1;
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(targetPath, pdfBytes);
  }
}

function loadStore(): LibraryStore {
  if (fs.existsSync(STORE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as Partial<LibraryStore>;
      return {
        adminCreds: parsed.adminCreds ?? null,
        books: Array.isArray(parsed.books) ? parsed.books : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      };
    } catch {
      // Fallback to seeded store
    }
  }

  const now = Date.now();
  const initialBooks: StoredBook[] = SEED_SPECS.map((spec, idx) => {
    const filePath = path.join(UPLOADS_DIR, spec.filename);
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    return {
      id: spec.id,
      title: spec.title,
      author: spec.author,
      category: spec.category,
      isbn: spec.isbn,
      accessionNumber: spec.accessionNumber,
      publishedYear: spec.publishedYear,
      pageCount: spec.chapters.length + 1,
      synopsis: spec.synopsis,
      coverUrl: spec.coverUrl,
      pdfUrl: `/api/pdfs/${spec.filename}`,
      fileName: spec.filename,
      fileSizeBytes: stat?.size ?? 16000,
      totalCopies: spec.totalCopies,
      availableCopies: spec.totalCopies,
      loanDurationDays: spec.loanDurationDays,
      createdBy: 'kicchive_curatorial',
      createdAtMs: now - idx * 1000,
      updatedAtMs: now - idx * 1000,
    };
  });

  const store: LibraryStore = {
    adminCreds: null,
    books: initialBooks,
    loans: [],
    notifications: [],
  };
  saveStore(store);
  return store;
}

function saveStore(store: LibraryStore): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function hashPassphrase(passphrase: string, salt: string): string {
  return crypto.scryptSync(passphrase, salt, 64).toString('hex');
}

function safeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `kcv_${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('kcv_')) return null;
  const raw = token.slice(4);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (!safeEqualText(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!decoded.sub || !decoded.role || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
  const config = readFirebaseConfig();
  if (!config.apiKey) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user?.email) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

async function isFirebaseAdmin(uid: string, email: string, emailVerified: boolean): Promise<boolean> {
  if (!emailVerified) return false;
  if (email.toLowerCase() === 'fathiahasnaa@gmail.com') return true;
  const config = readFirebaseConfig();
  if (!config.projectId || !config.firestoreDatabaseId) return false;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents/admins/${encodeURIComponent(uid)}`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

interface AuthenticatedCaller {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

async function resolveCaller(authHeader: string | undefined): Promise<AuthenticatedCaller | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const customSession = verifySessionToken(token);
  if (customSession) {
    return {
      uid: customSession.sub,
      name: customSession.name,
      email: `${customSession.sub}@kicchive.local`,
      role: customSession.role,
    };
  }

  const fbUser = await verifyFirebaseIdToken(token);
  if (!fbUser) return null;
  const admin = await isFirebaseAdmin(fbUser.uid, fbUser.email, fbUser.emailVerified);
  return {
    uid: fbUser.uid,
    name: fbUser.email.split('@')[0],
    email: fbUser.email,
    role: admin ? 'admin' : 'member',
  };
}

function isSafeCoverUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('https://')
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

async function startServer(): Promise<void> {
  await ensureSeedPdfs();
  const store = loadStore();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kicchive' });
  });

  // ---------------------------------------------------------------
  // Non-Google Admin & Member Session Routes
  // ---------------------------------------------------------------
  app.get('/api/admin/status', (_req, res) => {
    const hasEnvPassphrase = Boolean(process.env.ADMIN_PASSPHRASE?.trim());
    const hasClaimed = Boolean(store.adminCreds);
    res.json({
      requiresClaim: !hasEnvPassphrase && !hasClaimed,
      hasEnvPassphrase,
      adminName: store.adminCreds?.name || 'Admin Kicchive',
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    const envPassphrase = process.env.ADMIN_PASSPHRASE?.trim();
    if (envPassphrase || store.adminCreds) {
      res.status(409).json({ error: 'Frasa akses admin sudah pernah diatur.' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase.trim() : '';
    if (passphrase.length < 4 || passphrase.length > 128) {
      res.status(400).json({ error: 'Frasa akses admin minimal 4 karakter.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassphrase(passphrase, salt);
    const adminName = name || 'Admin Kicchive';
    store.adminCreds = {
      name: adminName,
      salt,
      hash,
      claimedAtMs: Date.now(),
    };
    saveStore(store);

    const token = signSessionToken({
      sub: 'kicchive_admin',
      name: adminName,
      role: 'admin',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      token,
      user: { uid: 'kicchive_admin', name: adminName, role: 'admin' },
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase.trim() : '';
    if (!passphrase) {
      res.status(400).json({ error: 'Masukkan frasa akses admin.' });
      return;
    }

    const envPassphrase = process.env.ADMIN_PASSPHRASE?.trim();
    let valid = false;
    let adminName = name || store.adminCreds?.name || 'Admin Kicchive';

    if (envPassphrase) {
      valid = safeEqualText(passphrase, envPassphrase);
    } else if (store.adminCreds) {
      const candidateHash = hashPassphrase(passphrase, store.adminCreds.salt);
      valid = safeEqualText(candidateHash, store.adminCreds.hash);
    } else {
      res.status(400).json({ error: 'Belum ada frasa admin yang diatur. Silakan atur terlebih dahulu.' });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Frasa akses admin tidak sesuai.' });
      return;
    }

    const token = signSessionToken({
      sub: 'kicchive_admin',
      name: adminName,
      role: 'admin',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: { uid: 'kicchive_admin', name: adminName, role: 'admin' },
    });
  });

  app.post('/api/member/session', (req, res) => {
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    if (rawName.length < 2) {
      res.status(400).json({ error: 'Masukkan nama anggota minimal 2 karakter.' });
      return;
    }
    const slug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'pembaca';
    const uid = `member_${slug}`;
    const token = signSessionToken({
      sub: uid,
      name: rawName,
      role: 'member',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      token,
      user: { uid, name: rawName, role: 'member' },
    });
  });

  // ---------------------------------------------------------------
  // Books Catalog & PDF Upload Routes
  // ---------------------------------------------------------------
  app.get('/api/books', (_req, res) => {
    const sorted = [...store.books].sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({ books: sorted });
  });

  app.post('/api/books', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin Kicchive yang dapat menambahkan buku.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const author = typeof body.author === 'string' ? body.author.trim().slice(0, 150) : '';
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 60) : 'Umum';
    const isbn = typeof body.isbn === 'string' ? body.isbn.trim().slice(0, 40) : '978-602-8912-00-0';
    const accessionNumber =
      typeof body.accessionNumber === 'string'
        ? body.accessionNumber.trim().slice(0, 40)
        : `KCV-${Date.now().toString().slice(-6)}`;
    const synopsis = typeof body.synopsis === 'string' ? body.synopsis.trim().slice(0, 2000) : '';
    const coverUrl = typeof body.coverUrl === 'string' ? body.coverUrl.trim().slice(0, 500) : '';
    const pdfUrl = typeof body.pdfUrl === 'string' ? body.pdfUrl.trim().slice(0, 500) : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 255) : '';
    const publishedYear = Math.max(1000, Math.min(2100, Math.round(Number(body.publishedYear || 2026))));
    const pageCount = Math.max(1, Math.min(10000, Math.round(Number(body.pageCount || 1))));
    const fileSizeBytes = Math.max(1, Math.round(Number(body.fileSizeBytes || 1024)));
    const totalCopies = Math.max(1, Math.min(500, Math.round(Number(body.totalCopies || 3))));
    const loanDurationDays = Math.max(1, Math.min(60, Math.round(Number(body.loanDurationDays || 7))));

    if (!title || !author || !synopsis || !pdfUrl.startsWith('/api/pdfs/') || !isSafeCoverUrl(coverUrl)) {
      res.status(400).json({ error: 'Data buku tidak lengkap atau URL tidak valid.' });
      return;
    }

    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'buku';
    const id = `kcv-${slug}-${Date.now().toString(36)}`;
    const now = Date.now();

    const newBook: StoredBook = {
      id,
      title,
      author,
      category,
      isbn,
      accessionNumber,
      publishedYear,
      pageCount,
      synopsis,
      coverUrl,
      pdfUrl,
      fileName: fileName || `${slug}.pdf`,
      fileSizeBytes,
      totalCopies,
      availableCopies: totalCopies,
      loanDurationDays,
      createdBy: caller.uid,
      createdAtMs: now,
      updatedAtMs: now,
    };

    store.books.unshift(newBook);
    saveStore(store);
    res.status(201).json({ book: newBook });
  });

  app.patch('/api/books/:id', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat mengubah koleksi.' });
      return;
    }

    const book = store.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const nextTotal = Math.max(1, Math.min(500, Math.round(Number(req.body?.totalCopies ?? book.totalCopies))));
    const nextDuration = Math.max(1, Math.min(60, Math.round(Number(req.body?.loanDurationDays ?? book.loanDurationDays))));
    const borrowed = Math.max(0, book.totalCopies - book.availableCopies);
    book.totalCopies = nextTotal;
    book.availableCopies = Math.max(0, Math.min(nextTotal, nextTotal - borrowed));
    book.loanDurationDays = nextDuration;
    book.updatedAtMs = Date.now();
    saveStore(store);

    res.json({ book });
  });

  app.delete('/api/books/:id', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menghapus buku.' });
      return;
    }

    const idx = store.books.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    store.books.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  app.post('/api/uploads/pdf', upload.single('file'), async (req, res) => {
    try {
      const caller = await resolveCaller(req.headers.authorization);
      if (!caller) {
        res.status(401).json({ error: 'Token otentikasi diperlukan untuk mengunggah PDF.' });
        return;
      }
      if (caller.role !== 'admin') {
        res.status(403).json({ error: 'Hanya admin Kicchive yang dapat mengunggah berkas PDF.' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Berkas PDF tidak ditemukan.' });
        return;
      }

      const originalExt = path.extname(file.originalname).toLowerCase();
      const magicHeader = file.buffer.subarray(0, 5).toString('ascii');
      if (originalExt !== '.pdf' || magicHeader !== '%PDF-') {
        res.status(400).json({ error: 'Format berkas harus berupa PDF yang valid.' });
        return;
      }

      let pageCount = 1;
      try {
        const parsedPdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
        pageCount = Math.max(1, parsedPdf.getPageCount());
      } catch {
        res.status(400).json({ error: 'Berkas PDF rusak atau tidak dapat dibaca.' });
        return;
      }

      const safeBase =
        path
          .basename(file.originalname, '.pdf')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48) || 'dokumen';
      const storedFilename = `${safeBase}-${Date.now()}.pdf`;
      const targetPath = path.resolve(UPLOADS_DIR, storedFilename);
      if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Lokasi penyimpanan berkas tidak valid.' });
        return;
      }
      fs.writeFileSync(targetPath, file.buffer);

      res.status(201).json({
        pdfUrl: `/api/pdfs/${storedFilename}`,
        fileName: storedFilename,
        fileSizeBytes: file.size,
        pageCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memproses unggahan PDF.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/pdfs/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_\-.]+\.pdf$/.test(filename) || filename.includes('..')) {
      res.status(400).json({ error: 'Nama berkas tidak valid.' });
      return;
    }

    const filePath = path.resolve(UPLOADS_DIR, filename);
    if (!filePath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Jalur berkas tidak valid.' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas PDF tidak ditemukan.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  });

  // ---------------------------------------------------------------
  // Loans & Notifications Routes (for non-Google sessions & Admin)
  // ---------------------------------------------------------------
  app.get('/api/loans', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    const visible =
      caller.role === 'admin'
        ? store.loans
        : store.loans.filter((l) => l.userId === caller.uid);
    const sorted = [...visible].sort((a, b) => b.borrowedAtMs - a.borrowedAtMs);
    res.json({ loans: sorted });
  });

  app.post('/api/loans', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk meminjam buku.' });
      return;
    }

    const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
    const book = store.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan di katalog.' });
      return;
    }
    if (book.availableCopies < 1) {
      res.status(400).json({ error: 'Semua eksemplar buku ini sedang dipinjam.' });
      return;
    }

    const alreadyBorrowed = store.loans.find(
      (l) => l.bookId === book.id && l.userId === caller.uid && l.status === 'borrowed'
    );
    if (alreadyBorrowed) {
      res.json({ loan: alreadyBorrowed });
      return;
    }

    const now = Date.now();
    const loan: StoredLoan = {
      id: `loan_${crypto.randomBytes(6).toString('hex')}`,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverUrl: book.coverUrl,
      pdfUrl: book.pdfUrl,
      userId: caller.uid,
      userName: caller.name,
      userEmail: caller.email,
      status: 'borrowed',
      borrowedAtMs: now,
      dueAtMs: now + book.loanDurationDays * 24 * 60 * 60 * 1000,
      lastReadPage: 1,
      totalPages: Math.max(1, book.pageCount),
      overdueNotified: false,
      updatedAtMs: now,
    };

    book.availableCopies -= 1;
    book.updatedAtMs = now;
    store.loans.unshift(loan);
    saveStore(store);

    res.status(201).json({ loan });
  });

  app.patch('/api/loans/:id', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    const loan = store.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Data pinjaman tidak ditemukan.' });
      return;
    }
    if (caller.role !== 'admin' && loan.userId !== caller.uid) {
      res.status(403).json({ error: 'Anda tidak berwenang mengubah pinjaman ini.' });
      return;
    }

    const action = req.body?.action;
    const now = Date.now();

    if (action === 'progress') {
      const page = Math.max(1, Math.min(10000, Math.round(Number(req.body?.lastReadPage || 1))));
      loan.lastReadPage = page;
      loan.updatedAtMs = now;
      saveStore(store);
      res.json({ loan });
      return;
    }

    if (action === 'return') {
      if (loan.status === 'borrowed') {
        loan.status = 'returned';
        loan.returnedAtMs = now;
        loan.updatedAtMs = now;
        const book = store.books.find((b) => b.id === loan.bookId);
        if (book) {
          book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
          book.updatedAtMs = now;
        }
        saveStore(store);
      }
      res.json({ loan });
      return;
    }

    if (action === 'simulate_overdue') {
      if (caller.role !== 'admin') {
        res.status(403).json({ error: 'Hanya admin yang dapat mensimulasikan keterlambatan.' });
        return;
      }
      loan.dueAtMs = now - 3 * 24 * 60 * 60 * 1000;
      loan.overdueNotified = true;
      loan.updatedAtMs = now;
      store.notifications.unshift({
        id: `notif_${crypto.randomBytes(6).toString('hex')}`,
        userId: loan.userId,
        loanId: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.bookTitle,
        type: 'overdue',
        title: `Pengingat Keterlambatan: ${loan.bookTitle}`,
        message: `Masa pinjam buku "${loan.bookTitle}" telah melewati batas pengembalian selama 3 hari. Harap segera kembalikan melalui menu Pinjaman Saya.`,
        daysOverdue: 3,
        isRead: false,
        createdAtMs: now,
        updatedAtMs: now,
      });
      saveStore(store);
      res.json({ loan });
      return;
    }

    res.status(400).json({ error: 'Aksi pinjaman tidak dikenal.' });
  });

  app.get('/api/notifications', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    // Automatically generate overdue notifications for borrower's overdue active loans
    const now = Date.now();
    let changed = false;
    for (const loan of store.loans) {
      if (
        loan.userId === caller.uid &&
        loan.status === 'borrowed' &&
        !loan.overdueNotified &&
        loan.dueAtMs < now
      ) {
        const daysOverdue = Math.max(1, Math.ceil((now - loan.dueAtMs) / (24 * 60 * 60 * 1000)));
        store.notifications.unshift({
          id: `notif_${crypto.randomBytes(6).toString('hex')}`,
          userId: loan.userId,
          loanId: loan.id,
          bookId: loan.bookId,
          bookTitle: loan.bookTitle,
          type: 'overdue',
          title: `Pengingat Keterlambatan: ${loan.bookTitle}`,
          message: `Masa pinjam buku "${loan.bookTitle}" telah melewati batas pengembalian selama ${daysOverdue} hari. Harap segera kembalikan melalui menu Pinjaman Saya.`,
          daysOverdue,
          isRead: false,
          createdAtMs: now,
          updatedAtMs: now,
        });
        loan.overdueNotified = true;
        loan.updatedAtMs = now;
        changed = true;
      }
    }
    if (changed) saveStore(store);

    const mine = store.notifications
      .filter((n) => n.userId === caller.uid)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({ notifications: mine });
  });

  app.post('/api/notifications/remind', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat mengirim pengingat manual.' });
      return;
    }

    const loanId = typeof req.body?.loanId === 'string' ? req.body.loanId.trim() : '';
    const loan = store.loans.find((l) => l.id === loanId);
    if (!loan) {
      res.status(404).json({ error: 'Data pinjaman tidak ditemukan.' });
      return;
    }

    const now = Date.now();
    const diffMs = now - loan.dueAtMs;
    const daysOverdue = diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000))) : 0;
    const isOverdue = daysOverdue > 0;

    const notif: StoredNotification = {
      id: `notif_${crypto.randomBytes(6).toString('hex')}`,
      userId: loan.userId,
      loanId: loan.id,
      bookId: loan.bookId,
      bookTitle: loan.bookTitle,
      type: isOverdue ? 'overdue' : 'admin_reminder',
      title: isOverdue
        ? `Tagihan Pengembalian Terlambat (${daysOverdue} Hari)`
        : 'Pengingat Pengembalian dari Admin Kicchive',
      message: isOverdue
        ? `Admin Kicchive mengingatkan bahwa buku "${loan.bookTitle}" telah terlambat dikembalikan selama ${daysOverdue} hari. Mohon segera proses pengembalian.`
        : `Admin Kicchive mengingatkan agar buku "${loan.bookTitle}" dikembalikan sebelum tanggal jatuh tempo.`,
      daysOverdue,
      isRead: false,
      createdAtMs: now,
      updatedAtMs: now,
    };

    if (isOverdue) {
      loan.overdueNotified = true;
      loan.updatedAtMs = now;
    }
    store.notifications.unshift(notif);
    saveStore(store);
    res.status(201).json({ notification: notif });
  });

  app.patch('/api/notifications/:id', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    if (req.params.id === 'mark-all-read') {
      const now = Date.now();
      for (const n of store.notifications) {
        if (n.userId === caller.uid && !n.isRead) {
          n.isRead = true;
          n.updatedAtMs = now;
        }
      }
      saveStore(store);
      res.json({ ok: true });
      return;
    }

    const notif = store.notifications.find((n) => n.id === req.params.id);
    if (!notif || notif.userId !== caller.uid) {
      res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
      return;
    }
    notif.isRead = true;
    notif.updatedAtMs = Date.now();
    saveStore(store);
    res.json({ notification: notif });
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    const caller = await resolveCaller(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    const idx = store.notifications.findIndex(
      (n) => n.id === req.params.id && (n.userId === caller.uid || caller.role === 'admin')
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
      return;
    }
    store.notifications.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kicchive server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Kicchive server:', err);
  process.exit(1);
});

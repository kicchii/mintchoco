import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads', 'pdfs');
const CONFIG_PATH = path.resolve(ROOT_DIR, 'firebase-applet-config.json');

interface FirebaseAppletConfig {
  apiKey?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
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
  filename: string;
  title: string;
  author: string;
  accessionNumber: string;
  category: string;
  chapters: Array<{ heading: string; paragraphs: string[] }>;
}

const SEED_PDFS: SeedPdfSpec[] = [
  {
    filename: 'arsitektur-cahaya.pdf',
    title: 'Arsitektur Cahaya dan Ruang Kontemplasi',
    author: 'Raka Pradipta',
    accessionNumber: 'KCV-2026-001',
    category: 'Arsitektur',
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
    filename: 'ekologi-nusantara.pdf',
    title: 'Atlas Ekologi Pesisir dan Hutan Bakau Nusantara',
    author: 'Nadia Kusumawardhani',
    accessionNumber: 'KCV-2026-002',
    category: 'Ekologi',
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
    filename: 'tipografi-modern.pdf',
    title: 'Kisi Tipografi Modern dan Tata Letak Editorial',
    author: 'Dimas Aryoseno',
    accessionNumber: 'KCV-2026-003',
    category: 'Desain',
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
    filename: 'filsafat-waktu.pdf',
    title: 'Meditasi tentang Waktu, Memori, dan Keberlanjutan',
    author: 'Surya Hadiwijaya',
    accessionNumber: 'KCV-2026-004',
    category: 'Filsafat',
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
    filename: 'sejarah-maritim.pdf',
    title: 'Peta Laut dan Jalur Niaga Maritim Kepulauan',
    author: 'Laksmi Pramudita',
    accessionNumber: 'KCV-2026-005',
    category: 'Sejarah',
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

  for (const spec of SEED_PDFS) {
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
    coverPage.drawText('Diterbitkan untuk pembacaan daring melalui aplikasi perpustakaan digital kicchive.', {
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
      page.drawText(`kicchive · ${spec.accessionNumber}`, {
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

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
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

async function isAuthorizedAdmin(uid: string, email: string, emailVerified: boolean): Promise<boolean> {
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

async function startServer(): Promise<void> {
  await ensureSeedPdfs();

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kicchive' });
  });

  app.post('/api/uploads/pdf', upload.single('file'), async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        res.status(401).json({ error: 'Token otentikasi diperlukan untuk mengunggah PDF.' });
        return;
      }

      const verifiedUser = await verifyFirebaseIdToken(token);
      if (!verifiedUser) {
        res.status(401).json({ error: 'Sesi otentikasi tidak valid. Silakan masuk kembali.' });
        return;
      }

      const adminAllowed = await isAuthorizedAdmin(
        verifiedUser.uid,
        verifiedUser.email,
        verifiedUser.emailVerified
      );
      if (!adminAllowed) {
        res.status(403).json({ error: 'Hanya admin kicchive yang dapat mengunggah berkas PDF.' });
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

      const safeBase = path
        .basename(file.originalname, '.pdf')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'dokumen';
      const storedFilename = `${safeBase}-${Date.now()}.pdf`;
      const targetPath = path.join(UPLOADS_DIR, storedFilename);
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

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas PDF tidak ditemukan.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
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
    console.log(`kicchive server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start kicchive server:', err);
  process.exit(1);
});

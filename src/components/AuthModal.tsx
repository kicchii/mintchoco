import { useEffect, useState, type FormEvent } from 'react';
import { Dices, KeyRound, ShieldCheck, UserCheck, X } from 'lucide-react';

export interface CustomAuthSession {
  token: string;
  uid: string;
  name: string;
  role: 'admin' | 'member';
}

interface AuthModalProps {
  initialTab?: 'admin' | 'member';
  onCustomSession: (session: CustomAuthSession) => void;
  onGoogleSignIn: () => Promise<void>;
  onClose: () => void;
}

const RANDOM_WORDS = [
  'coklat',
  'mint',
  'mentega',
  'pustaka',
  'kertas',
  'kicchive',
  'senja',
  'lembayung',
  'kopi',
  'baca',
  'aksara',
  'naskah',
  'kuning',
  'pastel',
];

function generateRandomPhrase(): string {
  const bytes = new Uint32Array(3);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((val) => RANDOM_WORDS[val % RANDOM_WORDS.length])
    .join('-');
}

export function AuthModal({
  initialTab = 'admin',
  onCustomSession,
  onGoogleSignIn,
  onClose,
}: AuthModalProps) {
  const [tab, setTab] = useState<'admin' | 'member'>(initialTab);
  const [requiresClaim, setRequiresClaim] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState('Pustakawan Kicchive');
  const [passphrase, setPassphrase] = useState('');
  const [memberName, setMemberName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/status')
      .then((res) => res.json())
      .then((data: { requiresClaim?: boolean; adminName?: string }) => {
        if (cancelled) return;
        setRequiresClaim(Boolean(data.requiresClaim));
        if (data.adminName) setAdminName(data.adminName);
        if (data.requiresClaim) {
          setPassphrase(generateRandomPhrase());
        }
      })
      .catch(() => {
        if (!cancelled) setRequiresClaim(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdminSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const endpoint = requiresClaim ? '/api/admin/claim' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adminName, passphrase }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: { uid: string; name: string; role: 'admin' | 'member' };
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Gagal masuk sebagai admin.');
      }
      onCustomSession({
        token: data.token,
        uid: data.user.uid,
        name: data.user.name,
        role: 'admin',
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses akses admin.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMemberSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/member/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: { uid: string; name: string; role: 'admin' | 'member' };
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Gagal memulai sesi anggota.');
      }
      onCustomSession({
        token: data.token,
        uid: data.user.uid,
        name: data.user.name,
        role: 'member',
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk sebagai anggota.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#3E2723]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Masuk ke Kicchive"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FBF8F1] border border-[#DFD3C3] rounded-3xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFD3C3] bg-[#E2F5EC]/60">
          <h2 className="font-display text-xl font-semibold text-[#3E2723]">
            Masuk ke Kicchive
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela masuk"
            className="p-2 rounded-xl text-[#6D4C41] hover:text-[#3E2723] hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#EFE6D8]">
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'admin'
                  ? 'bg-[#4E342E] text-[#FFFDF8]'
                  : 'text-[#5D4037] hover:text-[#3E2723]'
              }`}
            >
              Admin (Frasa Akses)
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('member');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'member'
                  ? 'bg-[#4E342E] text-[#FFFDF8]'
                  : 'text-[#5D4037] hover:text-[#3E2723]'
              }`}
            >
              Anggota Pembaca
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl border border-[#C62828]/40 bg-white text-xs font-semibold text-[#C62828]">
              {errorMsg}
            </div>
          )}

          {tab === 'admin' ? (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="rounded-xl bg-[#FEF3C7]/70 border border-[#FDE68A] p-3.5 text-xs text-[#5D4037] space-y-1">
                <p className="font-semibold text-[#3E2723] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#4E342E]" />
                  {requiresClaim
                    ? 'Atur Frasa Akses Admin Pertama Kali'
                    : 'Masuk Admin Tanpa Akun Google'}
                </p>
                <p>
                  {requiresClaim
                    ? 'Masukkan atau acak kata-kata bebas sebagai kunci masuk Admin Kicchive. Simpan frasa ini untuk login berikutnya.'
                    : 'Masukkan frasa akses admin yang sudah diatur untuk mengunggah PDF dan memantau peminjaman.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                  Nama Pengelola
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#5D4037]">
                    Frasa Akses (Kata-kata Bebas)
                  </label>
                  {requiresClaim && (
                    <button
                      type="button"
                      onClick={() => setPassphrase(generateRandomPhrase())}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B6B53] hover:underline"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      Acak Kata
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8D6E63] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={128}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Contoh: coklat-mint-senja"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-mono bg-white border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || requiresClaim === null}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] disabled:opacity-50 transition-colors"
              >
                {busy
                  ? 'Memverifikasi...'
                  : requiresClaim
                    ? 'Simpan Frasa & Masuk Admin'
                    : 'Masuk Dasbor Admin'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleMemberSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5D4037] mb-1">
                    Masuk Cepat dengan Nama (Tanpa Google)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Contoh: Fathia Hasna"
                    className="w-full px-3 py-2 rounded-xl text-sm bg-white border border-[#DFD3C3] focus:outline-none focus:border-[#4E342E]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#9CE0C2] text-[#3E2723] hover:bg-[#84D5B1] disabled:opacity-50 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  {busy ? 'Memulai Sesi...' : 'Lanjut sebagai Anggota'}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#DFD3C3]" />
                <span className="px-3 text-xs text-[#8D6E63]">atau</span>
                <div className="flex-grow border-t border-[#DFD3C3]" />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onGoogleSignIn();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-[#DFD3C3] bg-white text-[#3E2723] hover:bg-[#FEF3C7] transition-colors"
              >
                Masuk dengan Akun Google (Sinkron Cloud)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

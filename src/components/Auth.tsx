import { useState } from "react";
import { ShieldCheck, FileText, CheckCircle2, MapPin } from "lucide-react";
import { safeFetchJson } from "../utils/api";
import KvkkModal from "./KvkkModal";

interface AuthProps {
  onAuthSuccess: (token: string, username: string, avatar: string | null, id: number, color?: string) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isLogin && !kvkkAccepted) {
      setError("Devam etmek için Kullanım Koşulları ve KVKK Aydınlatma Metni'ni onaylamanız zorunludur.");
      return;
    }

    setIsLoading(true);
    const url = isLogin ? "/api/login" : "/api/register";
    try {
      const data = await safeFetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(isLogin ? {} : { locationConsent, kvkkAccepted, termsAccepted: kvkkAccepted })
        }),
      });
      
      if (!isLogin) {
        setSuccessMessage(data.messageTr || "Kaydınız başarıyla alındı. Hesabınız yönetici (emirgan) tarafından onaylandıktan sonra giriş yapabilirsiniz.");
        setIsLogin(true);
        setPassword("");
      } else {
        onAuthSuccess(data.token, data.username, data.avatar || null, data.id, data.color);
      }
    } catch (err: any) {
      if (err.message?.includes("ACCOUNT_PENDING") || err.message?.includes("onaylanmadı")) {
        setError("Hesabınız henüz onaylanmadı. Yönetici (emirgan) onayı bekleniyor.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-all">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isLogin ? "Tekrar Hoş Geldiniz" : "Hesap Oluştur"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isLogin ? "Hesabınıza giriş yaparak devam edin" : "Hızlıca kaydolun ve topluluğa katılın"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              required
              placeholder="kullanici_adi"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className="space-y-3 pt-2">
              {/* Mandatory KVKK Consent */}
              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <input
                  type="checkbox"
                  required
                  checked={kvkkAccepted}
                  onChange={(e) => setKvkkAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                />
                <span className="leading-snug">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowKvkkModal(true);
                    }}
                    className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Kullanım Koşulları ve KVKK Aydınlatma Metni
                  </button>
                  'ni okudum, kabul ediyorum. <span className="text-red-500 font-bold">*</span>
                </span>
              </label>

              {/* Optional Location Consent for Live Map */}
              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => setLocationConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-emerald-300 dark:border-emerald-600 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                />
                <span className="leading-snug">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                    <MapPin size={13} className="shrink-0" /> Canlı Harita
                  </span>{" "}
                  özelliği için yaklaşık konum verilerimin işlenmesine ve haritada gösterilmesine{" "}
                  <strong className="text-slate-900 dark:text-white font-bold">Açık Rıza</strong> veriyorum.{" "}
                  <span className="text-slate-400 text-[11px]">(İsteğe bağlı)</span>
                </span>
              </label>
            </div>
          )}
          
          {successMessage && (
            <div className="text-emerald-700 dark:text-emerald-300 text-xs text-center font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3 rounded-xl mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (!isLogin && !kvkkAccepted)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 mt-2 cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isLogin ? (
              "Giriş Yap"
            ) : (
              "Kayıt Ol ve Başla"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
          >
            {isLogin ? "Hesabın yok mu? Hemen Kayıt Ol" : "Zaten hesabın var mı? Giriş Yap"}
          </button>
        </div>

        {/* Legal & Notice Link in Auth Card Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setShowKvkkModal(true)}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <FileText size={13} />
            <span>5651 & KVKK Bilgilendirmesi</span>
          </button>
        </div>
      </div>

      {/* KVKK and Terms Modal */}
      <KvkkModal
        isOpen={showKvkkModal}
        onClose={() => setShowKvkkModal(false)}
        onAccept={() => setKvkkAccepted(true)}
        showAcceptButton={!isLogin}
      />
    </div>
  );
}


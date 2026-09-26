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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 transition-colors gap-8 lg:gap-12 w-full">
      
      {/* Dynamic SEO Header / Logo for crawlers */}
      <header className="text-center max-w-2xl mt-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-3">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-1.5 rounded-2xl shadow-md">K</span>
          <span>KapsApp</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium leading-relaxed">
          Sesli Sohbet Odaları, Gizlilik Odaklı Canlı Harita, İnteraktif Ders Klasörleri ve Sosyal Kart Oyunları Platformu
        </p>
      </header>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 w-full max-w-5xl">
        {/* Auth form card */}
        <div className="bg-white dark:bg-slate-900 w-full max-w-md mx-auto rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-all shrink-0">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
              <ShieldCheck size={26} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isLogin ? "Tekrar Hoş Geldiniz" : "Hesap Oluştur"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
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

      {/* GEO / LLM Semantic Description Block */}
      <article className="w-full max-w-lg lg:max-w-xl space-y-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-3">
            <span className="text-emerald-500 text-lg">💡</span> KapsApp Nedir?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            <strong>KapsApp</strong>, modern toplulukların ve öğrencilerin dijital iş birliği, gerçek zamanlı iletişim ve sosyal eğlence ihtiyaçlarını tek bir çatı altında karşılayan yenilikçi bir <strong>web platformudur</strong>. Arkadaşlarınızla güvenli bir ortamda etkileşime girmeniz için tasarlanmış dört temel sütun üzerine kurulmuştur.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              📍 Canlı GPS Haritası
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Dünya üzerindeki konumunuzu arkadaşlarınızla anlık olarak paylaşın. 50-150 metre jeodezik gizlilik hata payı (fuzzing) sayesinde net ev adresiniz asla sızdırılmaz.
            </p>
          </section>

          <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              🎙️ Kesintisiz Sesli Sohbet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Düşük gecikmeli, yüksek kaliteli WebRTC ses kanalları ile kesintisiz iletişim kurun. Arkadaş ortamınızla eş zamanlı ekran paylaşımı yapın.
            </p>
          </section>

          <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              📚 İnteraktif Ders Klasörleri
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Ortak ders notlarınızı, PDF&#39;lerinizi ve faydalı web kaynaklarını klasörler halinde düzenleyip paylaşın, akademik çalışmalarınızı tek tıkla organize edin.
            </p>
          </section>

          <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              🃏 Çok Oyunculu Sosyal Oyunlar
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Yapay zeka (bot) veya gerçek oyuncular eşliğinde Blackjack 21, İhaleli Batak, Koz Maça, UNO, Okey ve Gartic/Çizim oyunlarıyla kalıcı çiplerle yarışın.
            </p>
          </section>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>🛡️ Kişisel Verileriniz KVKK ile Korunur</span>
          <span>🌐 Tarayıcı Tabanlıdır, İndirme Gerekmez</span>
        </div>
      </article>

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


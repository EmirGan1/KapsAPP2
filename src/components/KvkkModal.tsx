import React from 'react';
import { ShieldCheck, X, CheckCircle2 } from 'lucide-react';

interface KvkkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export default function KvkkModal({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false
}: KvkkModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                KapsApp KVKK, Gizlilik ve Yasal Uyarı Metni
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                6698 Sayılı KVKK, 5651 Sayılı Kanun ve Yasal Sorumluluk Çerçevesi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable 9-Article Legal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          
          {/* Article 1 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">1</span>
              Veri Sorumlusu, Kapsam ve Hukuki Dayanak
            </h4>
            <p>
              İşbu Aydınlatma ve Yasal Uyarı Metni; 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;), 5651 sayılı &quot;İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun&quot; ve ilgili mevzuat uyarınca, KapsApp (&quot;Platform&quot;) kullanıcılarının kişisel verilerinin işlenme amaçlarını, hukuki sebeplerini, aktarım süreçlerini ve yasal sorumluluk sınırlarını açıklamaktadır.
            </p>
          </section>

          {/* Article 2 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">2</span>
              İşlenen Kişisel Veriler ve Hukuki Sebepleri (KVKK Madde 5)
            </h4>
            <p>Platformumuzda işlenen veriler ve dayandığı hukuki sebepler şunlardır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li>
                <strong>Kimlik ve Hesap Verileri (Kullanıcı adı, e-posta, şifrelenmiş parola, profil bilgileri):</strong> KVKK Md. 5/2-c uyarınca <em>&quot;Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması&quot;</em> hukuki sebebine dayanarak üyelik süreçlerinin yürütülmesi amacıyla işlenir.
              </li>
              <li>
                <strong>Trafik ve Erişim Logları (IP adresi, port bilgisi, giriş/kayıt/çıkış zaman damgaları):</strong> KVKK Md. 5/2-a (<em>&quot;Kanunlarda açıkça öngörülmesi&quot;</em>) ve Md. 5/2-ç (<em>&quot;Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi&quot;</em>) kapsamında 5651 sayılı Kanun gereğince işlenir.
              </li>
              <li>
                <strong>Platform İçi Etkinlik, Oyun İstatistikleri ve Sanal Puan Kayıtları:</strong> KVKK Md. 5/2-f uyarınca <em>&quot;İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaati&quot;</em> kapsamında sistem güvenliği ve kullanıcı deneyiminin sağlanması amacıyla işlenir.
              </li>
              <li>
                <strong>Coğrafi Konum, Kamera, Mikrofon ve Ekran Paylaşımı Verileri:</strong> KVKK Md. 5/1 uyarınca yalnızca kullanıcının <strong>Açık Rızası</strong> (tarayıcı izin onayı ve uygulama içi aktif başlatma) bulunması halinde anlık olarak işlenir.
              </li>
            </ul>
          </section>

          {/* Article 3 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">3</span>
              5651 Sayılı Kanun Kapsamında Erişim Logları ve Saklama Süresi
            </h4>
            <p>
              Platformumuz, 5651 sayılı Kanun uyarınca &quot;Yer Sağlayıcı&quot; sıfatına sahiptir. Yasal yükümlülükler kapsamında kullanıcıların sisteme kayıt, giriş ve çıkış işlemlerine ait IP adresi ve zaman damgası (timestamp) logları, mevzuatta öngörülen yasal saklama süresi (maksimum 2 yıl) boyunca güvenli veritabanında asenkron olarak muhafaza edilir ve süre sonunda imha edilir. Bu veriler yalnızca yetkili adli veya idari mercilerin resmi talebi halinde ilgili makamlarla paylaşılır.
            </p>
          </section>

          {/* Article 4 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">4</span>
              Canlı Harita ve Coğrafi Konum Verilerinin İşlenmesi (Açık Rıza & Güvenlik Sapması)
            </h4>
            <p>Canlı Harita servisinde konum paylaşımı tamamen kullanıcının Açık Rızasına tabidir:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Kullanıcının tam ve net GPS koordinatları hiçbir zaman veritabanına kaydedilmez; yalnızca aktif oturum süresince geçici olarak sistem RAM belleğinde tutulur.</li>
              <li>Kullanıcı mahremiyetini ve fiziksel güvenliğini korumak amacıyla, haritaya yansıtılan koordinatlara algoritma tarafından otomatik olarak <strong>200 ile 500 metre yarıçapında rastgele güvenlik sapması (jitter)</strong> uygulanır.</li>
              <li>Kullanıcı dilediği an harita arayüzünden konum paylaşımını durdurabilir; paylaşım durdurulduğunda veya bağlantı kesildiğinde konum verisi RAM bellekten derhal silinir.</li>
            </ul>
          </section>

          {/* Article 5 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">5</span>
              Sesli, Görüntülü ve Ekran Paylaşımı İletişimi (WebRTC P2P Mimarisi)
            </h4>
            <p>Platformdaki sesli/görüntülü odalar ve ekran paylaşımı özellikleri <strong>WebRTC (Peer-to-Peer / Eşler Arası)</strong> iletişim protokolü ile çalışmaktadır:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Kamera, mikrofon ve ekran paylaşımı medya akışları sunucularımız üzerinden geçmez; doğrudan odadaki kullanıcıların tarayıcıları arasında uçtan uca şifreli (DTLS/SRTP) olarak iletilir ve sunucularımızda <strong>kesinlikle kaydedilmez, izlenmez veya depolanmaz.</strong></li>
              <li>WebRTC teknolojisinin doğası gereği, iki cihaz arasında doğrudan bağlantı kurulabilmesi için ağ yönlendirme bilgileri (ICE Candidates / IP ve Port bilgileri) STUN/TURN protokolleri aracılığıyla eşleşen katılımcı tarayıcıları arasında geçici olarak paylaşılır. Odaya katılan kullanıcı bu teknik çalışma prensibini kabul etmiş sayılır.</li>
            </ul>
          </section>

          {/* Article 6 */}
          <section className="space-y-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
            <h4 className="font-black text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-black">6</span>
              Oyunlar, Sanal Çipler ve Bahis/Kumar Olmama Beyanı (Yasal Uyarı)
            </h4>
            <p>Platformda yer alan kart ve masa oyunları (Blackjack, Batak vb.), liderlik tablosu ve sanal puan/çip sistemi hakkında kesin yasal kurallar şunlardır:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>Sanal Eğlence Amaçlıdır:</strong> KapsApp bir kumar, bahis veya şans oyunu sitesi <strong>DEĞİLDİR</strong>. Platformdaki tüm oyunlar yalnızca sosyal etkileşim, zeka ve eğlence simülasyonu amacı taşır.</li>
              <li><strong>Maddi Değeri Yoktur:</strong> Oyunlarda kullanılan, kazanılan veya liderlik tablosunda sergilenen &quot;çip&quot;, &quot;bakiye&quot; veya &quot;puan&quot; birimleri tamamen sanaldır; gerçek parayla satın alınamaz, nakde, kripto varlığa, hediyeye veya herhangi bir maddi menfaate dönüştürülemez (para yatırma veya çekme işlemi yoktur).</li>
              <li><strong>Platform Dışı Ticaret Yasağı:</strong> Sanal puanların veya hesapların kullanıcılar arasında gerçek para karşılığında satılması, devredilmesi veya oyun sonuçlarının platform dışında herhangi bir maddi menfaate/bahse konu edilmesi kesinlikle yasaktır. Bu kuralı ihlal eden hesaplar derhal ve süresiz olarak kapatılır; doğabilecek her türlü hukuki ve cezai sorumluluk ilgili kullanıcılara aittir.</li>
              <li><strong>Yönetim Yetkisi:</strong> Platform yönetimi, oyun içi simülasyon dengesini sağlamak amacıyla sanal eğlence puanlarını sıfırlama, artırma veya azaltma hakkını saklı tutar.</li>
            </ul>
          </section>

          {/* Article 7 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">7</span>
              Kullanıcı İçerikleri, &quot;Uyar-Kaldır&quot; İlkesi ve Sorumluluk Sınırları
            </h4>
            <p>
              5651 sayılı Kanun’un 5. maddesi uyarınca Yer Sağlayıcı olan Platformumuz, kullanıcılar tarafından oluşturulan içerikleri (sohbet mesajları, oda başlıkları, paylaşılan ders notları/dosyalar, kamera ve ekran paylaşımları) önceden denetlemekle veya hukuka aykırı bir faaliyet olup olmadığını araştırmakla yükümlü değildir.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Kullanıcıların ekran paylaşımı, kamera veya sohbet yoluyla paylaştığı her türlü görsel, işitsel ve yazılı içeriğin hukuki ve cezai sorumluluğu münhasıran içeriği paylaşan kullanıcıya aittir.</li>
              <li>Telif haklarını, kişilik haklarını veya yürürlükteki mevzuatı ihlal ettiğini düşündüğünüz içerikler için <strong>destekkapsapp@gmail.com</strong> adresine &quot;Uyar-Kaldır&quot; bildirimi yapılabilir. Haklı bulunan bildirimler üzerine ilgili içerik derhal yayından kaldırılır ve ihlali gerçekleştiren hesap askıya alınır.</li>
            </ul>
          </section>

          {/* Article 8 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">8</span>
              Çerezler (Cookies), Yerel Depolama ve Yurt Dışı Bulut Altyapısı
            </h4>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Platformumuz, kullanıcı oturumunun sürdürülmesi (JWT kimlik doğrulama), güvenlik ve arayüz tercihlerinin (açık/koyu tema vb.) hatırlanması amacıyla tarayıcı yerel depolama alanı (<code>localStorage</code>) ve zorunlu oturum çerezlerini kullanmaktadır.</li>
              <li>Platformun veritabanı ve sunucu altyapısında uluslararası standartlara sahip bulut bilişim servisleri kullanıldığından, verileriniz KVKK Md. 9 kapsamında güvenli bulut sunucularında barındırılmaktadır.</li>
            </ul>
          </section>

          {/* Article 9 */}
          <section className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">9</span>
              İlgili Kişinin Hakları (KVKK Madde 11)
            </h4>
            <p>
              KVKK’nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme ve yasal şartlar çerçevesinde silinmesini veya yok edilmesini talep etme hakkına sahiptir. Tüm başvurularınızı <strong>destekkapsapp@gmail.com</strong> e-posta adresine iletebilirsiniz.
            </p>
          </section>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Resmi İletişim: <a href="mailto:destekkapsapp@gmail.com" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">destekkapsapp@gmail.com</a>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Kapat
            </button>
            {showAcceptButton && (
              <button
                type="button"
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Okudum ve Kabul Ediyorum</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

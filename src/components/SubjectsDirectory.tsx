import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { 
  Folder, 
  Search, 
  BookOpen, 
  Calculator, 
  Atom, 
  Globe, 
  Languages, 
  FlaskConical, 
  Dna, 
  Landmark, 
  ChevronRight, 
  Layers, 
  Sparkles,
  ArrowRight,
  FileText
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface SubjectsDirectoryProps {
  subjects: string[];
  onSelectSubject: (subject: string) => void;
  socket?: Socket | null;
}

interface SubjectMeta {
  title: string;
  trName: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
  borderHover: string;
  badgeBg: string;
  badgeText: string;
  tag: string;
}

const SUBJECT_METADATA: Record<string, SubjectMeta> = {
  "Turkish": {
    title: "Turkish",
    trName: "Türkçe & Edebiyat",
    desc: "Ders notları, edebiyat özetleri, deneme ve yazılar",
    icon: <BookOpen className="w-6 h-6 text-rose-500" />,
    gradient: "from-rose-500/15 via-rose-500/5 to-transparent",
    borderHover: "hover:border-rose-300 dark:hover:border-rose-800",
    badgeBg: "bg-rose-100 dark:bg-rose-950/60",
    badgeText: "text-rose-700 dark:text-rose-300",
    tag: "Dil & Edebiyat"
  },
  "Mathematics": {
    title: "Mathematics",
    trName: "Matematik & Geometri",
    desc: "Soru çözümleri, formüller, ispatlar ve analizler",
    icon: <Calculator className="w-6 h-6 text-indigo-500" />,
    gradient: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    borderHover: "hover:border-indigo-300 dark:hover:border-indigo-800",
    badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    tag: "Sayısal & Mantık"
  },
  "Physics": {
    title: "Physics",
    trName: "Fizik",
    desc: "Mekanik, optik, kuantum, deneyler ve problem setleri",
    icon: <Atom className="w-6 h-6 text-purple-500" />,
    gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
    borderHover: "hover:border-purple-300 dark:hover:border-purple-800",
    badgeBg: "bg-purple-100 dark:bg-purple-950/60",
    badgeText: "text-purple-700 dark:text-purple-300",
    tag: "Fen Bilimleri"
  },
  "Digital Society": {
    title: "Digital Society",
    trName: "Dijital Toplum & IT",
    desc: "Bilişim teknolojileri, dijital etik, yapay zeka ve toplum",
    icon: <Globe className="w-6 h-6 text-teal-500" />,
    gradient: "from-teal-500/15 via-teal-500/5 to-transparent",
    borderHover: "hover:border-teal-300 dark:hover:border-teal-800",
    badgeBg: "bg-teal-100 dark:bg-teal-950/60",
    badgeText: "text-teal-700 dark:text-teal-300",
    tag: "Teknoloji & Medya"
  },
  "English": {
    title: "English",
    trName: "İngilizce & Literature",
    desc: "Reading, essays, vocabulary listeleri ve dil pratikleri",
    icon: <Languages className="w-6 h-6 text-amber-500" />,
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    borderHover: "hover:border-amber-300 dark:hover:border-amber-800",
    badgeBg: "bg-amber-100 dark:bg-amber-950/60",
    badgeText: "text-amber-700 dark:text-amber-300",
    tag: "Yabancı Dil"
  },
  "Chemistry": {
    title: "Chemistry",
    trName: "Kimya",
    desc: "Reaksiyonlar, organik bileşikler ve laboratuvar notları",
    icon: <FlaskConical className="w-6 h-6 text-cyan-500" />,
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    borderHover: "hover:border-cyan-300 dark:hover:border-cyan-800",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950/60",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    tag: "Fen Bilimleri"
  },
  "Biology": {
    title: "Biology",
    trName: "Biyoloji",
    desc: "Hücre biyolojisi, genetik, ekoloji ve anatomi şemaları",
    icon: <Dna className="w-6 h-6 text-emerald-500" />,
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    borderHover: "hover:border-emerald-300 dark:hover:border-emerald-800",
    badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    tag: "Yaşam Bilimleri"
  },
  "TITC": {
    title: "TITC",
    trName: "T.C. İnkılap Tarihi & Coğrafya",
    desc: "Tarihi olaylar, kronolojiler, haritalar ve jeopolitik",
    icon: <Landmark className="w-6 h-6 text-orange-500" />,
    gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    borderHover: "hover:border-orange-300 dark:hover:border-orange-800",
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeText: "text-orange-700 dark:text-orange-300",
    tag: "Sosyal Bilimler"
  }
};

export default function SubjectsDirectory({
  subjects,
  onSelectSubject,
  socket
}: SubjectsDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number | string>>({});

  useEffect(() => {
    // Optionally fetch counts per folder
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    subjects.forEach((s) => {
      fetch(getApiUrl(`/api/folders/${encodeURIComponent(s)}/posts?limit=1`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && Array.isArray(data.posts)) {
            setCounts((prev) => ({ ...prev, [s]: data.posts.length > 0 ? (data.hasMore ? "50+" : `${data.posts.length}`) : "0" }));
          }
        })
        .catch(() => {});
    });
  }, [subjects]);

  const filteredSubjects = subjects.filter((s) => {
    const meta = SUBJECT_METADATA[s];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.toLowerCase().includes(q) ||
      (meta?.trName && meta.trName.toLowerCase().includes(q)) ||
      (meta?.desc && meta.desc.toLowerCase().includes(q)) ||
      (meta?.tag && meta.tag.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-200 touch-pan-y overscroll-y-contain">
      <div className="max-w-3xl mx-auto px-4 py-5 sm:py-7 pb-28">
        
        {/* Header Hero Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-12 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-100 mb-3 border border-white/20">
              <Layers size={13} className="text-blue-200" />
              <span>Ders & İçerik Klasörleri</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
              Ders Klasörleri & Arşiv
            </h1>
            <p className="text-blue-100/90 text-sm sm:text-base max-w-lg leading-relaxed">
              İlgilendiğin dersi seçerek paylaşılan tüm fotoğraf, video, soru çözümleri ve notlara ulaşabilirsin.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ders adı, konu veya anahtar kelime ara..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Temizle
            </button>
          )}
        </div>

        {/* Folders List Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredSubjects.map((subjectKey) => {
            const meta = SUBJECT_METADATA[subjectKey] || {
              title: subjectKey,
              trName: subjectKey,
              desc: "Ders arşivi ve paylaşımlar",
              icon: <Folder className="w-6 h-6 text-blue-500" />,
              gradient: "from-blue-500/10 to-transparent",
              borderHover: "hover:border-blue-300 dark:hover:border-blue-700",
              badgeBg: "bg-blue-100 dark:bg-blue-950/60",
              badgeText: "text-blue-700 dark:text-blue-300",
              tag: "Ders"
            };

            return (
              <div
                key={subjectKey}
                onClick={() => onSelectSubject(subjectKey)}
                className={`group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${meta.borderHover} active:scale-[0.985]`}
              >
                {/* Background Ambient Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                <div className="relative z-10">
                  {/* Top Row: Icon + Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800/90 shadow-sm border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {meta.icon}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.badgeBg} ${meta.badgeText} shrink-0`}>
                      {meta.tag}
                    </span>
                  </div>

                  {/* Titles */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    <span>{subjectKey}</span>
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {meta.trName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {meta.desc}
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="relative z-10 pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <div className="flex items-center gap-1 text-[11px]">
                    <FileText size={13} />
                    <span>Paylaşımları Gör</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Klasörü Aç</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSubjects.length === 0 && (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 mt-4">
            <Folder size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ders bulunamadı</h3>
            <p className="text-xs text-slate-400 mt-1">
              "{searchQuery}" araması ile eşleşen bir ders klasörü bulunmuyor.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

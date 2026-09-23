import React, { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Utensils, 
  BookOpen, 
  GraduationCap, 
  Sparkles, 
  Trash2, 
  Edit3, 
  X, 
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Layers,
  Filter,
  Eye
} from "lucide-react";
import { getApiUrl } from "../utils/api";

export interface AgendaEvent {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time?: string | null; // HH:mm
  event_type: "food" | "homework" | "exam" | "event";
  description?: string | null;
  created_by?: string;
  created_at?: string;
}

interface AgendaProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername?: string;
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const WEEKDAY_NAMES_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function Agenda({
  socket,
  currentUserId,
  currentUsername
}: AgendaProps) {
  const isEmirgan = (currentUsername || "").trim().toLowerCase() === "emirgan";

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  // Selected Day for Desktop Modal & Mobile Bottom Drawer
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState(false);

  // Dedicated Food Menu Modal / Bottom Drawer State
  const [selectedFoodEvent, setSelectedFoodEvent] = useState<AgendaEvent | null>(null);

  // Admin Event Form Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState<"food" | "homework" | "exam" | "event">("food");
  const [formDescription, setFormDescription] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Hover Tooltip state (Desktop)
  const [hoveredEvent, setHoveredEvent] = useState<{ event: AgendaEvent; x: number; y: number } | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedFoodEvent) setSelectedFoodEvent(null);
        else if (isFormModalOpen) setIsFormModalOpen(false);
        else if (isDayDrawerOpen) setIsDayDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFoodEvent, isFormModalOpen, isDayDrawerOpen]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Fetch events for current month (or all)
  const loadEvents = () => {
    setIsLoading(true);
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");

    if (socket && socket.connected) {
      socket.emit("get_agenda_events", { month: monthStr }, (data: AgendaEvent[]) => {
        setIsLoading(false);
        if (Array.isArray(data)) {
          setEvents(data);
        }
      });
    } else {
      fetch(getApiUrl(`/api/agenda?month=${monthStr}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then((res) => res.json())
        .then((data) => {
          setIsLoading(false);
          if (Array.isArray(data)) {
            setEvents(data);
          }
        })
        .catch((err) => {
          console.error("Agenda fetch error:", err);
          setIsLoading(false);
        });
    }
  };

  useEffect(() => {
    loadEvents();

    if (socket) {
      const onNewEvent = (newEvent: AgendaEvent) => {
        setEvents((prev) => {
          if (prev.some((e) => e.id === newEvent.id)) return prev;
          return [...prev, newEvent];
        });
      };
      const onUpdatedEvent = (updated: AgendaEvent) => {
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      };
      const onDeletedEvent = (data: { id: number }) => {
        setEvents((prev) => prev.filter((e) => e.id !== data.id));
      };
      const onRefresh = () => loadEvents();

      socket.on("new_agenda_event", onNewEvent);
      socket.on("agenda_event_updated", onUpdatedEvent);
      socket.on("agenda_event_deleted", onDeletedEvent);
      socket.on("agenda_updated", onRefresh);

      return () => {
        socket.off("new_agenda_event", onNewEvent);
        socket.off("agenda_event_updated", onUpdatedEvent);
        socket.off("agenda_event_deleted", onDeletedEvent);
        socket.off("agenda_updated", onRefresh);
      };
    }
  }, [socket, year, month]);

  // Calendar Grid Generation (Monday first)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const totalDays = lastDayOfMonth.getDate();
    // In JS getDay() returns 0 for Sunday, 1 for Monday...
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes index 6

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const dStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    // Next month padding days to complete 35 or 42 grid items
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const dStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    events.forEach((ev) => {
      if (selectedTypeFilter !== "all" && ev.event_type !== selectedTypeFilter) {
        return;
      }
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    });
    return map;
  }, [events, selectedTypeFilter]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayDate(today.toISOString().split("T")[0]);
    setIsDayDrawerOpen(true);
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDayDate(dateStr);
    setIsDayDrawerOpen(true);
  };

  const handleOpenAddForm = (dateStr?: string) => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDate(dateStr || selectedDayDate || new Date().toISOString().split("T")[0]);
    setFormTime("");
    setFormType("food");
    setFormDescription("");
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (ev: AgendaEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.event_date);
    setFormTime(ev.event_time || "");
    setFormType(ev.event_type);
    setFormDescription(ev.description || "");
    setIsFormModalOpen(true);
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Bu etkinliği takvimden silmek istediğinize emin misiniz?")) return;

    if (socket && socket.connected) {
      socket.emit("delete_agenda_event", id, (res: any) => {
        if (res?.error) alert(res.error);
        else {
          setEvents((prev) => prev.filter((e) => e.id !== id));
        }
      });
    } else {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      try {
        const res = await fetch(getApiUrl(`/api/agenda/${id}`), {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== id));
        }
      } catch (err) {
        console.error("Delete event error:", err);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) {
      alert("Lütfen etkinlik başlığı ve tarihi girin.");
      return;
    }

    setFormSubmitting(true);
    const payload = {
      title: formTitle.trim(),
      event_date: formDate,
      event_time: formTime.trim() || null,
      event_type: formType,
      description: formDescription.trim() || null,
    };

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");

    if (editingEvent) {
      // Update
      if (socket && socket.connected) {
        socket.emit("update_agenda_event", { id: editingEvent.id, ...payload }, (res: any) => {
          setFormSubmitting(false);
          if (res?.error) {
            alert(res.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        });
      } else {
        try {
          const res = await fetch(getApiUrl(`/api/agenda/${editingEvent.id}`), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
          });
          setFormSubmitting(false);
          if (res.ok) {
            setIsFormModalOpen(false);
            loadEvents();
          }
        } catch (err: any) {
          alert(err.message || "Güncelleme başarısız.");
          setFormSubmitting(false);
        }
      }
    } else {
      // Create
      if (socket && socket.connected) {
        socket.emit("create_agenda_event", payload, (res: any) => {
          setFormSubmitting(false);
          if (res?.error) {
            alert(res.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        });
      } else {
        try {
          const res = await fetch(getApiUrl("/api/agenda"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
          });
          setFormSubmitting(false);
          if (res.ok) {
            setIsFormModalOpen(false);
            loadEvents();
          }
        } catch (err: any) {
          alert(err.message || "Etkinlik eklenemedi.");
          setFormSubmitting(false);
        }
      }
    }
  };

  const getEventTypeStyles = (type: AgendaEvent["event_type"]) => {
    switch (type) {
      case "food":
        return {
          badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/50",
          pill: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60",
          dot: "bg-emerald-500",
          label: "Yemek Menüsü",
          icon: <Utensils size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        };
      case "homework":
        return {
          badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300/50",
          pill: "bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60",
          dot: "bg-blue-500",
          label: "Ödev / Proje",
          icon: <BookOpen size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
        };
      case "exam":
        return {
          badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300/50",
          pill: "bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60",
          dot: "bg-rose-500",
          label: "Sınav / Önemli",
          icon: <GraduationCap size={13} className="shrink-0 text-rose-600 dark:text-rose-400" />
        };
      default:
        return {
          badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/50",
          pill: "bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60",
          dot: "bg-amber-500",
          label: "Etkinlik",
          icon: <Sparkles size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
        };
    }
  };

  const selectedDayEvents = selectedDayDate ? eventsByDate[selectedDayDate] || [] : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      
      {/* Top Header & Calendar Controls */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 shadow-xs shrink-0 z-10 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Title & Month Navigation */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner shrink-0">
              <CalendarDays size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {MONTH_NAMES_TR[month]} {year}
                </h1>
                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 transition-colors cursor-pointer"
                >
                  Bugün
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Okul Ajandası, Yemek Menüsü ve Etkinlik Takvimi
              </p>
            </div>
          </div>

          {/* Action Bar: Month Prev/Next & Filter & Admin Add */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Prev / Next Month Buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Önceki Ay"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Sonraki Ay"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Admin Add Event Button */}
            {isEmirgan && (
              <button
                type="button"
                onClick={() => handleOpenAddForm()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Plus size={16} />
                <span>Etkinlik Ekle</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0 flex items-center gap-1">
            <Filter size={12} />
            Filtre:
          </span>
          {[
            { id: "all", label: "Tümü" },
            { id: "food", label: "🍲 Yemek Menüsü", dot: "bg-emerald-500" },
            { id: "homework", label: "📚 Ödev / Proje", dot: "bg-blue-500" },
            { id: "exam", label: "📝 Sınav / Önemli", dot: "bg-rose-500" },
            { id: "event", label: "🎯 Etkinlik", dot: "bg-amber-500" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedTypeFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTypeFilter === f.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar View Area */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors duration-200">
          
          {/* Weekday Header Row */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center py-2.5 font-bold text-xs text-slate-600 dark:text-slate-400">
            {WEEKDAY_NAMES_TR.map((wd, i) => (
              <div key={wd} className={i >= 5 ? "text-rose-500 dark:text-rose-400" : ""}>
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid (Monday to Sunday) */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 border-b border-slate-100 dark:border-slate-800/80">
            {calendarDays.map((dayItem) => {
              const dayEvents = eventsByDate[dayItem.dateStr] || [];
              const isWeekend = new Date(dayItem.dateStr).getDay() === 0 || new Date(dayItem.dateStr).getDay() === 6;

              return (
                <div
                  key={dayItem.dateStr}
                  onClick={() => handleDayClick(dayItem.dateStr)}
                  className={`min-h-[90px] sm:min-h-[120px] md:min-h-[135px] p-1.5 sm:p-2.5 flex flex-col justify-between transition-colors duration-150 cursor-pointer group relative ${
                    !dayItem.isCurrentMonth
                      ? "bg-slate-50/50 dark:bg-slate-950/40 text-slate-300 dark:text-slate-600 opacity-60"
                      : isWeekend
                      ? "bg-slate-50/30 dark:bg-slate-900/40"
                      : "bg-white dark:bg-slate-900 hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                  } ${dayItem.isToday ? "ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/20 dark:bg-blue-950/30" : ""}`}
                >
                  {/* Top Bar inside Date Box: Day Number & Today indicator & Add Button for admin */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all ${
                        dayItem.isToday
                          ? "bg-blue-600 text-white shadow-xs"
                          : dayItem.isCurrentMonth
                          ? isWeekend
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                          : "text-slate-400 dark:text-slate-600"
                      }`}
                    >
                      {dayItem.dayNumber}
                    </span>

                    {/* Quick Add icon on hover for admin */}
                    {isEmirgan && dayItem.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddForm(dayItem.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition-all cursor-pointer"
                        title="Bu Güne Etkinlik Ekle"
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>

                  {/* Desktop Event Pills */}
                  <div className={`hidden sm:flex flex-col gap-1 overflow-hidden my-auto ${dayItem.dateStr < new Date().toISOString().split("T")[0] ? "opacity-40 grayscale-[40%] hover:opacity-100 transition-opacity" : ""}`}>
                    {/* Compact Food Badge (Requirement 2) */}
                    {(() => {
                      const foodEvent = dayEvents.find((e) => e.event_type === "food");
                      const otherEvents = dayEvents.filter((e) => e.event_type !== "food");
                      const isPast = dayItem.dateStr < new Date().toISOString().split("T")[0];

                      return (
                        <>
                          {foodEvent && (
                            <div 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedFoodEvent(foodEvent); 
                              }}
                              className={`mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition-all truncate ${
                                isPast 
                                  ? 'bg-neutral-800/40 text-neutral-400 border-neutral-700/40 opacity-50 hover:opacity-90' 
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                              }`}
                              title="Yemek Menüsünü Gör"
                            >
                              <span>🍽️</span>
                              <span className="truncate">Yemek Menüsü</span>
                            </div>
                          )}

                          {otherEvents.slice(0, foodEvent ? 2 : 3).map((ev) => {
                            const st = getEventTypeStyles(ev.event_type);
                            return (
                              <div
                                key={ev.id}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredEvent({
                                    event: ev,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 8,
                                  });
                                }}
                                onMouseLeave={() => setHoveredEvent(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayDate(dayItem.dateStr);
                                  setIsDayDrawerOpen(true);
                                }}
                                className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold truncate flex items-center gap-1 transition-all ${st.pill}`}
                              >
                                {st.icon}
                                <span className="truncate">{ev.title}</span>
                                {ev.event_time && (
                                  <span className="text-[10px] opacity-75 ml-auto shrink-0 font-mono">
                                    {ev.event_time}
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {otherEvents.length > (foodEvent ? 2 : 3) && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 pl-1">
                              +{otherEvents.length - (foodEvent ? 2 : 3)} daha...
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Mobile Compact Indicators (Food Icon & Dots) */}
                  <div className="sm:hidden flex items-center justify-center gap-1 mt-auto flex-wrap">
                    {(() => {
                      const foodEvent = dayEvents.find((e) => e.event_type === "food");
                      const otherEvents = dayEvents.filter((e) => e.event_type !== "food");

                      return (
                        <>
                          {foodEvent && (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFoodEvent(foodEvent);
                              }}
                              className="text-[11px] cursor-pointer"
                              title="Yemek Menüsü"
                            >
                              🍽️
                            </span>
                          )}
                          {otherEvents.slice(0, foodEvent ? 3 : 4).map((ev) => {
                            const st = getEventTypeStyles(ev.event_type);
                            return (
                              <span
                                key={ev.id}
                                className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                              />
                            );
                          })}
                          {otherEvents.length > (foodEvent ? 3 : 4) && (
                            <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 leading-none">
                              +{otherEvents.length - (foodEvent ? 3 : 4)}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop Hover Tooltip */}
      {hoveredEvent && (
        <div
          style={{
            position: "fixed",
            left: `${hoveredEvent.x}px`,
            top: `${hoveredEvent.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="bg-slate-900/95 dark:bg-slate-800/95 text-white p-3 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700/60 max-w-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold mb-1 text-blue-400">
            {getEventTypeStyles(hoveredEvent.event.event_type).icon}
            <span>{getEventTypeStyles(hoveredEvent.event.event_type).label}</span>
            {hoveredEvent.event.event_time && (
              <span className="text-slate-300 font-mono text-[11px] ml-auto">
                🕒 {hoveredEvent.event.event_time}
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm text-white mb-1">
            {hoveredEvent.event.title}
          </h4>
          {hoveredEvent.event.description && (
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-4">
              {hoveredEvent.event.description}
            </p>
          )}
        </div>
      )}

      {/* Dedicated Food Menu Modal / Bottom Drawer (Requirement 3) */}
      {selectedFoodEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setSelectedFoodEvent(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-emerald-500/20 max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Emerald Gradient Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-start justify-between relative overflow-hidden shrink-0">
              {/* Decorative culinary background pattern */}
              <div className="absolute -right-6 -bottom-6 text-white/10 pointer-events-none select-none">
                <Utensils size={120} />
              </div>

              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-white flex items-center justify-center text-2xl shadow-inner shrink-0 border border-white/20">
                  🍽️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/20">
                      Öğle Yemeği Menüsü
                    </span>
                    {selectedFoodEvent.event_time && (
                      <span className="text-xs text-white/90 font-mono flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-md">
                        <Clock size={11} /> {selectedFoodEvent.event_time}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 leading-tight tracking-tight">
                    {new Date(selectedFoodEvent.event_date).toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    FMV Özel Işık Okulları (1-4. Sınıflar)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFoodEvent(null)}
                className="z-10 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Kapat (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items List */}
            <div className="p-5 overflow-y-auto space-y-3 bg-slate-50/60 dark:bg-slate-900/60 flex-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Günün Menü Kalemleri</span>
                </h4>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Dengeli Beslenme
                </span>
              </div>

              {(() => {
                const lines = (selectedFoodEvent.description || "")
                  .split("\n")
                  .map((l) => l.replace(/^[•\-\*]\s*/, "").trim())
                  .filter(Boolean);

                if (lines.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-500">Bu gün için henüz menü detayı girilmemiş.</p>
                    </div>
                  );
                }

                // Helper to give dish-specific icons & colors
                const getDishCategory = (dishName: string, index: number) => {
                  const lower = dishName.toLowerCase();
                  if (lower.includes("çorba") || lower.includes("corba")) {
                    return { icon: "🍲", tag: "Çorba", color: "from-amber-500/10 to-orange-500/5 text-amber-700 dark:text-amber-300 border-amber-500/20" };
                  }
                  if (lower.includes("köfte") || lower.includes("şinitzel") || lower.includes("tavuk") || lower.includes("kebap") || lower.includes("fileto") || lower.includes("kuru fasulye") || lower.includes("musakka") || lower.includes("dolma") || lower.includes("bezelye") || lower.includes("mercimek yemeği") || lower.includes("graten") || lower.includes("hünkar") || lower.includes("balık")) {
                    return { icon: "🍖", tag: "Ana Yemek", color: "from-rose-500/10 to-red-500/5 text-rose-700 dark:text-rose-300 border-rose-500/20" };
                  }
                  if (lower.includes("pilav") || lower.includes("makarna") || lower.includes("püre") || lower.includes("erişte") || lower.includes("kuskus") || lower.includes("spagetti")) {
                    return { icon: "🍚", tag: "Garnitür / Pilav", color: "from-blue-500/10 to-indigo-500/5 text-blue-700 dark:text-blue-300 border-blue-500/20" };
                  }
                  if (lower.includes("salata") || lower.includes("ayran") || lower.includes("yoğurt") || lower.includes("cacık") || lower.includes("turşu") || lower.includes("tatlı") || lower.includes("helva") || lower.includes("puding") || lower.includes("sütlaç") || lower.includes("meyve") || lower.includes("komposto") || lower.includes("trileçe")) {
                    return { icon: "🥗", tag: "Salata / Tatlı / İçecek", color: "from-emerald-500/10 to-teal-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };
                  }
                  const defaultIcons = ["🍲", "🍖", "🍚", "🥗", "🍎"];
                  return { icon: defaultIcons[index % defaultIcons.length], tag: `Kalem #${index + 1}`, color: "from-slate-500/10 to-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-500/20" };
                };

                return lines.map((dish, idx) => {
                  const cat = getDishCategory(dish, idx);
                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-3.5 shadow-2xs hover:shadow-xs transition-all flex items-center gap-3.5 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/70 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cat.color}`}>
                            {cat.tag}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-[15px] mt-0.5 truncate sm:whitespace-normal">
                          {dish}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer with actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {isEmirgan && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const ev = selectedFoodEvent;
                        setSelectedFoodEvent(null);
                        handleOpenEditForm(ev);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 size={14} /> Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = selectedFoodEvent.id;
                        setSelectedFoodEvent(null);
                        handleDeleteEvent(id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedFoodEvent(null)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal / Mobile Bottom Drawer */}
      {isDayDrawerOpen && selectedDayDate && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200">
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {new Date(selectedDayDate).toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {selectedDayEvents.length} kayıtlı etkinlik & menü
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEmirgan && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddForm(selectedDayDate);
                    }}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                    title="Bu Güne Yeni Ekle"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDayDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Events List Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {selectedDayEvents.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarDays size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    Bu güne ait etkinlik veya menü bulunamadı
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isEmirgan ? "Yukarıdaki '+' butonuna tıklayarak yeni etkinlik veya yemek menüsü ekleyebilirsiniz." : "Bu tarih için planlanan bir etkinlik bulunmuyor."}
                  </p>
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const st = getEventTypeStyles(ev.event_type);
                  return (
                    <div
                      key={ev.id}
                      className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group"
                    >
                      {/* Left color bar */}
                      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${st.dot}`} />

                      <div className="flex items-start justify-between gap-2 mb-2 pl-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${st.badge}`}>
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                          {ev.event_time && (
                            <span className="flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                              <Clock size={12} />
                              <span>{ev.event_time}</span>
                            </span>
                          )}
                        </div>

                        {/* Admin Action Buttons */}
                        {isEmirgan && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(ev)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base pl-1.5 mb-1.5">
                        {ev.title}
                      </h4>

                      {ev.description && (
                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-1.5 bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          {ev.description}
                          {ev.event_type === "food" && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDayDrawerOpen(false);
                                  setSelectedFoodEvent(ev);
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <span>🍽️ Özel Menü Kartını Aç</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDayDrawerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Create / Edit Modal Form */}
      {isFormModalOpen && isEmirgan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {editingEvent ? "Etkinliği Düzenle" : "Yeni Etkinlik / Menü Ekle"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sadece 'emirgan' yöneticisi tarafından düzenlenebilir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Etkinlik Başlığı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Günün Öğle Yemeği Menüsü / Matematik Sınavı"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tarih *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Saat (İsteğe Bağlı)
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Etkinlik Türü *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: "food", label: "🍲 Yemek", color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
                    { type: "homework", label: "📚 Ödev", color: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
                    { type: "exam", label: "📝 Sınav", color: "border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
                    { type: "event", label: "🎯 Etkinlik", color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setFormType(item.type as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        formType === item.type
                          ? `${item.color} ring-2 ring-blue-500`
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Açıklama / Menü Kalemleri / Detaylar
                </label>
                <textarea
                  rows={4}
                  placeholder="Yemek menüsü kalemleri, ödev detayları veya etkinlik açıklaması..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Kaydediliyor..." : editingEvent ? "Güncelle" : "Yayınla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

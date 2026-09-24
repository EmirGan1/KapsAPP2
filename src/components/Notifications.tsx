import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { 
  Bell, MessageSquare, UserPlus, UserCheck, Heart, MessageCircle, Users, CheckCheck, Sparkles,
  ShieldCheck, RefreshCw, XCircle, CheckCircle, Clock
} from "lucide-react";
import { AppNotification } from "../types";

interface PendingUser {
  id: number;
  username: string;
  email?: string;
  created_at?: string;
  status?: string;
}

export default function Notifications({
  socket,
  onNotificationClick,
}: {
  socket: Socket | null;
  onNotificationClick?: (notif: AppNotification) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUsername = localStorage.getItem("lan_username") || "";
  const isEmirgan = currentUsername.toLowerCase() === "emirgan";

  // Admin Pending Users Queue State (Directly from DB)
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchPendingUsers = async () => {
    if (!isEmirgan) return;
    setLoadingPending(true);
    try {
      const res = await fetch("/api/admin/pending-users", {
        headers: {
          "X-Username": "emirgan"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching pending users:", err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApproveUser = async (e: React.MouseEvent, pendingUserId: number) => {
    e.stopPropagation();
    setActionLoadingId(pendingUserId);
    try {
      const res = await fetch(`/api/admin/users/${pendingUserId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Username": "emirgan"
        }
      });
      const data = await res.json();
      if (res.ok) {
        setPendingUsers(prev => prev.filter(u => u.id !== pendingUserId));
        fetchNotifications();
      } else {
        alert(data.error || "İşlem başarısız oldu.");
      }
    } catch (err) {
      console.error(err);
      alert("Bağlantı hatası oluştu.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectUser = async (e: React.MouseEvent, pendingUserId: number) => {
    e.stopPropagation();
    if (!window.confirm("Bu kullanıcının kaydını reddetmek ve silmek istediğinize emin misiniz?")) {
      return;
    }
    setActionLoadingId(pendingUserId);
    try {
      const res = await fetch(`/api/admin/users/${pendingUserId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Username": "emirgan"
        }
      });
      const data = await res.json();
      if (res.ok) {
        setPendingUsers(prev => prev.filter(u => u.id !== pendingUserId));
        fetchNotifications();
      } else {
        alert(data.error || "İşlem başarısız oldu.");
      }
    } catch (err) {
      console.error(err);
      alert("Bağlantı hatası oluştu.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const fetchNotifications = () => {
    if (!socket) return;
    socket.emit("get_notifications", (data: AppNotification[]) => {
      setNotifications(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (isEmirgan) {
      fetchPendingUsers();
      // Regular fallback check every 15 seconds for admin
      const interval = setInterval(fetchPendingUsers, 15000);
      return () => clearInterval(interval);
    }
  }, [isEmirgan]);

  useEffect(() => {
    if (!socket) return;

    fetchNotifications();

    const onNewNotification = (notif: AppNotification) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      if (isEmirgan && notif.type === 'user_approval_request') {
        fetchPendingUsers();
      }
    };

    const onNotificationsUpdated = () => {
      fetchNotifications();
      if (isEmirgan) fetchPendingUsers();
    };

    const onPendingApprovalEvent = () => {
      if (isEmirgan) fetchPendingUsers();
    };

    socket.on("new_notification", onNewNotification);
    socket.on("notifications_updated", onNotificationsUpdated);
    socket.on("user:pending_approval", onPendingApprovalEvent);
    socket.on("user:approved", onPendingApprovalEvent);
    socket.on("user:rejected", onPendingApprovalEvent);

    return () => {
      socket.off("new_notification", onNewNotification);
      socket.off("notifications_updated", onNotificationsUpdated);
      socket.off("user:pending_approval", onPendingApprovalEvent);
      socket.off("user:approved", onPendingApprovalEvent);
      socket.off("user:rejected", onPendingApprovalEvent);
    };
  }, [socket, isEmirgan]);

  const handleMarkAllRead = () => {
    if (!socket) return;
    socket.emit("mark_notifications_read");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
  };

  const handleItemClick = (notif: AppNotification) => {
    if (!notif.read && socket) {
      socket.emit("mark_single_notification_read", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: 1 } : n))
      );
    }
    if (onNotificationClick) {
      onNotificationClick(notif);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_message":
      case "dm":
        return (
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <MessageSquare size={18} />
          </div>
        );
      case "like":
        return (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
            <Heart size={18} className="fill-rose-500 text-rose-500" />
          </div>
        );
      case "comment":
        return (
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <MessageCircle size={18} />
          </div>
        );
      case "follow":
      case "friend_request":
        return (
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <UserPlus size={18} />
          </div>
        );
      case "friend_accept":
        return (
          <div className="p-2.5 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl shrink-0">
            <UserCheck size={18} />
          </div>
        );
      case "user_approval_request":
        return (
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <UserPlus size={18} />
          </div>
        );
      case "new_group_message":
      case "group_invite":
        return (
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
            <Users size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shrink-0">
            <Bell size={18} />
          </div>
        );
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Bildirimler</h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
              {unreadCount} yeni
            </span>
          )}
          {isEmirgan && pendingUsers.length > 0 && (
            <span className="text-xs font-bold text-white bg-amber-600 px-2 py-0.5 rounded-full animate-pulse">
              {pendingUsers.length} onay bekliyor
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEmirgan && (
            <button
              onClick={fetchPendingUsers}
              disabled={loadingPending}
              title="Onay Listesini Yenile"
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} className={loadingPending ? "animate-spin" : ""} />
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
            >
              <CheckCheck size={15} />
              <span>Tümünü Okundu Say</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 max-w-3xl mx-auto w-full">
        
        {/* 1. EMİRGAN BAĞIMSIZ ONAY KARTI / YÖNETİCİ ONAY HAVUZU */}
        {isEmirgan && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 dark:to-transparent border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Onay Bekleyen Üyelik Başvuruları</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500 text-white shadow-xs">
                      {pendingUsers.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kayıt olan kullanıcılar siz onaylayana kadar sisteme giriş yapamaz.
                  </p>
                </div>
              </div>

              <button
                onClick={fetchPendingUsers}
                disabled={loadingPending}
                className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={loadingPending ? "animate-spin" : ""} />
                <span>Yenile</span>
              </button>
            </div>

            {loadingPending && pendingUsers.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-amber-500" />
                <span>Onay listesi yükleniyor...</span>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="py-3 px-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle size={15} />
                  <span>Şu anda onay bekleyen yeni üyelik kaydı bulunmuyor.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingUsers.map((pUser) => (
                  <div
                    key={pUser.id}
                    className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold text-base flex items-center justify-center border border-amber-200 dark:border-amber-800 shrink-0">
                        {pUser.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {pUser.username}
                          </span>
                          <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            Onay Bekliyor
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          <Clock size={12} />
                          <span>
                            {pUser.created_at ? new Date(pUser.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Yeni Kayıt"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={(e) => handleApproveUser(e, pUser.id)}
                        disabled={actionLoadingId === pUser.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {actionLoadingId === pUser.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle size={13} />
                        )}
                        <span>Onayla</span>
                      </button>

                      <button
                        onClick={(e) => handleRejectUser(e, pUser.id)}
                        disabled={actionLoadingId === pUser.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {actionLoadingId === pUser.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <XCircle size={13} />
                        )}
                        <span>Reddet</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. STANDART BİLDİRİMLER LİSTESİ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Bildirimler yükleniyor...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <div className="w-14 h-14 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
              <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Henüz bildirim yok</p>
              <p className="text-xs text-slate-400 mt-0.5">Arkadaşlık istekleri, mesajlar ve beğeniler burada görünür.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 shadow-xs hover:shadow-md ${
                  !notif.read
                    ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-500/20"
                    : "bg-white/80 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900"
                }`}
              >
                {getIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${!notif.read ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'} leading-snug`}>
                      {notif.content}
                    </p>
                    {!notif.read && (
                      <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 shadow-sm shadow-blue-500/50"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(notif.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                      Görüntüle →
                    </span>
                  </div>

                  {/* Inline notification action for user approval request */}
                  {isEmirgan && notif.type === 'user_approval_request' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        let meta: any = {};
                        try {
                          meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : (notif.metadata || {});
                        } catch(e){}
                        const pendingUserId = meta?.pendingUserId;
                        if (!pendingUserId) return null;
                        return (
                          <>
                            <button
                              onClick={(e) => handleApproveUser(e, pendingUserId)}
                              disabled={actionLoadingId === pendingUserId}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle size={12} />
                              <span>✓ Onayla</span>
                            </button>
                            <button
                              onClick={(e) => handleRejectUser(e, pendingUserId)}
                              disabled={actionLoadingId === pendingUserId}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              <XCircle size={12} />
                              <span>✕ Reddet</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

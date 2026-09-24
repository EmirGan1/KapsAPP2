import React, { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import { 
  Users, Laptop, Trash2, CheckCircle2, 
  RefreshCw, Megaphone, Search, Clock, 
  Unlock, Crown, AlertTriangle, Eye, UserX,
  Radio, HardDrive, Terminal, X, KeyRound, Sparkles, Copy,
  Check, Edit3, ShieldAlert, Ban, UserCheck, ShieldCheck
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface AdminOverview {
  totalUsers: number;
  onlineCount: number;
  bannedUsersCount: number;
  bannedHardwareCount: number;
  totalPosts: number;
  totalMessages: number;
  totalAnnouncements: number;
  uptimeSeconds: number;
  memoryRssMb: number;
  nodeVersion: string;
  serverTime: string;
}

interface UserItem {
  id: number;
  username: string;
  email?: string;
  avatar?: string | null;
  color?: string;
  status?: string;
  is_admin?: number;
  is_banned?: number;
  isBanned?: number;
  banned_at?: string;
  ban_reason?: string;
  created_at?: string;
  last_seen?: string;
  device_fingerprint?: string;
  last_device_id?: string;
  signup_ip?: string;
  last_ip?: string;
  isOnline?: boolean;
}

interface PendingUserItem {
  id: number;
  username: string;
  email?: string;
  signup_ip?: string;
  last_ip?: string;
  device_fingerprint?: string;
  last_device_id?: string;
  created_at?: string;
  status?: string;
}

interface BannedHardwareItem {
  id: number;
  device_fingerprint: string;
  banned_user_id?: string;
  banned_by?: string;
  reason?: string;
  banned_at?: string;
}

interface AccessLogItem {
  id: number;
  userId?: number;
  ipAddress?: string;
  action?: string;
  timestamp?: string;
}

interface AdminPanelProps {
  socket: Socket | null;
  currentUsername: string;
  onUserClick?: (userId: number) => void;
  onPendingCountChange?: (count: number) => void;
}

export default function AdminPanel({ socket, currentUsername, onUserClick, onPendingCountChange }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "users" | "hardware" | "broadcast" | "logs">("pending");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  
  // Data
  const [pendingUsers, setPendingUsers] = useState<PendingUserItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [bannedHardware, setBannedHardware] = useState<BannedHardwareItem[]>([]);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userFilter, setUserFilter] = useState<"all" | "banned" | "active" | "admins" | "pending">("all");

  // Modals & Action States
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  
  const [generatedPasswordInfo, setGeneratedPasswordInfo] = useState<{ username: string; password: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);

  const [selectedUserForUsername, setSelectedUserForUsername] = useState<UserItem | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState<string>("");

  const [selectedUserForBan, setSelectedUserForBan] = useState<UserItem | null>(null);
  const [banType, setBanType] = useState<"account" | "hardware">("account");
  const [banReason, setBanReason] = useState<string>("Kural ihlali sebebiyle erişiminiz engellendi.");

  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserItem | null>(null);

  // Broadcast
  const [broadcastTitle, setBroadcastTitle] = useState<string>("📢 YÖNETİCİ DUYURUSU");
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [broadcastType, setBroadcastType] = useState<"urgent" | "info" | "warning">("urgent");

  // Manual Hardware Ban
  const [manualHardwareFp, setManualHardwareFp] = useState<string>("");
  const [manualHardwareReason, setManualHardwareReason] = useState<string>("Kural ihlali sebebiyle donanım banlandı.");

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("lan_token") || "";
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Username": "emirgan"
    };
  };

  // 1. Fetch Pending Users
  const fetchPendingUsers = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/emirgan/pending-users"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.users || [];
        setPendingUsers(list);
        if (onPendingCountChange) onPendingCountChange(list.length);
      }
    } catch (e) {
      console.error("Error fetching pending users:", e);
    }
  }, [onPendingCountChange]);

  // 2. Fetch All Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl("/api/emirgan/all-users");
      const res = await fetch(baseUrl, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Error fetching all users:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Fetch Overview & Hardware
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/overview"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error("Error fetching overview:", e);
    }
  }, []);

  const fetchBannedHardware = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/banned-hardware"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBannedHardware(data.hardware || []);
      }
    } catch (e) {
      console.error("Error fetching banned hardware:", e);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/access-logs"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  }, []);

  // Initial load & socket listeners
  useEffect(() => {
    fetchPendingUsers();
    fetchUsers();
    fetchOverview();

    const interval = setInterval(() => {
      fetchPendingUsers();
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchPendingUsers, fetchUsers, fetchOverview]);

  useEffect(() => {
    if (!socket) return;

    const handlePendingUpdate = () => {
      fetchPendingUsers();
      fetchUsers();
      fetchOverview();
    };

    socket.on("user:pending_approval", handlePendingUpdate);
    socket.on("pending_count_updated", handlePendingUpdate);
    socket.on("user:approved", handlePendingUpdate);
    socket.on("user:rejected", handlePendingUpdate);
    socket.on("user_banned", handlePendingUpdate);
    socket.on("user_unbanned", handlePendingUpdate);
    socket.on("user_deleted", handlePendingUpdate);

    return () => {
      socket.off("user:pending_approval", handlePendingUpdate);
      socket.off("pending_count_updated", handlePendingUpdate);
      socket.off("user:approved", handlePendingUpdate);
      socket.off("user:rejected", handlePendingUpdate);
      socket.off("user_banned", handlePendingUpdate);
      socket.off("user_unbanned", handlePendingUpdate);
      socket.off("user_deleted", handlePendingUpdate);
    };
  }, [socket, fetchPendingUsers, fetchUsers, fetchOverview]);

  // Tab change handler
  const handleTabChange = (tab: "pending" | "users" | "hardware" | "broadcast" | "logs") => {
    setActiveTab(tab);
    if (tab === "pending") fetchPendingUsers();
    if (tab === "users") fetchUsers();
    if (tab === "hardware") fetchBannedHardware();
    if (tab === "logs") { fetchLogs(); fetchOverview(); }
  };

  // User Actions
  const handleApproveUser = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${userId}/approve`), {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Kullanıcı hesabı başarıyla onaylandı.", "success");
        fetchPendingUsers();
        fetchUsers();
      } else {
        showToast(data.error || "Onaylama başarısız oldu.", "error");
      }
    } catch (e: any) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectUser = async (userId: number) => {
    if (!window.confirm("Bu kayıt başvurusunu reddetmek ve kullanıcıyı silmek istediğinize emin misiniz?")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${userId}/reject`), {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Kayıt başvurusu reddedildi ve silindi.", "success");
        fetchPendingUsers();
        fetchUsers();
      } else {
        showToast(data.error || "İşlem başarısız oldu.", "error");
      }
    } catch (e: any) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUserForPassword || !newPasswordInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${selectedUserForPassword.id}/change-password`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newPassword: newPasswordInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Şifre başarıyla güncellendi.", "success");
        setSelectedUserForPassword(null);
        setNewPasswordInput("");
      } else {
        showToast(data.error || "Şifre güncellenemedi.", "error");
      }
    } catch (e: any) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePassword = async (user: UserItem) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${user.id}/generate-password`), {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.plainPassword) {
        setGeneratedPasswordInfo({ username: user.username, password: data.plainPassword });
        setCopiedPass(false);
        showToast(`"${user.username}" için yeni şifre oluşturuldu.`, "success");
      } else {
        showToast(data.error || "Şifre oluşturulamadı.", "error");
      }
    } catch (e: any) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!selectedUserForUsername || !newUsernameInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${selectedUserForUsername.id}/update-username`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newUsername: newUsernameInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı adı güncellendi.", "success");
        setSelectedUserForUsername(null);
        setNewUsernameInput("");
        fetchUsers();
      } else {
        showToast(data.error || "Kullanıcı adı güncellenemedi.", "error");
      }
    } catch (e: any) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async (user: UserItem) => {
    const isBanned = user.is_banned === 1 || user.isBanned === 1;
    if (isBanned) {
      // Unban
      setActionLoading(true);
      try {
        const res = await fetch(getApiUrl("/api/admin/unban-user"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "Kullanıcı yasağı kaldırıldı.", "success");
          fetchUsers();
        } else {
          showToast(data.error || "İşlem başarısız oldu.", "error");
        }
      } catch (e) {
        showToast("Bağlantı hatası oluştu.", "error");
      } finally {
        setActionLoading(false);
      }
    } else {
      setSelectedUserForBan(user);
      setBanType("account");
    }
  };

  const handleExecuteBan = async () => {
    if (!selectedUserForBan) return;
    setActionLoading(true);
    try {
      const endpoint = banType === "hardware" 
        ? `/api/admin/users/${selectedUserForBan.id}/ban-hardware`
        : `/api/admin/users/${selectedUserForBan.id}/ban-account`;

      const res = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: banReason,
          hardwareFingerprint: selectedUserForBan.device_fingerprint || selectedUserForBan.last_device_id
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı başarıyla banlandı.", "success");
        setSelectedUserForBan(null);
        fetchUsers();
        fetchBannedHardware();
      } else {
        showToast(data.error || "Banlama başarısız oldu.", "error");
      }
    } catch (e) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${selectedUserForDelete.id}`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı ve tüm verileri kalıcı olarak silindi.", "success");
        setSelectedUserForDelete(null);
        fetchUsers();
        fetchPendingUsers();
      } else {
        showToast(data.error || "Silme işlemi başarısız oldu.", "error");
      }
    } catch (e) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/broadcast-alert"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Canlı duyuru tüm kullanıcılara gönderildi.", "success");
        setBroadcastMessage("");
      } else {
        showToast(data.error || "Duyuru gönderilemedi.", "error");
      }
    } catch (e) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanHardware = async (item: BannedHardwareItem) => {
    if (!window.confirm(`"${item.device_fingerprint}" donanım banını kaldırmak istediğinize emin misiniz?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/unban-hardware"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ device_fingerprint: item.device_fingerprint, id: item.id })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Donanım banı kaldırıldı.", "success");
        fetchBannedHardware();
      } else {
        showToast(data.error || "İşlem başarısız oldu.", "error");
      }
    } catch (e) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddManualHardwareBan = async () => {
    if (!manualHardwareFp.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/ban-hardware-manual"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          device_fingerprint: manualHardwareFp.trim(),
          reason: manualHardwareReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Cihaz parmak izi banlandı.", "success");
        setManualHardwareFp("");
        fetchBannedHardware();
      } else {
        showToast(data.error || "İşlem başarısız oldu.", "error");
      }
    } catch (e) {
      showToast("Bağlantı hatası oluştu.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchQuery = !q || u.username.toLowerCase().includes(q) || String(u.id).includes(q) || (u.last_ip && u.last_ip.includes(q));
    if (!matchQuery) return false;

    if (userFilter === "banned") return u.is_banned === 1 || u.isBanned === 1;
    if (userFilter === "active") return (u.is_banned === 0 || !u.is_banned) && (u.isBanned === 0 || !u.isBanned) && u.status !== 'pending';
    if (userFilter === "admins") return u.is_admin === 1 || u.username.toLowerCase() === 'emirgan';
    if (userFilter === "pending") return u.status === 'pending';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 ${
          toastMessage.type === "success" 
            ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40" 
            : "bg-rose-950/90 text-rose-200 border-rose-500/40"
        }`}>
          {toastMessage.type === "success" ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertTriangle size={18} className="text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black">
            <Crown size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                👑 Emirgan Süper Yönetim Paneli
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ROOT YÖNETİCİ
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Kayıt onayları, kullanıcı şifreleri, donanım güvenliği ve 5651 denetim merkezi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchPendingUsers();
              fetchUsers();
              fetchOverview();
              showToast("Veriler yenilendi.", "success");
            }}
            disabled={loading || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading || actionLoading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 sm:px-6 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => handleTabChange("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "pending"
              ? "bg-slate-950 text-amber-400 border-amber-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <ShieldCheck size={16} />
          <span>📋 Kayıt Onayları</span>
          {pendingUsers.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-amber-500 text-slate-950 animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "users"
              ? "bg-slate-950 text-blue-400 border-blue-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Users size={16} />
          <span>👥 Tüm Kullanıcılar & Şifre İşlemleri</span>
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("hardware")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "hardware"
              ? "bg-slate-950 text-rose-400 border-rose-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Laptop size={16} />
          <span>💻 Donanım Banları</span>
          {bannedHardware.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-950 text-rose-300 border border-rose-800">
              {bannedHardware.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("broadcast")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "broadcast"
              ? "bg-slate-950 text-amber-400 border-amber-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Megaphone size={16} />
          <span>📢 Canlı Duyuru</span>
        </button>

        <button
          onClick={() => handleTabChange("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "logs"
              ? "bg-slate-950 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Terminal size={16} />
          <span>📊 Sistem & Loglar</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        
        {/* ========================================================= */}
        {/* TAB 1: KAYIT ONAYLARI (PENDING USERS)                     */}
        {/* ========================================================= */}
        {activeTab === "pending" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-black shadow-md">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Onay Bekleyen Kayıt Başvuruları</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                        {pendingUsers.length} bekleyen
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kullanıcılar siz onay verene kadar sisteme giriş yapamaz. Onayladığınız an girişleri anında açılır.
                    </p>
                  </div>
                </div>

                <button
                  onClick={fetchPendingUsers}
                  className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Listeyi Yenile</span>
                </button>
              </div>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-base font-bold text-white">Harika! Onay Bekleyen Kayıt Yok</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Sisteme yeni bir kullanıcı kayıt olduğunda anında bu ekranda ve sol menü bildirim rozetinizde belirecektir.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-lg shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-white truncate">
                            {user.username}
                          </span>
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ONAY BEKLİYOR
                          </span>
                          <span className="text-xs text-slate-500">
                            #ID: {user.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-slate-500" />
                            {user.created_at ? new Date(user.created_at).toLocaleString("tr-TR") : "Yeni"}
                          </span>
                          {user.signup_ip && (
                            <span className="flex items-center gap-1">
                              <Radio size={13} className="text-slate-500" />
                              IP: {user.signup_ip}
                            </span>
                          )}
                          {(user.device_fingerprint || user.last_device_id) && (
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500 truncate max-w-[200px]" title={user.device_fingerprint || user.last_device_id}>
                              <Laptop size={13} />
                              FP: {(user.device_fingerprint || user.last_device_id || "").slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck size={16} />
                        <span>✓ Hesabı Onayla</span>
                      </button>

                      <button
                        onClick={() => handleRejectUser(user.id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 hover:text-white text-rose-300 text-xs font-bold rounded-xl border border-rose-500/40 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        <span>✕ Reddet ve Sil</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TÜM KULLANICILAR & ŞİFRE İŞLEMLERİ                 */}
        {/* ========================================================= */}
        {activeTab === "users" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kullanıcı adı, ID veya IP ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {(["all", "active", "banned", "pending", "admins"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                      userFilter === f
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {f === "all" ? "Tümü" : f === "active" ? "Aktif" : f === "banned" ? "Banlı" : f === "pending" ? "Bekleyen" : "Yöneticiler"}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3.5 sm:p-4">Kullanıcı</th>
                      <th className="p-3.5 sm:p-4">Durum</th>
                      <th className="p-3.5 sm:p-4 hidden md:table-cell">Kayıt / Son Görülme</th>
                      <th className="p-3.5 sm:p-4 hidden lg:table-cell">IP & Cihaz</th>
                      <th className="p-3.5 sm:p-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                          Arama kriterlerine uygun kullanıcı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isBanned = user.is_banned === 1 || user.isBanned === 1;
                        const isPending = user.status === "pending";
                        const isRoot = user.username.toLowerCase() === "emirgan";

                        return (
                          <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 sm:p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white ${user.color || "bg-blue-600"}`}>
                                  {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate">{user.username}</span>
                                    {isRoot && (
                                      <Crown size={14} className="text-amber-400 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 font-mono">ID: {user.id}</span>
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4">
                              <div className="flex flex-col gap-1 items-start">
                                {isPending ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    ONAY BEKLİYOR
                                  </span>
                                ) : isBanned ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    YASAKLI (BAN)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    AKTİF
                                  </span>
                                )}

                                {user.isOnline && (
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                    Çevrimiçi
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 hidden md:table-cell text-xs text-slate-400">
                              <div>Kayıt: {user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"}</div>
                              <div className="text-[11px] text-slate-500">
                                Son: {user.last_seen ? new Date(user.last_seen).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 hidden lg:table-cell text-xs text-slate-400 font-mono">
                              <div className="truncate max-w-[150px]">{user.last_ip || user.signup_ip || "-"}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                {user.device_fingerprint ? `FP: ${user.device_fingerprint.slice(0, 10)}...` : "-"}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isPending && (
                                  <button
                                    onClick={() => handleApproveUser(user.id)}
                                    title="Hesabı Onayla"
                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 size={15} />
                                  </button>
                                )}

                                {/* Şifre Değiştir */}
                                <button
                                  onClick={() => {
                                    setSelectedUserForPassword(user);
                                    setNewPasswordInput("");
                                  }}
                                  title="Yeni Şifre Belirle"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <KeyRound size={15} />
                                </button>

                                {/* Rastgele Şifre Ata & Göster */}
                                <button
                                  onClick={() => handleGeneratePassword(user)}
                                  title="Rastgele Şifre Ata ve Ekranda Göster"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Sparkles size={15} />
                                </button>

                                {/* İsim Değiştir */}
                                <button
                                  onClick={() => {
                                    setSelectedUserForUsername(user);
                                    setNewUsernameInput(user.username);
                                  }}
                                  title="Kullanıcı Adını Değiştir"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Edit3 size={15} />
                                </button>

                                {/* Ban / Dondur Toggle */}
                                {!isRoot && (
                                  <button
                                    onClick={() => handleToggleBan(user)}
                                    title={isBanned ? "Banı Kaldır" : "Hesabı Dondur / Banla"}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isBanned
                                        ? "bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800"
                                        : "bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                                    }`}
                                  >
                                    {isBanned ? <Unlock size={15} /> : <Ban size={15} />}
                                  </button>
                                )}

                                {/* Cihaz / Donanım Banı */}
                                {!isRoot && (
                                  <button
                                    onClick={() => {
                                      setSelectedUserForBan(user);
                                      setBanType("hardware");
                                    }}
                                    title="Cihaz (Hardware) Banı Uygula"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Laptop size={15} />
                                  </button>
                                )}

                                {/* Kalıcı Sil */}
                                {!isRoot && (
                                  <button
                                    onClick={() => setSelectedUserForDelete(user)}
                                    title="Kullanıcıyı ve Tüm Verilerini Kalıcı Olarak Sil"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DONANIM BANLARI (HARDWARE BANS)                    */}
        {/* ========================================================= */}
        {activeTab === "hardware" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Manuel Donanım Banı Ekleme */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Laptop size={16} className="text-rose-400" />
                <span>Manuel Donanım Parmak İzi (Hardware FP) Banlama</span>
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Hardware Fingerprint / Cihaz ID..."
                  value={manualHardwareFp}
                  onChange={(e) => setManualHardwareFp(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                />
                <input
                  type="text"
                  placeholder="Yasaklama Sebebi..."
                  value={manualHardwareReason}
                  onChange={(e) => setManualHardwareReason(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={handleAddManualHardwareBan}
                  disabled={!manualHardwareFp.trim() || actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Yasakla
                </button>
              </div>
            </div>

            {/* Yasaklı Donanımlar Listesi */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>Yasaklanmış Cihazlar ({bannedHardware.length})</span>
                <button
                  onClick={fetchBannedHardware}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> Yenile
                </button>
              </h3>

              {bannedHardware.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Yasaklanmış cihaz veya donanım bulunmuyor.
                </p>
              ) : (
                <div className="space-y-2">
                  {bannedHardware.map((hw) => (
                    <div
                      key={hw.id || hw.device_fingerprint}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-rose-300 font-bold truncate">
                          {hw.device_fingerprint}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Sebep: {hw.reason || "Kural ihlali"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnbanHardware(hw)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        Banı Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CANLI DUYURU & ACİL BİLDİRİM                      */}
        {/* ========================================================= */}
        {activeTab === "broadcast" && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 font-bold">
                <Megaphone size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Anlık Sistem Duyurusu / Acil Bildirim</h2>
                <p className="text-xs text-slate-400">
                  Tüm aktif kullanıcılara canlı modal veya bildirim olarak doğrudan iletilir.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru Başlığı</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru Türü</label>
                <div className="flex gap-3">
                  {(["urgent", "info", "warning"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBroadcastType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                        broadcastType === t
                          ? "bg-amber-500 text-slate-950 font-black shadow-md"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {t === "urgent" ? "🚨 Acil" : t === "info" ? "ℹ️ Bilgi" : "⚠️ Uyarı"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru İçeriği</label>
                <textarea
                  rows={4}
                  placeholder="Duyuru metnini buraya yazın..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || actionLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Canlı Duyuruyu Herkese Gönder
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: SİSTEM & 5651 LOGLARI                              */}
        {/* ========================================================= */}
        {activeTab === "logs" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {overview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Toplam Kullanıcı</p>
                  <p className="text-xl font-black text-white mt-1">{overview.totalUsers}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Çevrimiçi</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{overview.onlineCount}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Yasaklı Hesaplar</p>
                  <p className="text-xl font-black text-rose-400 mt-1">{overview.bannedUsersCount}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Sunucu RAM</p>
                  <p className="text-xl font-black text-blue-400 mt-1">{overview.memoryRssMb} MB</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>5651 Sayılı Kanun Erişim ve Güvenlik Kayıtları</span>
                <button
                  onClick={fetchLogs}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> Yenile
                </button>
              </h3>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs max-h-96 overflow-y-auto space-y-1.5">
                {logs.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Kayıt bulunamadı.</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="text-slate-400 flex items-center justify-between gap-2 border-b border-slate-900 pb-1">
                      <span className="text-slate-300">
                        [{new Date(l.timestamp || "").toLocaleString("tr-TR")}] UID:{l.userId || "anon"} IP:{l.ipAddress}
                      </span>
                      <span className="text-amber-400 font-bold uppercase">{l.action}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODALS SECTION                                            */}
      {/* ========================================================= */}

      {/* Modal 1: Şifre Değiştir (Custom Password) */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound size={18} className="text-blue-400" />
                <span>Şifre Belirle: {selectedUserForPassword.username}</span>
              </h3>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Bu kullanıcı için yeni bir şifre belirleyin. Şifre doğrudan bcrypt ile şifrelenip güncellenecektir.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Şifre</label>
              <input
                type="text"
                placeholder="Yeni şifreyi girin (en az 4 karakter)..."
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForPassword(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={!newPasswordInput.trim() || newPasswordInput.trim().length < 4 || actionLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Şifreyi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Rastgele Şifre Ata & Ekranda Göster (Copyable) */}
      {generatedPasswordInfo && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-lg">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-base font-bold text-white">Yeni Geçici Şifre Oluşturuldu</h3>
              </div>
              <button
                onClick={() => setGeneratedPasswordInfo(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              <strong className="text-amber-400 font-bold">{generatedPasswordInfo.username}</strong> kullanıcısının şifresi başarıyla sıfırlandı ve veritabanına işlendi. Kullanıcıya iletmeniz gereken yeni şifre:
            </p>

            <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-black text-amber-300 tracking-wider">
                {generatedPasswordInfo.password}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPasswordInfo.password);
                  setCopiedPass(true);
                  setTimeout(() => setCopiedPass(false), 2500);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition-colors cursor-pointer"
              >
                {copiedPass ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedPass ? "Kopyalandı!" : "Kopyala"}</span>
              </button>
            </div>

            <button
              onClick={() => setGeneratedPasswordInfo(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Modal 3: Kullanıcı Adı Değiştir */}
      {selectedUserForUsername && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-400" />
                <span>Kullanıcı Adı Güncelle</span>
              </h3>
              <button
                onClick={() => setSelectedUserForUsername(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Kullanıcı Adı</label>
              <input
                type="text"
                value={newUsernameInput}
                onChange={(e) => setNewUsernameInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForUsername(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleUpdateUsername}
                disabled={!newUsernameInput.trim() || actionLoading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Ban / Donanım Banı Uygulama */}
      {selectedUserForBan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban size={18} className="text-rose-400" />
                <span>Yasakla: {selectedUserForBan.username}</span>
              </h3>
              <button
                onClick={() => setSelectedUserForBan(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Yasaklama Türü</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBanType("account")}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    banType === "account"
                      ? "bg-rose-600 text-white border-rose-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  Hesap Banı (Dondur)
                </button>
                <button
                  type="button"
                  onClick={() => setBanType("hardware")}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    banType === "hardware"
                      ? "bg-purple-600 text-white border-purple-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  💻 Cihaz / Donanım Banı
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yasaklama Sebebi</label>
              <textarea
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForBan(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleExecuteBan}
                disabled={actionLoading}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Yasağı Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Kalıcı Kullanıcı Silme Onayı */}
      {selectedUserForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-600 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">Hesabı Kalıcı Olarak Sil?</h3>
              <p className="text-xs text-slate-300 mt-1">
                <strong className="text-white font-bold">{selectedUserForDelete.username}</strong> hesabını ve buna bağlı tüm mesajları, gönderileri ve verileri veritabanından kalıcı olarak silmek üzeresiniz. Bu işlem <u>geri alınamaz</u>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleHardDeleteUser}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-black text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Evet, Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

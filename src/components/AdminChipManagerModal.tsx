import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { X, Coins, Plus, Minus, Check, Search, Sparkles, Shield, RefreshCw } from 'lucide-react';
import Avatar from './Avatar';
import { getApiUrl } from '../utils/api';

export interface AdminTargetUser {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  chips?: number;
}

interface AdminChipManagerModalProps {
  socket: Socket | null;
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  preselectedUser?: AdminTargetUser | null;
  onSuccess?: (userId: number, newChips: number) => void;
}

export default function AdminChipManagerModal({
  socket,
  isOpen,
  onClose,
  currentUsername,
  preselectedUser,
  onSuccess
}: AdminChipManagerModalProps) {
  const [usersList, setUsersList] = useState<AdminTargetUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminTargetUser | null>(preselectedUser || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [amount, setAmount] = useState<string>('5000');
  const [mode, setMode] = useState<'ADD' | 'SUBTRACT' | 'SET'>('ADD');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isEmirgan = currentUsername?.toLowerCase().trim() === 'emirgan';

  // Load all users for emirgan to choose
  const fetchUsers = () => {
    setIsLoading(true);
    fetch(getApiUrl('/api/users'))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsersList(data);
          if (preselectedUser) {
            const found = data.find((u: any) => u.id === preselectedUser.id);
            if (found) setSelectedUser(found);
          }
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen && isEmirgan) {
      fetchUsers();
    }
  }, [isOpen, isEmirgan]);

  useEffect(() => {
    if (preselectedUser) {
      setSelectedUser(preselectedUser);
    }
  }, [preselectedUser]);

  if (!isOpen || !isEmirgan) return null;

  const filteredUsers = usersList.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApply = async () => {
    if (!selectedUser) {
      setStatusMessage({ text: 'Lütfen bir kullanıcı seçin!', type: 'error' });
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount < 0) {
      setStatusMessage({ text: 'Geçerli bir miktar girin!', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const payload = {
      targetUserId: selectedUser.id,
      amount: numAmount,
      mode
    };

    if (socket && socket.connected) {
      socket.emit('admin_update_chips', payload, (res: any) => {
        setIsLoading(false);
        if (res?.success) {
          setStatusMessage({ text: `Bakiye güncellendi: ${res.newChips?.toLocaleString()} 🪙`, type: 'success' });
          if (onSuccess) onSuccess(selectedUser.id, res.newChips);
          setSelectedUser(prev => prev ? { ...prev, chips: res.newChips } : null);
          fetchUsers();
        } else {
          setStatusMessage({ text: res?.error || 'Güncelleme başarısız oldu.', type: 'error' });
        }
      });
    } else {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(getApiUrl('/api/admin/chips/update'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        setIsLoading(false);
        if (data?.success) {
          setStatusMessage({ text: `Bakiye güncellendi: ${data.newChips?.toLocaleString()} 🪙`, type: 'success' });
          if (onSuccess) onSuccess(selectedUser.id, data.newChips);
          setSelectedUser(prev => prev ? { ...prev, chips: data.newChips } : null);
          fetchUsers();
        } else {
          setStatusMessage({ text: data?.error || 'Güncelleme başarısız.', type: 'error' });
        }
      } catch (err: any) {
        setIsLoading(false);
        setStatusMessage({ text: err.message || 'Bağlantı hatası.', type: 'error' });
      }
    }
  };

  const applyPreset = (presetAmount: number, presetMode: 'ADD' | 'SET') => {
    setAmount(presetAmount.toString());
    setMode(presetMode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Coins size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-amber-400">
                  ⚡ Emirgan Sanal Bakiye Yönetimi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kullanıcıların sanal çip miktarını doğrudan ayarla, artır veya azalt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3 text-xs font-bold flex items-center justify-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-400 border-b border-emerald-800'
              : 'bg-rose-950 text-rose-400 border-b border-rose-800'
          }`}>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* User Selector */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Hedef Kullanıcı Seç</span>
              {selectedUser && (
                <span className="text-emerald-400">
                  Mevcut Bakiye: {(selectedUser.chips ?? 1000).toLocaleString()} 🪙
                </span>
              )}
            </label>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kullanıcı adı ara..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Users Horizontal/Vertical List */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
              {filteredUsers.slice(0, 20).map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar url={u.avatar} name={u.username} color={u.color || undefined} size={6} />
                      <span className="font-bold text-xs truncate">{u.username}</span>
                      {u.username.toLowerCase() === 'emirgan' && (
                        <span className="text-[10px] text-amber-400 font-black">👑</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {(u.chips ?? 1000).toLocaleString()} 🪙
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operation Mode Selector */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">İşlem Türü</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('ADD')}
                className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'ADD'
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Plus size={14} /> Bakiye Ekle (+)
              </button>
              <button
                type="button"
                onClick={() => setMode('SUBTRACT')}
                className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'SUBTRACT'
                    ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Minus size={14} /> Bakiye Düş (-)
              </button>
              <button
                type="button"
                onClick={() => setMode('SET')}
                className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'SET'
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300 font-extrabold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles size={14} /> Doğrudan Eşitle (=)
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">Miktar (🪙 Sanal Çip)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Miktar girin..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-black text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5">Hızlı Şablonlar</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(10000, 'ADD')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
              >
                +10.000 🪙
              </button>
              <button
                type="button"
                onClick={() => applyPreset(50000, 'ADD')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
              >
                +50.000 🪙
              </button>
              <button
                type="button"
                onClick={() => applyPreset(250000, 'ADD')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
              >
                +250.000 🪙
              </button>
              <button
                type="button"
                onClick={() => applyPreset(1000000, 'ADD')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-400"
              >
                +1 Milyon 🪙
              </button>
              <button
                type="button"
                onClick={() => applyPreset(1000, 'SET')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-400"
              >
                = 1.000 🪙
              </button>
              <button
                type="button"
                onClick={() => applyPreset(0, 'SET')}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-rose-400"
              >
                Sıfırla (0 🪙)
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {selectedUser ? `${selectedUser.username} kullanıcısına uygulanacak.` : 'Kullanıcı seçilmedi.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleApply}
              disabled={isLoading || !selectedUser}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isLoading ? 'İşleniyor...' : 'Bakiyeyi Güncelle'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

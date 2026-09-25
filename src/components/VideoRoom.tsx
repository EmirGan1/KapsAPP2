import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Headphones, 
  PhoneOff, 
  Crown, 
  Camera, 
  CameraOff, 
  MoreVertical, 
  X, 
  VolumeX, 
  AlertCircle,
  Radio,
  Monitor,
  MonitorOff,
  Volume2,
  Volume1,
  ChevronUp
} from 'lucide-react';
import { VoiceParticipant } from '../types';
import Avatar from './Avatar';
import VideoCell from './VideoCell';
import { checkCanScreenShare, isMobileBrowser } from '../utils/webrtcConfig';

interface VideoTileProps {
  participant: VoiceParticipant;
  isSelf: boolean;
  isHost: boolean;
  isCurrentRoomHost: boolean;
  stream: MediaStream | null;
  isDeafened: boolean;
  isScreenSharing?: boolean;
  isSpotlight?: boolean;
  onKick?: (userId: number) => void;
  onForceMute?: (userId: number) => void;
  onForceCameraOff?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}

export const VideoTile = React.memo(({
  participant,
  isSelf,
  isHost,
  isCurrentRoomHost,
  stream,
  isDeafened,
  isScreenSharing = false,
  isSpotlight = false,
  onKick,
  onForceMute,
  onForceCameraOff,
  onUserClick
}: VideoTileProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if stream has active video track
  const videoTrack = stream ? stream.getVideoTracks()[0] : null;
  const isSharingActive = isScreenSharing || Boolean(participant.isScreenSharing);
  const hasLiveVideoTrack = Boolean(
    videoTrack && 
    (videoTrack.readyState === 'live' || isVideoPlaying) && 
    videoTrack.enabled && 
    (!participant.isVideoOff || isSharingActive)
  );

  // Outside click handler for host control dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const showVideo = Boolean(hasLiveVideoTrack || (isSharingActive && stream));

  return (
    <div className={`relative w-full h-full min-h-[140px] sm:min-h-[160px] rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex flex-col justify-between shadow-md group ${
      isSharingActive
        ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.45)] ring-2 ring-blue-500/80'
        : participant.isSpeaking
        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/80'
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      
      {/* Video Stream Element with Anti-Black Screen VideoCell */}
      {stream && (
        <div className={`absolute inset-0 w-full h-full bg-neutral-950 transition-opacity duration-300 ${
          showVideo ? 'opacity-100 z-0' : 'opacity-0 -z-10 pointer-events-none'
        }`}>
          <VideoCell
            stream={stream}
            isLocal={isSelf}
            isScreenSharing={isSharingActive}
            username={participant.username}
            onVideoPlaying={setIsVideoPlaying}
          />
        </div>
      )}

      {/* Video Off / Fallback: Centered Avatar Placeholder */}
      {!showVideo && (
        <div 
          onClick={() => onUserClick && onUserClick(participant.id)}
          className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 cursor-pointer select-none"
        >
          <div className="relative">
            <div 
              className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl text-white shadow-xl transition-all duration-300 ${
                participant.isSpeaking
                  ? 'ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-900 scale-105 animate-pulse'
                  : 'ring-2 ring-slate-700'
              }`}
            >
              <Avatar url={participant.avatar} color={participant.color} name={participant.username} size={14} />
            </div>

            {/* Camera Off Mini Badge */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800/90 text-slate-300 flex items-center justify-center border-2 border-slate-900 shadow">
              <CameraOff size={11} />
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-2.5 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60">
            {isSharingActive ? 'Ekran Aktarılıyor...' : 'Kamera Kapalı'}
          </span>
        </div>
      )}

      {/* Top Overlay: Badges & Host Actions Menu */}
      <div className="relative z-10 p-2 sm:p-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {isScreenSharing && (
            <span className="px-2 py-0.5 rounded-lg bg-blue-600/90 text-white text-[10px] font-black flex items-center gap-1 shadow-md border border-blue-400/40 animate-pulse">
              <Monitor size={11} />
              <span>Ekran Paylaşımı</span>
            </span>
          )}
          {isHost && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm">
              <Crown size={10} />
              Host
            </span>
          )}
          {participant.isMuted && (
            <span className="p-1 rounded bg-rose-600/90 text-white text-[10px] font-bold flex items-center shadow-sm" title="Mikrofon Kapalı">
              <MicOff size={11} />
            </span>
          )}
          {!isScreenSharing && participant.isVideoOff && (
            <span className="p-1 rounded bg-slate-800/90 text-slate-300 text-[10px] font-bold flex items-center shadow-sm" title="Kamera Kapalı">
              <VideoOff size={11} />
            </span>
          )}
        </div>

        {/* Host Control Actions Dropdown */}
        {isCurrentRoomHost && !isSelf && (
          <div className="relative pointer-events-auto" ref={menuRef}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Yönetici İşlemleri"
              className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-sm transition-colors border border-white/10 cursor-pointer"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-800 truncate">
                  {participant.username}
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceMute && onForceMute(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MicOff size={13} />
                  <span>Sustur (Mute)</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceCameraOff && onForceCameraOff(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-blue-400 hover:bg-blue-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CameraOff size={13} />
                  <span>Kamerayı Kapatmaya Zorla</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onKick && onKick(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <X size={13} />
                  <span>Odadan At (Kick)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Overlay: Participant Name & Speaking Pulse */}
      <div className="relative z-10 p-2 sm:p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
            {participant.username} {isSelf && '(Sen)'}
          </span>
        </div>

        {participant.isSpeaking && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Konuşuyor
          </span>
        )}
      </div>
    </div>
  );
});

VideoTile.displayName = 'VideoTile';

interface VideoRoomViewProps {
  roomName: string;
  hostUsername: string;
  maxParticipants: number;
  participants: VoiceParticipant[];
  currentUserId: number;
  isHost: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isScreenAudioEnabled?: boolean;
  isScreenShareSupported?: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  mediaPermissionError: string | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: (withAudio?: boolean) => void;
  onStartScreenShare?: (withAudio: boolean) => void;
  onStopScreenShare?: () => void;
  onToggleDeafen: () => void;
  onLeaveRoom: () => void;
  onKickUser?: (userId: number) => void;
  onForceMuteUser?: (userId: number) => void;
  onForceCameraOffUser?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}

export function VideoRoomView({
  roomName,
  hostUsername,
  maxParticipants,
  participants,
  currentUserId,
  isHost,
  localStream,
  remoteStreams,
  isMuted,
  isVideoOff,
  isScreenSharing = false,
  isScreenAudioEnabled = false,
  isScreenShareSupported = true,
  isDeafened,
  isSpeakingLocal,
  mediaPermissionError,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onStartScreenShare,
  onStopScreenShare,
  onToggleDeafen,
  onLeaveRoom,
  onKickUser,
  onForceMuteUser,
  onForceCameraOffUser,
  onUserClick
}: VideoRoomViewProps) {
  const count = participants.length;
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const [deviceToastMessage, setDeviceToastMessage] = useState<string | null>(null);
  const screenShareMenuRef = useRef<HTMLDivElement>(null);
  const deviceToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveScreenShareSupported = Boolean(isScreenShareSupported && checkCanScreenShare());

  const showDeviceToast = (msg: string) => {
    if (deviceToastTimeoutRef.current) {
      clearTimeout(deviceToastTimeoutRef.current);
    }
    setDeviceToastMessage(msg);
    deviceToastTimeoutRef.current = setTimeout(() => {
      setDeviceToastMessage(null);
      deviceToastTimeoutRef.current = null;
    }, 3500);
  };

  // Close screen share menu when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (screenShareMenuRef.current && !screenShareMenuRef.current.contains(e.target as Node)) {
        setShowScreenShareMenu(false);
      }
    };
    if (showScreenShareMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [showScreenShareMenu]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (deviceToastTimeoutRef.current) {
        clearTimeout(deviceToastTimeoutRef.current);
      }
    };
  }, []);

  // Find if someone is currently sharing screen
  const screenSharer = participants.find((p) => {
    if (p.id === currentUserId) return isScreenSharing || p.isScreenSharing;
    return p.isScreenSharing;
  });

  const isSpotlightMode = Boolean(screenSharer);

  // Dynamic Smart Grid calculation tailored for mobile & desktop
  const getGridClasses = (total: number) => {
    if (total <= 1) {
      return 'w-full max-w-2xl mx-auto h-full max-h-[70vh] flex items-center justify-center';
    }
    if (total === 2) {
      return 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-4xl mx-auto w-full h-full max-h-[72vh] auto-rows-fr';
    }
    if (total <= 4) {
      return 'grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-3.5 max-w-4xl mx-auto w-full h-full max-h-[74vh] auto-rows-fr';
    }
    if (total <= 6) {
      return 'grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-w-5xl mx-auto w-full h-full max-h-[75vh] auto-rows-fr';
    }
    if (total <= 9) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2 max-w-6xl mx-auto w-full h-full max-h-[76vh] auto-rows-fr';
    }
    if (total <= 12) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-6xl mx-auto w-full h-full auto-rows-fr';
    }
    if (total <= 16) {
      return 'grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-7xl mx-auto w-full h-full auto-rows-fr';
    }
    return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2 max-w-7xl mx-auto w-full h-full auto-rows-fr';
  };

  const handleScreenShareClick = () => {
    if (isScreenSharing) {
      if (onStopScreenShare) {
        onStopScreenShare();
      } else if (onToggleScreenShare) {
        onToggleScreenShare();
      }
      setShowScreenShareMenu(false);
      return;
    }

    if (!effectiveScreenShareSupported) {
      showDeviceToast('Mobil Android Chrome ve tablet tarayıcılarında sistem ekran paylaşımı desteklenmemektedir. Lütfen bilgisayar tarayıcısından bağlanın.');
      return;
    }

    setShowScreenShareMenu((prev) => !prev);
  };

  const handleSelectScreenOption = (withAudio: boolean) => {
    setShowScreenShareMenu(false);
    if (onStartScreenShare) {
      onStartScreenShare(withAudio);
    } else if (onToggleScreenShare) {
      onToggleScreenShare(withAudio);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-[100dvh] w-full overflow-hidden relative bg-slate-950">
      
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {roomName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Crown size={12} className="text-amber-500" />
                {hostUsername}
              </span>
              <span>•</span>
              <span className="font-semibold text-blue-400">{count}/{maxParticipants} Kişi</span>
              {isSpotlightMode && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Monitor size={12} />
                    {screenSharer?.username} ekran paylaşıyor
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="min-h-[38px] px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
        >
          <PhoneOff size={15} />
          <span className="hidden xs:inline">Ayrıl</span>
        </button>
      </div>

      {/* Permission alert */}
      {mediaPermissionError && (
        <div className="mx-4 mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle size={16} className="shrink-0 text-amber-400" />
          <span>{mediaPermissionError}</span>
        </div>
      )}

      {/* Video Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 pb-28 flex flex-col justify-center items-center touch-pan-y overscroll-y-contain">
        
        {/* Spotlight Mode: Large Screen Share with Participant Thumbnails Below */}
        {isSpotlightMode && screenSharer ? (
          <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-3 justify-center items-center">
            
            {/* Featured Large Screen Share Tile */}
            <div className="w-full flex-1 min-h-[220px] max-h-[62vh] sm:max-h-[66vh] rounded-2xl overflow-hidden shadow-2xl">
              {(() => {
                const isSelf = screenSharer.id === currentUserId;
                const stream = isSelf ? localStream : (remoteStreams.get(screenSharer.socketId) || null);
                return (
                  <VideoTile
                    participant={screenSharer}
                    isSelf={isSelf}
                    isHost={screenSharer.isHost}
                    isCurrentRoomHost={isHost}
                    stream={stream}
                    isDeafened={isDeafened}
                    isScreenSharing={true}
                    isSpotlight={true}
                    onKick={onKickUser}
                    onForceMute={onForceMuteUser}
                    onForceCameraOff={onForceCameraOffUser}
                    onUserClick={onUserClick}
                  />
                );
              })()}
            </div>

            {/* Other Participants Strip Below */}
            {participants.length > 1 && (
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 shrink-0 max-h-[120px] sm:max-h-[140px]">
                {participants
                  .filter((p) => p.id !== screenSharer.id)
                  .map((participant) => {
                    const isSelf = participant.id === currentUserId;
                    const stream = isSelf ? localStream : (remoteStreams.get(participant.socketId) || null);

                    return (
                      <div key={participant.id} className="w-full h-[110px] sm:h-[130px]">
                        <VideoTile
                          participant={participant}
                          isSelf={isSelf}
                          isHost={participant.isHost}
                          isCurrentRoomHost={isHost}
                          stream={stream}
                          isDeafened={isDeafened}
                          isScreenSharing={isSelf ? isScreenSharing : Boolean(participant.isScreenSharing)}
                          onKick={onKickUser}
                          onForceMute={onForceMuteUser}
                          onForceCameraOff={onForceCameraOffUser}
                          onUserClick={onUserClick}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          /* Normal Dynamic Smart Grid */
          <div className="w-full h-full flex flex-col justify-center items-center">
            <div className={getGridClasses(count)}>
              {participants.map((participant) => {
                const isSelf = participant.id === currentUserId;
                const stream = isSelf 
                  ? localStream 
                  : (remoteStreams.get(participant.socketId) || null);

                return (
                  <div key={participant.id} className="w-full h-full flex items-center justify-center min-h-[140px] sm:min-h-[160px]">
                    <VideoTile
                      participant={participant}
                      isSelf={isSelf}
                      isHost={participant.isHost}
                      isCurrentRoomHost={isHost}
                      stream={stream}
                      isDeafened={isDeafened}
                      isScreenSharing={isSelf ? isScreenSharing : Boolean(participant.isScreenSharing)}
                      onKick={onKickUser}
                      onForceMute={onForceMuteUser}
                      onForceCameraOff={onForceCameraOffUser}
                      onUserClick={onUserClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Dock */}
      <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none z-30">
        <div className="relative pointer-events-auto">
          
          {/* Screen Sharing Audio Option Selection Popover */}
          {showScreenShareMenu && !isScreenSharing && (
            <div 
              ref={screenShareMenuRef}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 z-50 text-slate-100 animate-in fade-in slide-in-from-bottom-3 duration-150 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Monitor size={14} className="text-blue-400" />
                  Ekran Paylaşımı Seçenekleri
                </span>
                <button
                  onClick={() => setShowScreenShareMenu(false)}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="space-y-2">
                {/* Option 1: Silent Screen Share */}
                <button
                  onClick={() => handleSelectScreenOption(false)}
                  className="w-full p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 hover:bg-slate-700 text-left border border-slate-700/60 hover:border-blue-500/50 transition-all flex items-start gap-3 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Monitor size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                      🖥️ Yalnızca Ekranı Paylaş (Sessiz)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      Sadece ekran veya uygulama penceresi görüntüsü aktarılır.
                    </div>
                  </div>
                </button>

                {/* Option 2: Screen Share with System Audio */}
                <button
                  onClick={() => handleSelectScreenOption(true)}
                  className="w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 hover:from-blue-900/60 hover:to-indigo-900/60 text-left border border-blue-600/40 hover:border-blue-400 transition-all flex items-start gap-3 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Volume2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors flex items-center gap-1.5">
                      🔊 Ekran ve Sistem Sesini Paylaş (Sesli)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      Ekranla birlikte video, müzik ve oyun sesleri de aktarılır.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Device Toast Notification for Unsupported Mobile / Tablet Screen Share */}
          {deviceToastMessage && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-sm w-max px-3.5 py-2 bg-slate-900/95 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/40 shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
              <AlertCircle size={15} className="shrink-0 text-amber-400" />
              <span>{deviceToastMessage}</span>
              <button 
                onClick={() => setDeviceToastMessage(null)}
                className="ml-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="bg-slate-900/95 backdrop-blur-xl px-4 sm:px-8 py-2.5 sm:py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-2.5 sm:gap-4 max-w-lg w-full justify-around">
            
            {/* Mic Button */}
            <button
              onClick={onToggleMute}
              title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
              className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                isMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                  : isSpeakingLocal
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Camera Button */}
            <button
              onClick={onToggleVideo}
              title={isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
              className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                isVideoOff
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/30'
              }`}
            >
              {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>

            {/* Screen Share Button with Options */}
            <button
              onClick={handleScreenShareClick}
              title={
                !effectiveScreenShareSupported
                  ? 'Ekran paylaşımı yalnızca bilgisayar (masaüstü) tarayıcılarında desteklenmektedir'
                  : isScreenSharing
                  ? 'Ekran Paylaşımını Durdur'
                  : 'Ekranını Paylaş'
              }
              className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer relative ${
                !effectiveScreenShareSupported
                  ? 'bg-slate-800/40 text-slate-500 border border-slate-800/80 hover:bg-slate-800/60 opacity-60'
                  : isScreenSharing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
              {!effectiveScreenShareSupported ? (
                <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded bg-slate-850 border border-slate-700 text-[8px] font-bold text-slate-400">
                  PC
                </span>
              ) : (
                !isScreenSharing && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">
                    +
                  </span>
                )
              )}
            </button>

            {/* Deafen Button */}
            <button
              onClick={onToggleDeafen}
              title={isDeafened ? 'Sesi Aç' : 'Kulaklığı Kapat (Sağırlaştır)'}
              className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                isDeafened
                  ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
            </button>

            {/* Leave Button */}
            <button
              onClick={onLeaveRoom}
              title="Odadan Ayrıl"
              className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

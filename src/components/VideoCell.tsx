import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface VideoCellProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  username?: string;
  className?: string;
  onVideoPlaying?: (isPlaying: boolean) => void;
}

/**
 * VideoCell Component
 * Siyah Ekran ve Donma Sorunlarını Engelleyen Yüksek Performanslı Video Render Bileşeni:
 * 1. autoPlay, playsInline ve muted={isLocal} donanım özellikleri
 * 2. useEffect içinde doğrudan videoEl.srcObject = stream ataması
 * 3. Otomatik oynatma kısıtlamalarına karşı sessize alıp yeniden deneme mekanizması (Fallback)
 * 4. Ekran paylaşımında 'object-contain', kamerada 'object-cover' dinamik ölçekleme
 * 5. Track unmute ve loadedmetadata olaylarına anlık tepki
 */
export const VideoCell: React.FC<VideoCellProps> = ({
  stream,
  isLocal = false,
  isScreenSharing = false,
  username,
  className = '',
  onVideoPlaying
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const handlePlay = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    try {
      await videoEl.play();
      setIsPlaying(true);
      if (onVideoPlaying) onVideoPlaying(true);
    } catch (err) {
      console.warn('[VideoCell] Video otomatik oynatılamadı, sessize alınıp deneniyor:', err);
      // Autoplay policy fallback: if browser blocks unmuted playback, mute and retry
      try {
        videoEl.muted = true;
        await videoEl.play();
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      } catch (e) {
        console.warn('[VideoCell] Oynatma tamamen başarısız veya kullanıcı etkileşimi bekleniyor:', e);
      }
    }
  }, [onVideoPlaying]);

  // Stream Bağlama ve Oynatma Garantisi
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = stream;
      handlePlay();

      // Track seviyesinde unmute ve live durumunu dinleme
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const handleUnmute = () => {
          console.log('[VideoCell] Video izi aktifleşti (unmute):', videoTrack.id);
          videoEl.srcObject = stream;
          handlePlay();
        };

        videoTrack.addEventListener('unmute', handleUnmute);
        return () => {
          videoTrack.removeEventListener('unmute', handleUnmute);
        };
      }
    } else {
      videoEl.srcObject = null;
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    }
  }, [stream, handlePlay, onVideoPlaying]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-neutral-950 overflow-hidden select-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Kendi görüntünde sessiz, karşı tarafta ses gelebilmesi için false
        onLoadedMetadata={() => {
          handlePlay();
        }}
        onCanPlay={() => {
          handlePlay();
        }}
        onPlay={() => {
          setIsPlaying(true);
          if (onVideoPlaying) onVideoPlaying(true);
        }}
        className={`w-full h-full transition-opacity duration-300 ${
          isScreenSharing ? 'object-contain bg-neutral-950' : 'object-cover bg-neutral-950'
        } ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${className}`}
      />

      {/* Kullanıcı / Ekran Paylaşımı Rozeti */}
      {username && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-bold text-white z-10 pointer-events-none shadow-sm border border-white/10">
          {isScreenSharing && <span>🖥️ Ekran Paylaşımı</span>}
          <span>{username}</span>
        </div>
      )}
    </div>
  );
};

export default VideoCell;

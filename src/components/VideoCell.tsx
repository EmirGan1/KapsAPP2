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
 * Tablet (iPad, Android Tablet), Mobil ve Masaüstü için Siyah Ekran Önleyici Video Render Bileşeni:
 * 1. autoPlay, playsInline, webkit-playsinline ve her zaman muted={true} ile tarayıcı autoplay kısıtlamalarını %100 aşar.
 * 2. useEffect içinde stream değiştiğinde doğrudan videoEl.srcObject = stream ataması ve play() promise yönetimi.
 * 3. Video track'in 'unmute' ve 'loadedmetadata' event'lerinde anında render başlatma.
 * 4. Tıklanarak zorla oynatma (User tap-to-play) desteği.
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

  const attemptPlay = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // WebRTC video elementleri her zaman muted olmalıdır; ses useWebRTC Audio elementinden gelir.
    videoEl.muted = true;
    videoEl.defaultMuted = true;

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          onVideoPlaying?.(true);
        })
        .catch((err) => {
          console.debug('[VideoCell] Play error (will retry on user interaction):', err);
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        });
    }
  }, [onVideoPlaying]);

  // Stream Değişimi ve Oynatma Garantisi
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      attemptPlay();

      // Video track'lerin canlı ve unmuted durumunu dinle
      const videoTracks = stream.getVideoTracks();
      const handleTrackLive = () => {
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        attemptPlay();
      };

      videoTracks.forEach((track) => {
        track.addEventListener('unmute', handleTrackLive);
      });

      return () => {
        videoTracks.forEach((track) => {
          track.removeEventListener('unmute', handleTrackLive);
        });
      };
    } else {
      videoEl.srcObject = null;
      setIsPlaying(false);
      onVideoPlaying?.(false);
    }
  }, [stream, attemptPlay, onVideoPlaying]);

  return (
    <div 
      onClick={attemptPlay}
      className="relative w-full h-full flex items-center justify-center bg-neutral-950 overflow-hidden select-none cursor-pointer"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        // @ts-ignore
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="auto"
        onLoadedMetadata={attemptPlay}
        onLoadedData={attemptPlay}
        onCanPlay={attemptPlay}
        onPlay={() => {
          setIsPlaying(true);
          onVideoPlaying?.(true);
        }}
        className={`w-full h-full transition-opacity duration-300 ${
          isScreenSharing ? 'object-contain bg-neutral-950' : 'object-cover bg-neutral-950'
        } ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${className}`}
      />

      {/* Kullanıcı / Ekran Paylaşımı Rozeti */}
      {username && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-bold text-white z-10 pointer-events-none shadow-sm border border-white/10">
          {isScreenSharing && <span>🖥️ Ekran / Canlı Yayın</span>}
          <span>{username}</span>
        </div>
      )}
    </div>
  );
};

export default VideoCell;

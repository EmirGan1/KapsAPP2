import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface VideoCellProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  className?: string;
  onVideoPlaying?: (isPlaying: boolean) => void;
}

/**
 * VideoCell Component
 * Kapsamlı Siyah Ekran ve Video Oynatma Sorunlarını Engelleyen Video Render Bileşeni:
 * 1. autoPlay, playsInline ve muted={isLocal} (Yerel görüntüde true, karşı tarafta false)
 * 2. useEffect içinde doğrudan videoEl.srcObject = stream ataması ve play() promise hata yakalaması
 * 3. Ekran paylaşımında dinamik 'object-contain bg-neutral-950', normal kamerada 'object-cover'
 * 4. WebRTC track 'unmute' ve 'mute' olaylarına anlık tepki
 */
export const VideoCell: React.FC<VideoCellProps> = ({
  stream,
  isLocal = false,
  isScreenSharing = false,
  className = '',
  onVideoPlaying
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const videoTrack = stream ? stream.getVideoTracks()[0] : null;

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          if (onVideoPlaying) onVideoPlaying(true);
        })
        .catch((err) => {
          console.warn('[VideoCell] Otomatik oynatma kısıtlandı, kullanıcı etkileşimi bekleniyor:', err);
          // Autoplay policy fallback: mute and retry if remote playback was blocked
          if (!isLocal) {
            video.muted = true;
            video.play()
              .then(() => {
                setIsPlaying(true);
                if (onVideoPlaying) onVideoPlaying(true);
              })
              .catch((e) => console.warn('[VideoCell] Sessiz oynatma denemesi başarısız:', e));
          }
        });
    }
  }, [isLocal, onVideoPlaying]);

  // Stream Bağlama Garantisi: useEffect içinde doğrudan stream ataması ve play() promise çalıştırma
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && videoTrack && videoTrack.readyState === 'live') {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      playVideo();
    } else {
      videoEl.srcObject = null;
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    }
  }, [stream, videoTrack, playVideo, onVideoPlaying]);

  // Track 'unmute' (ilk veri paketi geldiğinde) ve 'mute' olaylarını dinleme
  useEffect(() => {
    if (!videoTrack) return;

    const handleUnmute = () => {
      console.log('[VideoCell] Video izi aktifleşti (unmute):', videoTrack.id);
      const videoEl = videoRef.current;
      if (videoEl && stream) {
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        playVideo();
      }
    };

    const handleMute = () => {
      console.log('[VideoCell] Video izi askıya alındı (mute):', videoTrack.id);
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    };

    videoTrack.addEventListener('unmute', handleUnmute);
    videoTrack.addEventListener('mute', handleMute);

    return () => {
      videoTrack.removeEventListener('unmute', handleUnmute);
      videoTrack.removeEventListener('mute', handleMute);
    };
  }, [videoTrack, stream, playVideo, onVideoPlaying]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // Kendi görüntünde kesinlikle true, karşı tarafta false
      onLoadedMetadata={() => playVideo()}
      onPlay={() => {
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      }}
      className={`w-full h-full rounded-xl transition-all duration-300 ${
        isScreenSharing ? 'object-contain bg-neutral-950' : 'object-cover bg-neutral-950'
      } ${isPlaying ? 'opacity-100' : 'opacity-0'} ${
        isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''
      } ${className}`}
    />
  );
};

export default VideoCell;

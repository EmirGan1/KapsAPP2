/**
 * WebRTC Configuration & Adaptive Optimization Utility
 * Tuned for smooth multi-party rooms, ideal device compatibility, and zero-black-screen reliability.
 */

export const MAX_ROOM_USERS = 20;

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

/**
 * Audio Media Constraints with Echo Cancellation, Noise Suppression, and AGC
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1
};

/**
 * Flexible Camera & Audio Constraints with Ideal Dimensions (prevents camera initialization crashes)
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

/**
 * Adaptive Video Constraints based on active participant count
 */
export function getVideoConstraints(participantCount: number = 1): MediaTrackConstraints {
  if (participantCount > 10) {
    // High-density room (11-20 users): 360p @ 20 FPS ideal
    return {
      width: { ideal: 480 },
      height: { ideal: 270 },
      frameRate: { ideal: 20, max: 20 },
      facingMode: 'user'
    };
  } else if (participantCount > 4) {
    // Medium room (5-10 users): 480p/360p @ 24 FPS ideal
    return {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 24 },
      facingMode: 'user'
    };
  }

  // Small room (1-4 users): 720p / 480p ideal
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user'
  };
}

/**
 * Helper to check if current client is a mobile or tablet browser
 */
export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIpadOS = typeof navigator.platform === 'string' &&
    navigator.platform === 'MacIntel' &&
    (navigator.maxTouchPoints || 0) > 1;
  return isMobileUa || isIpadOS;
}

/**
 * Universal detector for Screen Sharing capability across all platforms (Mobile, Tablet, Desktop).
 */
export function checkCanScreenShare(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return Boolean(
    navigator.mediaDevices && 
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/**
 * Universal Native Screen Capture Engine (Zero-Constraint Progressive Fallback)
 * Directly triggers native display media without complex constraints, popups or blocking alerts.
 */
export async function requestScreenStream(withAudio: boolean = false): Promise<MediaStream | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  let stream: MediaStream | null = null;

  // Strateji 1: Saf/Yalın video: true (Android Chromium, Mobile & Tablet için en kararlısı)
  try {
    if (navigator.mediaDevices?.getDisplayMedia) {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: Boolean(withAudio)
      });
    }
  } catch (err1: any) {
    if (err1?.name === 'NotAllowedError' || err1?.name === 'AbortError' || err1?.name === 'PermissionDeniedError') {
      console.warn('[ScreenShare] Kullanıcı izin vermedi veya iptal etti.');
      return null;
    }
    console.warn('[ScreenShare] 1. Düzey ekran yakalama başarısız, 2. deneme:', err1);
  }

  // Strateji 2: Kesinlikle ses olmadan yalın video
  if (!stream) {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
      }
    } catch (err2: any) {
      if (err2?.name === 'NotAllowedError' || err2?.name === 'AbortError' || err2?.name === 'PermissionDeniedError') {
        return null;
      }
      console.warn('[ScreenShare] 2. Düzey ekran yakalama başarısız, 3. deneme:', err2);
    }
  }

  // Strateji 3: Sadece { video: true }
  if (!stream) {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      }
    } catch (err3: any) {
      if (err3?.name === 'NotAllowedError' || err3?.name === 'AbortError' || err3?.name === 'PermissionDeniedError') {
        return null;
      }
      console.warn('[ScreenShare] 3. Düzey sade video parametresi başarısız, 4. deneme:', err3);
    }
  }

  // Strateji 4: Boş nesne ile çağırma (Bazı mobil WebView ve Chromium sürümleri boş nesne bekler)
  if (!stream) {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({} as any);
      }
    } catch (err4: any) {
      if (err4?.name === 'NotAllowedError' || err4?.name === 'AbortError' || err4?.name === 'PermissionDeniedError') {
        return null;
      }
      console.warn('[ScreenShare] 4. Düzey boş nesne parametresi başarısız, 5. deneme:', err4);
    }
  }

  // Strateji 5: Eski tarayıcı / vendor prefix uyumluluğu
  if (!stream && typeof (navigator as any).getDisplayMedia === 'function') {
    try {
      stream = await (navigator as any).getDisplayMedia({ video: true });
    } catch (err5: any) {
      if (err5?.name === 'NotAllowedError' || err5?.name === 'AbortError' || err5?.name === 'PermissionDeniedError') {
        return null;
      }
      console.warn('[ScreenShare] 5. Düzey legacy getDisplayMedia başarısız:', err5);
    }
  }

  return stream;
}

/**
 * Helper to check if current client is a mobile device (alias for backward compatibility)
 */
export function isMobileBrowser(): boolean {
  return isMobileOrTablet();
}

/**
 * Apply bandwidth / bitrate clamping on RTCRtpSender.
 */
export async function applySenderBitrateLimit(
  sender: RTCRtpSender,
  participantCount: number = 1
): Promise<void> {
  if (!sender || sender.track?.kind !== 'video') return;

  let targetBitrateBps = 450_000; // 450 kbps default
  let maxFps = 24;

  if (participantCount > 12) {
    targetBitrateBps = 280_000;
    maxFps = 20;
  } else if (participantCount > 6) {
    targetBitrateBps = 350_000;
    maxFps = 24;
  }

  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = targetBitrateBps;
    params.encodings[0].maxFramerate = maxFps;
    params.encodings[0].priority = 'low';
    params.encodings[0].networkPriority = 'low';

    await sender.setParameters(params);
  } catch (err) {
    console.debug('Sender bitrate clamp notice:', err);
  }
}

/**
 * Fine-tunes SDP to enforce Opus codec at 32-48 kbps, mono, with DTX enabled.
 */
export function tuneSdpForAudioOpus(sdp: string): string {
  if (!sdp) return sdp;

  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!opusMatch) return sdp;

  const payloadType = opusMatch[1];
  const fmtpRegex = new RegExp(`a=fmtp:${payloadType} (.*)`, 'i');
  const fmtpMatch = sdp.match(fmtpRegex);

  const opusParams = 'minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;usedtx=1;maxaveragebitrate=36000';

  if (fmtpMatch) {
    return sdp.replace(fmtpRegex, `a=fmtp:${payloadType} ${opusParams};${fmtpMatch[1]}`);
  } else {
    return sdp.replace(
      opusMatch[0],
      `${opusMatch[0]}\r\na=fmtp:${payloadType} ${opusParams}`
    );
  }
}

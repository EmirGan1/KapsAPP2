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
 * On mobile/tablet or when audio is not requested, always starts with pure { video: true } with ZERO extra keys.
 * If native OS screen capture is restricted by Android Chrome kernel (NotSupportedError), seamlessly falls back
 * to HD Live Camera / Document Broadcast stream so a broadcast definitely starts without getting stuck.
 */
export async function requestScreenStream(withAudio: boolean = false): Promise<MediaStream | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  const isMobile = isMobileOrTablet();
  let stream: MediaStream | null = null;
  let nativeDisplayMediaSupported = true;

  // Strateji 1: 
  // Mobilde/Tablette veya sessiz paylaşımda İLK ve EN KARARLI parametre: { video: true } (audio anahtarı ASLA eklenmez!)
  // Masaüstünde ve withAudio=true ise: { video: true, audio: true }
  try {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      if (isMobile || !withAudio) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }
    } else {
      nativeDisplayMediaSupported = false;
    }
  } catch (err1: any) {
    console.warn('[ScreenShare] 1. Düzey ekran yakalama sonucu:', err1?.name, err1?.message);

    // Kullanıcı sistem onay penceresinde "İptal" veya "Vazgeç" dedi
    if (err1?.name === 'NotAllowedError') {
      // Eğer kullanıcı izin penceresini kendisi kapattıysa null dön
      if (!err1?.message?.toLowerCase().includes('not supported') && 
          !err1?.message?.toLowerCase().includes('user gesture') && 
          !err1?.message?.toLowerCase().includes('transient')) {
        console.warn('[ScreenShare] Kullanıcı ekran yakalama iznini iptal etti.');
        return null;
      }
    }
    
    if (err1?.name === 'AbortError' || err1?.name === 'PermissionDeniedError') {
      return null;
    }

    // Android Chromium "Not supported" / NotSupportedError
    if (err1?.name === 'NotSupportedError' || err1?.message?.toLowerCase().includes('not supported')) {
      nativeDisplayMediaSupported = false;
    }
  }

  // Strateji 2: Masaüstünde sesli istek reddedildiyse veya mobilde saf video denenmediyse: { video: true }
  if (!stream && nativeDisplayMediaSupported) {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      }
    } catch (err2: any) {
      if (err2?.name === 'NotSupportedError' || err2?.message?.toLowerCase().includes('not supported')) {
        nativeDisplayMediaSupported = false;
      }
    }
  }

  // Strateji 3: Boş nesne ile çağırma (Bazı Android WebView sürümleri boş nesne bekler)
  if (!stream && nativeDisplayMediaSupported) {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({} as any);
      }
    } catch (err3: any) {
      if (err3?.name === 'NotSupportedError' || err3?.message?.toLowerCase().includes('not supported')) {
        nativeDisplayMediaSupported = false;
      }
    }
  }

  // Strateji 4: Eski tarayıcı / vendor prefix uyumluluğu
  if (!stream && nativeDisplayMediaSupported && typeof (navigator as any).getDisplayMedia === 'function') {
    try {
      stream = await (navigator as any).getDisplayMedia({ video: true });
    } catch (err4: any) {
      console.warn('[ScreenShare] Legacy getDisplayMedia denenemedi:', err4);
    }
  }

  // STRATEJİ 5: ANDROİD TABLET VE MOBİL İÇİN KESİN CANLI YAYIN MOTORU (HD CAMERA / DOCUMENT BROADCAST FALLBACK)
  // Standart Android Chrome web üzerinden harici MediaProjection API'sini engellediğinde (NotSupportedError),
  // kullanıcının "tuşa basınca hiçbir şey olmuyor" şeklinde donmasını ve kilitlenmesini kesin olarak çözer.
  // Cihazın yüksek çözünürlüklü kamerasını (arka/çevre veya ön) odanın Spotlight Ekran Yayını olarak başlatır.
  if (!stream && isMobile) {
    console.log('[ScreenShare] Android/Mobil tarayıcıda doğrudan ekran yakalama engellendi. Canlı Yayın Akışı (Spotlight Broadcast) başlatılıyor...');
    try {
      // 1. Öncelik: Arka/Çevre kamerası (Tablet masaya, belgeye veya ekrana tutularak yayın yapılabilmesi için)
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
      console.log('[ScreenShare] Canlı Belge/Çevre kamera yayını başarıyla başlatıldı.');
    } catch (camErr1) {
      console.debug('[ScreenShare] Arka kamera denenemedi, genel kamera deneniyor:', camErr1);
      try {
        // 2. Öncelik: Genel mevcut kamera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        console.log('[ScreenShare] Canlı kamera yayını başarıyla başlatıldı.');
      } catch (camErr2) {
        console.error('[ScreenShare] Canlı yayın kamerası başlatılamadı:', camErr2);
      }
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

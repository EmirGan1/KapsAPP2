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
 * Universal Progressive Fallback Screen Capture Engine
 * Seamlessly manages WebRTC screen acquisition on Desktop, Tablet (iPadOS/Android Tablet), and Mobile.
 */
export async function requestScreenStream(withAudio: boolean = false): Promise<MediaStream> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('DEVICE_NOT_SUPPORTED');
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
    throw new Error('DEVICE_NOT_SUPPORTED');
  }

  const isMobile = isMobileOrTablet();

  // Tiered constraints: start with optimal and cascade down to bare essential video
  const constraintTiers: any[] = isMobile
    ? [
        // Mobile/Tablet Tier 1: Clean video-only boolean
        { video: true, audio: false },
        // Mobile/Tablet Tier 2: Basic video constraints
        { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false },
        // Mobile/Tablet Tier 3: Minimal boolean
        { video: true }
      ]
    : [
        // Desktop Tier 1: Full options with user audio preference
        {
          video: {
            cursor: 'always',
            frameRate: { ideal: 30, max: 30 }
          },
          audio: withAudio
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                suppressLocalAudioPlayback: false
              }
            : false
        },
        // Desktop Tier 2: Video with audio false
        {
          video: {
            cursor: 'always',
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        },
        // Desktop Tier 3: Universal simple video fallback
        { video: true, audio: false },
        // Desktop Tier 4: Minimal
        { video: true }
      ];

  let stream: MediaStream | null = null;
  let lastError: any = null;

  for (const constraints of constraintTiers) {
    try {
      console.log('[WebRTC Engine] Requesting displayMedia with constraints:', constraints);
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      if (stream && stream.getVideoTracks().length > 0) {
        break;
      }
    } catch (err: any) {
      console.warn('[WebRTC Engine] Tier attempt failed:', err?.name, err?.message);
      lastError = err;

      // User consciously cancelled the system picker dialog - do not try fallbacks
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError' || err?.name === 'PermissionDeniedError') {
        throw new Error('USER_CANCELLED');
      }
    }
  }

  if (!stream) {
    if (lastError?.name === 'NotSupportedError' || lastError?.message?.toLowerCase()?.includes('not supported')) {
      throw new Error('NOT_SUPPORTED');
    }
    throw lastError || new Error('SCREEN_CAPTURE_FAILED');
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

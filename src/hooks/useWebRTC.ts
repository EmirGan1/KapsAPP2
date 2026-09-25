import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ICE_SERVERS, 
  AUDIO_CONSTRAINTS, 
  CAMERA_CONSTRAINTS,
  getVideoConstraints, 
  applySenderBitrateLimit, 
  tuneSdpForAudioOpus,
  checkCanScreenShare,
  isMobileBrowser
} from '../utils/webrtcConfig';

interface UseWebRTCOptions {
  socket: Socket | null;
  currentUserId: number;
  roomId?: string;
  participantCount?: number;
}

export function useWebRTC({
  socket,
  currentUserId,
  roomId,
  participantCount = 1
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenAudioEnabled, setIsScreenAudioEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [mediaPermissionError, setMediaPermissionError] = useState<string | null>(null);

  const isScreenShareSupported = checkCanScreenShare();

  // References
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const mixedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State refs to access latest values in async callbacks
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const isScreenSharingRef = useRef(isScreenSharing);
  const isDeafenedRef = useRef(isDeafened);
  const roomIdRef = useRef(roomId);
  const participantCountRef = useRef(participantCount);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);
  useEffect(() => { isDeafenedRef.current = isDeafened; }, [isDeafened]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { participantCountRef.current = participantCount; }, [participantCount]);

  // Clean WebRTC streams, peer connections, and audio hardware
  const cleanupWebRTC = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop screen sharing tracks if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[WebRTC] Error stopping screen track:', e);
        }
      });
      screenStreamRef.current = null;
    }

    if (mixedAudioTrackRef.current) {
      try {
        mixedAudioTrackRef.current.stop();
      } catch (e) {}
      mixedAudioTrackRef.current = null;
    }

    if (originalCameraTrackRef.current) {
      try {
        originalCameraTrackRef.current.stop();
      } catch (e) {}
      originalCameraTrackRef.current = null;
    }

    originalMicTrackRef.current = null;

    // Stop all local tracks explicitly to turn off camera LED and mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[WebRTC] Error stopping track:', e);
        }
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setIsScreenSharing(false);
    setIsScreenAudioEnabled(false);

    // Close all P2P peer connections and clear listeners
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing RTCPeerConnection:', e);
      }
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    // Clean remote audio elements
    remoteAudioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioElementsRef.current.clear();

    setRemoteStreams(new Map());
    setIsSpeakingLocal(false);
    setMediaPermissionError(null);
  }, []);

  // Process queued ICE candidates after remote description is set
  const processQueuedCandidates = async (remoteSocketId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(remoteSocketId);
    if (queue && queue.length > 0) {
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.debug('[WebRTC] Failed to apply queued ICE candidate:', e);
          }
        }
      }
    }
    pendingCandidatesRef.current.delete(remoteSocketId);
  };

  // Setup Local Media (Audio + Video) with flexible constraints to prevent camera crashes
  const setupLocalMedia = useCallback(async (preferVideo: boolean = true) => {
    try {
      cleanupWebRTC();

      let stream: MediaStream;
      const vConstraints = getVideoConstraints(participantCountRef.current);

      if (preferVideo) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: vConstraints
          });
          setIsVideoOff(false);
        } catch (videoErr) {
          console.warn('[WebRTC] Camera access failed, falling back to audio only:', videoErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: AUDIO_CONSTRAINTS,
              video: false
            });
            setIsVideoOff(true);
          } catch (audioErr) {
            console.warn('[WebRTC] Audio access failed:', audioErr);
            throw audioErr;
          }
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: false
        });
        setIsVideoOff(true);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      const micTrack = stream.getAudioTracks()[0];
      if (micTrack) {
        originalMicTrackRef.current = micTrack;
        micTrack.enabled = !isMutedRef.current;
      }

      const camTrack = stream.getVideoTracks()[0];
      if (camTrack) {
        originalCameraTrackRef.current = camTrack;
      }

      // Web Audio API Speaking Detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeaking = false;

        speakingIntervalRef.current = setInterval(() => {
          if (isMutedRef.current || !analyserRef.current) {
            if (wasSpeaking) {
              wasSpeaking = false;
              setIsSpeakingLocal(false);
              if (socket && roomIdRef.current) {
                socket.emit('voice_update_status', {
                  roomId: roomIdRef.current,
                  isSpeaking: false
                });
              }
            }
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const isNowSpeaking = average > 18;

          if (isNowSpeaking !== wasSpeaking) {
            wasSpeaking = isNowSpeaking;
            setIsSpeakingLocal(isNowSpeaking);
            if (socket && roomIdRef.current) {
              socket.emit('voice_update_status', {
                roomId: roomIdRef.current,
                isSpeaking: isNowSpeaking
              });
            }
          }
        }, 120);
      }

      return stream;
    } catch (err: any) {
      console.warn('[WebRTC] Media access error:', err);
      setMediaPermissionError('Kamera veya mikrofon erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.');
      return null;
    }
  }, [cleanupWebRTC, socket]);

  // Create Peer Connection with pre-allocated Video & Audio Transceivers
  const createPeerConnection = useCallback((remoteSocketId: string, currentLocalStream: MediaStream | null) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remoteSocketId, pc);

    // 1. Transceivers & Track Configuration
    const audioTrack = mixedAudioTrackRef.current || currentLocalStream?.getAudioTracks()[0] || null;
    const videoTrack = currentLocalStream?.getVideoTracks()[0] || null;

    if (audioTrack) {
      pc.addTrack(audioTrack, currentLocalStream!);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    if (videoTrack) {
      const sender = pc.addTrack(videoTrack, currentLocalStream!);
      applySenderBitrateLimit(sender, participantCountRef.current);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    // 2. ICE Candidate Event
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_ice_candidate', {
          targetSocketId: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    // 3. Remote Track Handling (ontrack with single track fallback and onunmute trigger)
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] ontrack received: peer=${remoteSocketId}, kind=${track.kind}, id=${track.id}`);

      // Track unmute event: when first data packet arrives from remote peer
      track.onunmute = () => {
        console.log(`[WebRTC] Remote track onunmute (active data): peer=${remoteSocketId}, kind=${track.kind}`);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const current = next.get(remoteSocketId);
          if (current) {
            next.set(remoteSocketId, new MediaStream(current.getTracks()));
          }
          return next;
        });
      };

      track.onmute = () => {
        console.log(`[WebRTC] Remote track onmute: peer=${remoteSocketId}, kind=${track.kind}`);
      };

      // Add to remoteStreams Map with fallback MediaStream([event.track])
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const existing = next.get(remoteSocketId);
        if (existing) {
          const oldSameKind = existing.getTracks().find((t) => t.kind === track.kind);
          if (oldSameKind && oldSameKind.id !== track.id) {
            existing.removeTrack(oldSameKind);
            existing.addTrack(track);
          } else if (!oldSameKind) {
            existing.addTrack(track);
          }
          next.set(remoteSocketId, new MediaStream(existing.getTracks()));
        } else {
          const newStream = (event.streams && event.streams[0]) 
            ? event.streams[0] 
            : new MediaStream([event.track]);
          next.set(remoteSocketId, newStream);
        }
        return next;
      });

      // Background HTMLAudioElement for uninterrupted audio playback
      if (track.kind === 'audio') {
        let audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          remoteAudioElementsRef.current.set(remoteSocketId, audioEl);
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = new MediaStream([track]);
        audioEl.muted = isDeafenedRef.current;
        audioEl.play().catch((e) => console.debug('[WebRTC] Remote audio autoplay:', e));
      }
    };

    // 4. Connection State Management
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteSocketId}:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
        if (audioEl) {
          audioEl.pause();
          audioEl.remove();
          remoteAudioElementsRef.current.delete(remoteSocketId);
        }
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteSocketId);
          return next;
        });
      }
    };

    return pc;
  }, [socket]);

  // Toggle Mute (Microphone)
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    if (originalMicTrackRef.current) {
      originalMicTrackRef.current.enabled = !nextMuted;
    }

    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isMuted: nextMuted
      });
    }
  }, [isMuted, socket]);

  // Toggle Video (Camera) with Full Renegotiation & Track Replacement
  const toggleVideo = useCallback(async () => {
    if (!isVideoOff) {
      // 1. Turn Camera OFF: Stop tracks so hardware indicator LED turns off
      const videoTracks = localStreamRef.current?.getVideoTracks() || [];
      videoTracks.forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });

      originalCameraTrackRef.current = null;

      // Replace sender track with null across all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });

      setIsVideoOff(true);
      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      if (socket && roomIdRef.current) {
        socket.emit('voice_update_status', {
          roomId: roomIdRef.current,
          isVideoOff: true
        });
      }
    } else {
      // 2. Turn Camera ON: Get new video stream, replaceTrack, and Renegotiate with all peers
      try {
        const vConstraints = getVideoConstraints(participantCountRef.current);
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: vConstraints
        });
        const newVideoTrack = camStream.getVideoTracks()[0];

        if (newVideoTrack) {
          originalCameraTrackRef.current = newVideoTrack;

          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          // Update each peer connection
          for (const [sId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video') || senders.find((s) => !s.track);

            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack).catch(() => {});
              applySenderBitrateLimit(videoSender, participantCountRef.current);
            } else {
              const sender = pc.addTrack(newVideoTrack, localStreamRef.current);
              applySenderBitrateLimit(sender, participantCountRef.current);
            }

            try {
              const rawOffer = await pc.createOffer();
              const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
              const offer = { type: rawOffer.type, sdp: tunedSdp };
              await pc.setLocalDescription(offer);
              socket?.emit('voice_offer', { targetSocketId: sId, offer });
            } catch (renegErr) {
              console.warn('[WebRTC] Renegotiation offer notice:', renegErr);
            }
          }

          setIsVideoOff(false);
          if (socket && roomIdRef.current) {
            socket.emit('voice_update_status', {
              roomId: roomIdRef.current,
              isVideoOff: false
            });
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Camera enable failed:', err);
        alert('Kamera açılamadı. Lütfen kamera izinlerini kontrol edin.');
      }
    }
  }, [isVideoOff, socket]);

  // Toggle Deafen (Kulaklık)
  const toggleDeafen = useCallback(() => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.muted = nextDeafen;
    });

    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isDeafened: nextDeafen
      });
    }
  }, [isDeafened, socket]);

  // Stop Screen Share (Revert to camera or off, and restore clean microphone audio)
  const stopScreenShare = useCallback(async () => {
    // 1. Stop all screen media tracks (both video & system audio)
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[WebRTC] Error stopping screen track:', e);
        }
      });
      screenStreamRef.current = null;
    }

    if (mixedAudioTrackRef.current) {
      try {
        mixedAudioTrackRef.current.stop();
      } catch (e) {}
      mixedAudioTrackRef.current = null;
    }

    setIsScreenSharing(false);
    setIsScreenAudioEnabled(false);

    // 2. Restore microphone audio track across all active peer connections
    const restoreMicTrack = originalMicTrackRef.current || localStreamRef.current?.getAudioTracks()[0] || null;
    if (restoreMicTrack) {
      restoreMicTrack.enabled = !isMutedRef.current;
      for (const [, pc] of peerConnectionsRef.current.entries()) {
        const senders = pc.getSenders();
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(restoreMicTrack).catch((err) => {
            console.warn('[WebRTC] Restore audio track warning:', err);
          });
        }
      }
    }

    // 3. Determine replacement video track: restore camera track if camera was previously on
    let replacementTrack: MediaStreamTrack | null = null;
    const shouldRestoreCamera = !isVideoOffRef.current;

    if (shouldRestoreCamera) {
      try {
        if (originalCameraTrackRef.current && originalCameraTrackRef.current.readyState === 'live') {
          replacementTrack = originalCameraTrackRef.current;
        } else {
          const vConstraints = getVideoConstraints(participantCountRef.current);
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: vConstraints
          });
          replacementTrack = camStream.getVideoTracks()[0] || null;
          originalCameraTrackRef.current = replacementTrack;
        }
      } catch (camErr) {
        console.warn('[WebRTC] Restoring camera after screen share failed:', camErr);
        replacementTrack = null;
        setIsVideoOff(true);
      }
    } else {
      replacementTrack = null;
    }

    // 4. Replace video track on all active RTCPeerConnections and renegotiate with peers
    for (const [sId, pc] of peerConnectionsRef.current.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video') || senders.find((s) => !s.track);
      if (videoSender) {
        await videoSender.replaceTrack(replacementTrack).catch((err) => {
          console.warn('[WebRTC] Revert replaceTrack error:', err);
        });
        if (replacementTrack) {
          applySenderBitrateLimit(videoSender, participantCountRef.current);
        }
      }

      // Taze SDP Offer göndererek karşı tarafın video streamini sorunsuz güncelle
      try {
        const rawOffer = await pc.createOffer();
        const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
        const offer = { type: rawOffer.type, sdp: tunedSdp };
        await pc.setLocalDescription(offer);
        socket?.emit('voice_offer', { targetSocketId: sId, offer });
      } catch (renegErr) {
        console.debug('[WebRTC] Stop screen share renegotiation offer notice:', renegErr);
      }
    }

    // 5. Update local stream
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => localStreamRef.current?.removeTrack(t));
      if (replacementTrack) {
        localStreamRef.current.addTrack(replacementTrack);
      }
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    // 6. Notify socket room
    if (socket && roomIdRef.current) {
      socket.emit('screen_share_status', {
        roomId: roomIdRef.current,
        isSharing: false
      });
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isVideoOff: !replacementTrack,
        isScreenSharing: false
      });
    }
  }, [socket]);

  // Start Screen Share with optional system audio & Web Audio API mixing (Desktop Windows, macOS, Linux, ChromeOS)
  const startScreenShare = useCallback(async (withAudio: boolean = false) => {
    // 1. Tarayıcı Desteği ve Güvenli Bağlam Kontrolü
    if (!checkCanScreenShare() || typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      console.warn('[WebRTC] Ekran yakalama bu cihazda/tarayıcıda desteklenmiyor.');
      return false;
    }

    try {
      // 2. Ekran Paylaşımı İsteği (getDisplayMedia)
      const desktopConstraints: any = {
        video: {
          cursor: 'always',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: withAudio ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false
        } : false
      };

      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia(desktopConstraints);
      } catch (firstAttemptError: any) {
        if (
          firstAttemptError.name === 'NotSupportedError' ||
          firstAttemptError.name === 'TypeError' ||
          firstAttemptError.name === 'OverconstrainedError' ||
          firstAttemptError.name === 'ConstraintNotSatisfiedError'
        ) {
          console.warn('[WebRTC] getDisplayMedia ilk deneme hatası, yalın video: true ile tekrar deneniyor:', firstAttemptError);
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
          throw firstAttemptError;
        }
      }

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) {
        console.warn('[WebRTC] Paylaşılacak video akışı bulunamadı.');
        return false;
      }

      // Track'in kesinlikle aktif ve enabled olduğundan emin ol
      screenVideoTrack.enabled = true;

      // Save previous camera track if it was active
      const existingCamTrack = localStreamRef.current?.getVideoTracks()[0];
      if (existingCamTrack && existingCamTrack !== screenVideoTrack) {
        originalCameraTrackRef.current = existingCamTrack;
      }

      screenStreamRef.current = screenStream;

      // 3. Audio Handling & Mixing (Web Audio API for simultaneous Mic + System Audio)
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (withAudio && screenAudioTrack) {
        setIsScreenAudioEnabled(true);
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = audioContextRef.current || new AudioCtx();
            audioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }

            const destination = audioCtx.createMediaStreamDestination();

            // Connect local mic stream if present
            const micTrack = localStreamRef.current?.getAudioTracks()[0];
            if (micTrack && micTrack.readyState === 'live') {
              originalMicTrackRef.current = micTrack;
              const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
              micSource.connect(destination);
            }

            // Connect system audio stream
            const screenSource = audioCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
            screenSource.connect(destination);

            const mixedTrack = destination.stream.getAudioTracks()[0];
            mixedAudioTrackRef.current = mixedTrack;

            // Replace audio track across all active peer connections
            for (const [, pc] of peerConnectionsRef.current.entries()) {
              const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
              if (audioSender) {
                await audioSender.replaceTrack(mixedTrack).catch((err) => {
                  console.warn('[WebRTC] Mixed audio track replacement error:', err);
                });
              }
            }
          }
        } catch (audioMixErr) {
          console.warn('[WebRTC] System audio mixing warning, falling back to screen audio:', audioMixErr);
        }
      } else {
        setIsScreenAudioEnabled(false);
      }

      // 4. Video Track Replacement on all active RTCPeerConnections & Renegotiation
      for (const [sId, pc] of peerConnectionsRef.current.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video') || senders.find((s) => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(screenVideoTrack).catch((err) => {
            console.warn('[WebRTC] Screen share replaceTrack warning:', err);
          });
          applySenderBitrateLimit(videoSender, participantCountRef.current);
        } else {
          const sender = pc.addTrack(screenVideoTrack, screenStream);
          applySenderBitrateLimit(sender, participantCountRef.current);
        }

        // Taze SDP Offer göndererek karşı tarafta siyah ekran kalmasını önle
        try {
          const rawOffer = await pc.createOffer();
          const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
          const offer = { type: rawOffer.type, sdp: tunedSdp };
          await pc.setLocalDescription(offer);
          socket?.emit('voice_offer', { targetSocketId: sId, offer });
        } catch (renegErr) {
          console.debug('[WebRTC] Screen share renegotiation offer notice:', renegErr);
        }
      }

      // 5. Update local stream to display screen share locally in UI
      if (localStreamRef.current) {
        const currentTracks = localStreamRef.current.getVideoTracks();
        currentTracks.forEach((t) => localStreamRef.current?.removeTrack(t));
        localStreamRef.current.addTrack(screenVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      } else {
        const newLocal = new MediaStream([screenVideoTrack]);
        localStreamRef.current = newLocal;
        setLocalStream(newLocal);
      }

      setIsScreenSharing(true);
      setIsVideoOff(false);

      // 6. Notify socket room
      if (socket && roomIdRef.current) {
        socket.emit('screen_share_status', {
          roomId: roomIdRef.current,
          isSharing: true,
          withAudio: Boolean(screenAudioTrack)
        });
        socket.emit('voice_update_status', {
          roomId: roomIdRef.current,
          isVideoOff: false,
          isScreenSharing: true
        });
      }

      // 7. Ekran paylaşımı durdurulduğunda (Tarayıcı barından veya sistem butonundan)
      screenVideoTrack.onended = () => {
        console.log('[WebRTC] Ekran paylaşımı sonlandırıldı (onended)');
        stopScreenShare();
      };

      if (screenAudioTrack) {
        screenAudioTrack.onended = () => {
          console.log('[WebRTC] Sistem sesi paylaşımı sonlandırıldı (onended)');
        };
      }

      return true;
    } catch (error: any) {
      console.warn('[WebRTC] Ekran yakalama hatası:', error);
      if (error.name === 'NotAllowedError' || error.name === 'AbortError' || error.name === 'PermissionDeniedError') {
        // Kullanıcı kendi vazgeçti veya iptal etti
        return false;
      }
      if (error.name === 'NotSupportedError' || error.message?.toLowerCase()?.includes('not supported')) {
        console.warn('[WebRTC] getDisplayMedia bu platformda donanımsal/işletim sistemi seviyesinde desteklenmiyor.');
        return false;
      }
      return false;
    }
  }, [socket, stopScreenShare]);

  // Toggle Screen Share (defaults to false or accepts boolean)
  const toggleScreenShare = useCallback(async (withAudio: boolean = false) => {
    if (isScreenSharingRef.current) {
      await stopScreenShare();
    } else {
      await startScreenShare(withAudio);
    }
  }, [startScreenShare, stopScreenShare]);

  // Host force actions
  const handleRemoteForceMute = useCallback(() => {
    setIsMuted(true);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
    }
    if (originalMicTrackRef.current) {
      originalMicTrackRef.current.enabled = false;
    }
    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isMuted: true
      });
    }
  }, [socket]);

  const handleRemoteForceCameraOff = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });
    }
    peerConnectionsRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(null).catch(() => {});
      }
    });

    setIsVideoOff(true);
    if (socket && roomIdRef.current) {
      socket.emit('voice_update_status', {
        roomId: roomIdRef.current,
        isVideoOff: true
      });
    }
  }, [socket]);

  // Connect to a peer (called when a user joins)
  const initiateOfferToPeer = useCallback(async (targetSocketId: string) => {
    if (!socket || !targetSocketId) return;
    let stream = localStreamRef.current;
    if (!stream) stream = await setupLocalMedia();

    const pc = createPeerConnection(targetSocketId, stream);
    try {
      const rawOffer = await pc.createOffer();
      const tunedSdp = tuneSdpForAudioOpus(rawOffer.sdp || '');
      const offer = { type: rawOffer.type, sdp: tunedSdp };
      await pc.setLocalDescription(offer);

      socket.emit('voice_offer', {
        targetSocketId,
        offer
      });
    } catch (err) {
      console.warn('[WebRTC] Error creating voice offer:', err);
    }
  }, [socket, setupLocalMedia, createPeerConnection]);

  // Remove peer connection and free resources
  const removePeerConnection = useCallback((remoteSocketId: string) => {
    const pc = peerConnectionsRef.current.get(remoteSocketId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteSocketId);
    }
    pendingCandidatesRef.current.delete(remoteSocketId);

    const audioEl = remoteAudioElementsRef.current.get(remoteSocketId);
    if (audioEl) {
      audioEl.pause();
      audioEl.remove();
      remoteAudioElementsRef.current.delete(remoteSocketId);
    }

    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  // WebRTC Signaling Socket Listeners (handles both initial and renegotiation offers)
  useEffect(() => {
    if (!socket) return;

    const handleVoiceOffer = async (data: { senderSocketId: string; senderUserId: number; offer: any }) => {
      console.log(`[WebRTC] Received voice_offer from ${data.senderSocketId}`);
      let stream = localStreamRef.current;
      if (!stream) stream = await setupLocalMedia();

      const pc = peerConnectionsRef.current.get(data.senderSocketId) || createPeerConnection(data.senderSocketId, stream);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await processQueuedCandidates(data.senderSocketId, pc);

        const rawAnswer = await pc.createAnswer();
        const tunedSdp = tuneSdpForAudioOpus(rawAnswer.sdp || '');
        const answer = { type: rawAnswer.type, sdp: tunedSdp };
        await pc.setLocalDescription(answer);

        socket.emit('voice_answer', {
          targetSocketId: data.senderSocketId,
          answer
        });
      } catch (err) {
        console.warn('[WebRTC] Error handling voice offer/renegotiation:', err);
      }
    };

    const handleVoiceAnswer = async (data: { senderSocketId: string; answer: any }) => {
      console.log(`[WebRTC] Received voice_answer from ${data.senderSocketId}`);
      const pc = peerConnectionsRef.current.get(data.senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueuedCandidates(data.senderSocketId, pc);
        } catch (err) {
          console.warn('[WebRTC] Error handling voice answer:', err);
        }
      }
    };

    const handleVoiceIceCandidate = async (data: { senderSocketId: string; candidate: any }) => {
      if (!data?.senderSocketId || !data?.candidate) return;
      const pc = peerConnectionsRef.current.get(data.senderSocketId);

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn('[WebRTC] Error adding ICE candidate:', err);
        }
      } else {
        const queue = pendingCandidatesRef.current.get(data.senderSocketId) || [];
        queue.push(data.candidate);
        pendingCandidatesRef.current.set(data.senderSocketId, queue);
      }
    };

    socket.on('voice_offer', handleVoiceOffer);
    socket.on('voice_answer', handleVoiceAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);

    return () => {
      socket.off('voice_offer', handleVoiceOffer);
      socket.off('voice_answer', handleVoiceAnswer);
      socket.off('voice_ice_candidate', handleVoiceIceCandidate);
    };
  }, [socket, setupLocalMedia, createPeerConnection]);

  return {
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isScreenAudioEnabled,
    isScreenShareSupported,
    isDeafened,
    isSpeakingLocal,
    mediaPermissionError,
    setupLocalMedia,
    toggleMute,
    toggleVideo,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    cleanupWebRTC,
    initiateOfferToPeer,
    removePeerConnection,
    handleRemoteForceMute,
    handleRemoteForceCameraOff
  };
}

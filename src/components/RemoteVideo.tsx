import React from 'react';
import VideoCell, { VideoCellProps } from './VideoCell';

export interface RemoteVideoProps {
  stream: MediaStream | null;
  isSelf?: boolean;
  isScreenShare?: boolean;
  muted?: boolean;
  className?: string;
  onVideoPlaying?: (isPlaying: boolean) => void;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  stream,
  isSelf = false,
  isScreenShare = false,
  muted,
  className = '',
  onVideoPlaying
}) => {
  return (
    <VideoCell
      stream={stream}
      isLocal={muted !== undefined ? muted : isSelf}
      isScreenSharing={isScreenShare}
      className={className}
      onVideoPlaying={onVideoPlaying}
    />
  );
};

export default RemoteVideo;

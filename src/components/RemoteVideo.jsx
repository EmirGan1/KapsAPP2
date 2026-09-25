import React from 'react';
import VideoCell from './VideoCell';

export const RemoteVideo = ({
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

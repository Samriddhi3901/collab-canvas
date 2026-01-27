import { useCallback, useRef, useState } from 'react';
import { TLEditorSnapshot } from 'tldraw';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseWhiteboardSyncProps {
  channel: RealtimeChannel | null;
  userId: string;
  isOwner: boolean;
}

export function useWhiteboardSync({ channel, userId, isOwner }: UseWhiteboardSyncProps) {
  const [remoteSnapshot, setRemoteSnapshot] = useState<TLEditorSnapshot | null>(null);
  const lastBroadcast = useRef<number>(0);
  const THROTTLE_MS = 100;

  // Broadcast whiteboard snapshot
  const broadcastSnapshot = useCallback((snapshot: TLEditorSnapshot) => {
    if (!channel) return;
    
    const now = Date.now();
    if (now - lastBroadcast.current < THROTTLE_MS) return;
    
    lastBroadcast.current = now;
    
    channel.send({
      type: 'broadcast',
      event: 'whiteboard_update',
      payload: {
        snapshot,
        updatedBy: userId,
        timestamp: now,
      },
    });
  }, [channel, userId]);

  // Handle incoming whiteboard updates
  const handleWhiteboardUpdate = useCallback((payload: any) => {
    if (payload.updatedBy !== userId) {
      setRemoteSnapshot(payload.snapshot);
    }
  }, [userId]);

  // Request current whiteboard state (for new users)
  const requestWhiteboardState = useCallback(() => {
    if (!channel) return;
    
    channel.send({
      type: 'broadcast',
      event: 'request_whiteboard_state',
      payload: { userId },
    });
  }, [channel, userId]);

  // Broadcast current whiteboard state to new users
  const broadcastCurrentState = useCallback((snapshot: TLEditorSnapshot) => {
    if (!channel || !isOwner) return;
    
    channel.send({
      type: 'broadcast',
      event: 'sync_whiteboard_state',
      payload: {
        snapshot,
        fromOwner: true,
      },
    });
  }, [channel, isOwner]);

  // Handle state sync from owner
  const handleWhiteboardSync = useCallback((payload: any) => {
    if (!isOwner && payload.fromOwner) {
      setRemoteSnapshot(payload.snapshot);
    }
  }, [isOwner]);

  return {
    remoteSnapshot,
    broadcastSnapshot,
    handleWhiteboardUpdate,
    requestWhiteboardState,
    broadcastCurrentState,
    handleWhiteboardSync,
    setRemoteSnapshot,
  };
}

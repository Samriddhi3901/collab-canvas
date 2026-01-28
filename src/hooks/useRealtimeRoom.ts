import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/integrations/supabase/client';
import { Language, LANGUAGE_CONFIG, Room, UserPresence, CursorPosition } from '@/types/editor';
import { RealtimeChannel } from '@supabase/supabase-js';
import { WhiteboardSnapshot } from '@/components/WhiteboardCanvas';

const STORAGE_KEY = 'collabcode_rooms';
const SYNC_INTERVAL = 50; // 50ms for low-latency sync
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

export function useRealtimeRoom(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectedUsers, setConnectedUsers] = useState<number>(1);
  const [remotePresence, setRemotePresence] = useState<UserPresence[]>([]);
  const [remoteWhiteboardSnapshot, setRemoteWhiteboardSnapshot] = useState<WhiteboardSnapshot | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string>(nanoid(8));
  const userNameRef = useRef<string>(`User-${userIdRef.current.slice(0, 4)}`);
  const userColorRef = useRef<string>(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const isOwnerRef = useRef<boolean>(false);
  const pendingCodeRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(0);
  const whiteboardSnapshotRef = useRef<WhiteboardSnapshot | null>(null);
  const lastWhiteboardSyncRef = useRef<number>(0);
  const isFirstJoin = useRef<boolean>(true);

  // Get stored room data
  const getStoredRoom = useCallback((id: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const rooms = stored ? JSON.parse(stored) : {};
      return rooms[id] || null;
    } catch {
      return null;
    }
  }, []);

  // Save room to localStorage
  const saveToStorage = useCallback((roomData: Room) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const rooms = stored ? JSON.parse(stored) : {};
      rooms[roomData.id] = {
        ...roomData,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    } catch (error) {
      console.error('Error saving room:', error);
    }
  }, []);

  // Create a new room
  const createRoom = useCallback((language: Language = 'javascript'): Room => {
    const newRoom: Room = {
      id: nanoid(8),
      code: LANGUAGE_CONFIG[language].defaultCode,
      language,
      isOwner: true,
    };
    
    isOwnerRef.current = true;
    saveToStorage(newRoom);
    setRoom(newRoom);
    setIsViewOnly(false);
    
    return newRoom;
  }, [saveToStorage]);

  // Throttled broadcast for code updates
  const broadcastCodeUpdate = useCallback((code: string, language: Language) => {
    if (!channelRef.current) return;
    
    const now = Date.now();
    pendingCodeRef.current = code;

    if (now - lastSyncRef.current >= SYNC_INTERVAL) {
      lastSyncRef.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'code_update',
        payload: {
          code,
          language,
          updatedBy: userIdRef.current,
          timestamp: now,
        },
      });
      pendingCodeRef.current = null;
    } else {
      // Schedule sync for pending update
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        if (pendingCodeRef.current !== null && channelRef.current) {
          lastSyncRef.current = Date.now();
          channelRef.current.send({
            type: 'broadcast',
            event: 'code_update',
            payload: {
              code: pendingCodeRef.current,
              language,
              updatedBy: userIdRef.current,
              timestamp: Date.now(),
            },
          });
          pendingCodeRef.current = null;
        }
      }, SYNC_INTERVAL - (now - lastSyncRef.current));
    }
  }, []);

  // Broadcast whiteboard snapshot
  const broadcastWhiteboard = useCallback((snapshot: WhiteboardSnapshot) => {
    if (!channelRef.current) return;
    
    const now = Date.now();
    if (now - lastWhiteboardSyncRef.current < 100) return;
    
    lastWhiteboardSyncRef.current = now;
    whiteboardSnapshotRef.current = snapshot;
    
    console.log('Broadcasting whiteboard update:', snapshot.shapes?.length, 'shapes');
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'whiteboard_update',
      payload: {
        snapshot,
        updatedBy: userIdRef.current,
        timestamp: now,
      },
    });
  }, []);

  // Update cursor position
  const updateCursor = useCallback((cursor: CursorPosition | null, selection?: { start: CursorPosition; end: CursorPosition }) => {
    if (!channelRef.current) return;
    
    channelRef.current.track({
      user_id: userIdRef.current,
      name: userNameRef.current,
      color: userColorRef.current,
      is_owner: isOwnerRef.current,
      cursor,
      selection,
      online_at: new Date().toISOString(),
    });
  }, []);

  // Subscribe to realtime channel
  const subscribeToChannel = useCallback((id: string, initialRoom: Room) => {
    // Unsubscribe from existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    console.log('Subscribing to channel:', `room:${id}`);
    
    const channel = supabase.channel(`room:${id}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userIdRef.current },
      },
    });

    // Track presence for connected users and cursors
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: UserPresence[] = [];
      
      Object.entries(state).forEach(([key, presences]) => {
        if (key !== userIdRef.current && presences.length > 0) {
          const presence = presences[0] as any;
          users.push({
            id: presence.user_id,
            name: presence.name || `User-${key.slice(0, 4)}`,
            color: presence.color || USER_COLORS[0],
            cursor: presence.cursor,
            selection: presence.selection,
            isOwner: presence.is_owner || false,
          });
        }
      });
      
      setRemotePresence(users);
      setConnectedUsers(Object.keys(state).length);
    });

    // Listen for code updates
    channel.on('broadcast', { event: 'code_update' }, ({ payload }) => {
      if (payload.updatedBy !== userIdRef.current) {
        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            code: payload.code,
            language: payload.language,
          };
        });
      }
    });

    // Listen for initial state request (for viewers joining)
    channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
      console.log('State requested by:', payload.userId);
      // Only owner broadcasts current state
      if (isOwnerRef.current) {
        const currentRoom = getStoredRoom(id);
        if (currentRoom) {
          console.log('Broadcasting current state to new user');
          channel.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: {
              code: currentRoom.code,
              language: currentRoom.language,
              whiteboard: whiteboardSnapshotRef.current,
              fromOwner: true,
            },
          });
        }
      }
    });

    // Listen for state sync (for new viewers)
    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      console.log('Received state sync:', payload);
      if (!isOwnerRef.current && payload.fromOwner) {
        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            code: payload.code,
            language: payload.language,
          };
        });
        if (payload.whiteboard) {
          setRemoteWhiteboardSnapshot(payload.whiteboard);
        }
      }
    });

    // Listen for whiteboard updates
    channel.on('broadcast', { event: 'whiteboard_update' }, ({ payload }) => {
      if (payload.updatedBy !== userIdRef.current) {
        setRemoteWhiteboardSnapshot(payload.snapshot);
      }
    });

    channel.subscribe(async (status) => {
      console.log('Channel status:', status);
      if (status === 'SUBSCRIBED') {
        // Track presence with user info
        await channel.track({
          user_id: userIdRef.current,
          name: userNameRef.current,
          color: userColorRef.current,
          is_owner: isOwnerRef.current,
          online_at: new Date().toISOString(),
        });

        // If not owner, request current state
        if (!isOwnerRef.current) {
          console.log('Requesting current state from owner');
          channel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { userId: userIdRef.current },
          });
        }
      }
    });

    channelRef.current = channel;
  }, [getStoredRoom]);

  // Update room code with broadcast
  const updateCode = useCallback((code: string) => {
    if (!room || isViewOnly) return;

    const updatedRoom = { ...room, code };
    setRoom(updatedRoom);
    saveToStorage(updatedRoom);

    // Broadcast to other users with throttling
    broadcastCodeUpdate(code, room.language);
  }, [room, isViewOnly, saveToStorage, broadcastCodeUpdate]);

  // Update room language with broadcast
  const updateLanguage = useCallback((language: Language) => {
    if (!room || isViewOnly) return;

    const updatedRoom = {
      ...room,
      language,
      code: LANGUAGE_CONFIG[language].defaultCode,
    };
    setRoom(updatedRoom);
    saveToStorage(updatedRoom);

    // Broadcast to other users
    if (channelRef.current) {
      console.log('Broadcasting language change');
      channelRef.current.send({
        type: 'broadcast',
        event: 'code_update',
        payload: {
          code: updatedRoom.code,
          language,
          updatedBy: userIdRef.current,
        },
      });
    }
  }, [room, isViewOnly, saveToStorage]);

  // Initialize room on mount
  useEffect(() => {
    setLoading(true);
    
    let initialRoom: Room;
    
    if (roomId) {
      // Joining existing room
      const storedRoom = getStoredRoom(roomId);
      
      if (storedRoom && storedRoom.isOwner) {
        // We're the owner
        isOwnerRef.current = true;
        initialRoom = {
          id: storedRoom.id,
          code: storedRoom.code,
          language: storedRoom.language,
          isOwner: true,
        };
        setIsViewOnly(false);
      } else {
        // We're a viewer
        isOwnerRef.current = false;
        initialRoom = {
          id: roomId,
          code: '// Connecting to room...',
          language: 'javascript',
          isOwner: false,
        };
        setIsViewOnly(true);
      }
      
      setRoom(initialRoom);
      subscribeToChannel(roomId, initialRoom);
    } else {
      // Create new room
      initialRoom = createRoom();
      subscribeToChannel(initialRoom.id, initialRoom);
    }
    
    setLoading(false);

    // Cleanup on unmount
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (channelRef.current) {
        console.log('Cleaning up channel');
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId]);

  return {
    room,
    isViewOnly,
    loading,
    connectedUsers,
    remotePresence,
    remoteWhiteboardSnapshot,
    createRoom,
    updateCode,
    updateLanguage,
    updateCursor,
    broadcastWhiteboard,
    userId: userIdRef.current,
    userColor: userColorRef.current,
  };
}

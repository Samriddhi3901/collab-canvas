import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/integrations/supabase/client';
import { Language, LANGUAGE_CONFIG, Room } from '@/types/editor';
import { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = 'collabcode_rooms';

interface RoomState {
  code: string;
  language: Language;
  updatedBy: string;
}

export function useRealtimeRoom(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectedUsers, setConnectedUsers] = useState<number>(1);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string>(nanoid(8));
  const isOwnerRef = useRef<boolean>(false);

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

    // Track presence for connected users
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const userCount = Object.keys(state).length;
      console.log('Presence sync:', userCount, 'users');
      setConnectedUsers(userCount);
    });

    // Listen for code updates
    channel.on('broadcast', { event: 'code_update' }, ({ payload }) => {
      console.log('Received code update:', payload);
      if (payload.updatedBy !== userIdRef.current) {
        setRoom(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            code: payload.code,
            language: payload.language,
          };
          return updated;
        });
      }
    });

    // Listen for initial state request (for viewers joining)
    channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
      console.log('State requested by:', payload.userId);
      // Only owner broadcasts current state
      if (isOwnerRef.current && room) {
        console.log('Broadcasting current state to new user');
        channel.send({
          type: 'broadcast',
          event: 'sync_state',
          payload: {
            code: room.code,
            language: room.language,
            fromOwner: true,
          },
        });
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
      }
    });

    channel.subscribe(async (status) => {
      console.log('Channel status:', status);
      if (status === 'SUBSCRIBED') {
        // Track presence
        await channel.track({
          online_at: new Date().toISOString(),
          user_id: userIdRef.current,
          is_owner: isOwnerRef.current,
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
  }, [room]);

  // Update room code with broadcast
  const updateCode = useCallback((code: string) => {
    if (!room || isViewOnly) return;

    const updatedRoom = { ...room, code };
    setRoom(updatedRoom);
    saveToStorage(updatedRoom);

    // Broadcast to other users
    if (channelRef.current) {
      console.log('Broadcasting code update');
      channelRef.current.send({
        type: 'broadcast',
        event: 'code_update',
        payload: {
          code,
          language: room.language,
          updatedBy: userIdRef.current,
        },
      });
    }
  }, [room, isViewOnly, saveToStorage]);

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
      if (channelRef.current) {
        console.log('Cleaning up channel');
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId]);

  // Re-subscribe when room changes (for owner broadcasting updates)
  useEffect(() => {
    if (room && channelRef.current && isOwnerRef.current) {
      // Keep the room ref updated for broadcasting state to new users
    }
  }, [room]);

  return {
    room,
    isViewOnly,
    loading,
    connectedUsers,
    createRoom,
    updateCode,
    updateLanguage,
  };
}

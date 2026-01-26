import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { Language, LANGUAGE_CONFIG, Room } from '@/types/editor';

const STORAGE_KEY = 'collabcode_rooms';

interface StoredRoom {
  id: string;
  code: string;
  language: Language;
  createdAt: string;
  isOwner: boolean;
}

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load rooms from localStorage
  const getStoredRooms = useCallback((): Record<string, StoredRoom> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // Save rooms to localStorage
  const saveRoom = useCallback((roomData: StoredRoom) => {
    const rooms = getStoredRooms();
    rooms[roomData.id] = roomData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  }, [getStoredRooms]);

  // Create a new room
  const createRoom = useCallback((language: Language = 'javascript'): Room => {
    const newRoom: Room = {
      id: nanoid(8),
      code: LANGUAGE_CONFIG[language].defaultCode,
      language,
      isOwner: true,
    };

    saveRoom({
      ...newRoom,
      createdAt: new Date().toISOString(),
    });

    setRoom(newRoom);
    setIsViewOnly(false);
    return newRoom;
  }, [saveRoom]);

  // Join an existing room
  const joinRoom = useCallback((id: string): Room | null => {
    const rooms = getStoredRooms();
    const storedRoom = rooms[id];

    if (storedRoom) {
      const joinedRoom: Room = {
        id: storedRoom.id,
        code: storedRoom.code,
        language: storedRoom.language,
        isOwner: storedRoom.isOwner,
      };
      setRoom(joinedRoom);
      setIsViewOnly(!storedRoom.isOwner);
      return joinedRoom;
    }

    // Room doesn't exist locally - create view-only placeholder
    const viewOnlyRoom: Room = {
      id,
      code: '// Loading room content...',
      language: 'javascript',
      isOwner: false,
    };
    setRoom(viewOnlyRoom);
    setIsViewOnly(true);
    return viewOnlyRoom;
  }, [getStoredRooms]);

  // Update room code
  const updateCode = useCallback((code: string) => {
    if (!room || isViewOnly) return;

    const updatedRoom = { ...room, code };
    setRoom(updatedRoom);
    saveRoom({
      ...updatedRoom,
      createdAt: new Date().toISOString(),
    });
  }, [room, isViewOnly, saveRoom]);

  // Update room language
  const updateLanguage = useCallback((language: Language) => {
    if (!room || isViewOnly) return;

    const updatedRoom = { 
      ...room, 
      language,
      code: LANGUAGE_CONFIG[language].defaultCode,
    };
    setRoom(updatedRoom);
    saveRoom({
      ...updatedRoom,
      createdAt: new Date().toISOString(),
    });
  }, [room, isViewOnly, saveRoom]);

  // Initialize room on mount
  useEffect(() => {
    setLoading(true);
    
    if (roomId) {
      joinRoom(roomId);
    } else {
      createRoom();
    }
    
    setLoading(false);
  }, [roomId]);

  return {
    room,
    isViewOnly,
    loading,
    createRoom,
    joinRoom,
    updateCode,
    updateLanguage,
  };
}

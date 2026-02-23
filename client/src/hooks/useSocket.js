import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getSocket, initSocket } from '../services/socket';

/**
 * Custom hook to subscribe to socket events.
 * Automatically cleans up listeners on unmount.
 *
 * @param {Record<string, Function>} events - Object mapping event names to handlers
 * @param {any[]} deps - Dependency array for re-subscribing
 */
export const useSocket = (events, deps = []) => {
  const { isAuthenticated } = useSelector((s) => s.auth);
  const socket = getSocket();

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handlers = Object.entries(events);
    handlers.forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      handlers.forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, isAuthenticated, ...deps]);
};

export default useSocket;

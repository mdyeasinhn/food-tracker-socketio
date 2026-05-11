import { useState } from 'react';
import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL

export const useSocket = () => {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    useEffect(() => {
        //CREATE SOCKET CONNECTION
        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
        });
        //connetion event
        socketRef.current.on('connect', () => {
            setConnected(true);
            console.log('Connected to socket server', socketRef.current.id);
        });

        //disconnection event
        socketRef.current.on('disconnect', () => {
            setConnected(false);
            console.log('Disconnected from socket server');
        });

        socketRef.current.on("connected", (data) => {
            console.log("server message:", data.message);
        });

        //CLEANUP ON UNMOUNT
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);
    return {
        socket : socketRef.current,
        connected
    }
}
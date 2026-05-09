import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL

const useSocket = () => {
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
        })
}, []);
}
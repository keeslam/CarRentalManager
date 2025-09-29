import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Create socket connection
    const socketInstance = io({
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    setSocket(socketInstance);

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('🔗 Connected to real-time server:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from real-time server:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connected', (data) => {
      console.log('✅ Real-time connection established:', data.message);
      toast({
        title: "Connected",
        description: "Real-time updates enabled",
        duration: 2000,
      });
    });

    // Real-time data update handler
    socketInstance.on('data-update', (event) => {
      console.log('📡 Received real-time update:', event);
      
      const { entityType, action, data, timestamp } = event;
      
      // Show toast notification for updates
      const actionText = action === 'created' ? 'added' : 
                        action === 'updated' ? 'updated' : 
                        action === 'deleted' ? 'removed' : action;
      
      toast({
        title: "Data Updated", 
        description: `${entityType.slice(0, -1)} ${actionText}${data?.name ? `: ${data.name}` : ''}`,
        duration: 3000,
      });

      // Invalidate React Query cache for real-time updates
      invalidateQueries(entityType, action, data);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setIsConnected(false);
    });

    return () => {
      console.log('🔌 Cleaning up socket connection...');
      socketInstance.disconnect();
    };
  }, [toast]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// Smart cache invalidation based on entity type and action
function invalidateQueries(entityType: string, action: string, data?: any) {
  console.log(`🔄 Invalidating cache for ${entityType} ${action}`);

  switch (entityType) {
    case 'users':
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/users', data.id] });
      }
      break;

    case 'vehicles':
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles-with-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/filtered-vehicles'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.id] });
      }
      break;

    case 'customers':
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/customers', data.id] });
      }
      break;

    case 'reservations':
      // Invalidate ALL reservation queries including calendar range queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/reservations');
        }
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles-with-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/filtered-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/reservations', data.id] });
      }
      // Also invalidate related vehicles data
      if (data?.vehicleId) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.vehicleId] });
      }
      break;

    case 'expenses':
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/expenses', data.id] });
      }
      // Also invalidate related vehicles data
      if (data?.vehicleId) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.vehicleId] });
      }
      break;

    case 'documents':
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/documents', data.id] });
      }
      // Also invalidate related vehicles data
      if (data?.vehicleId) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.vehicleId] });
      }
      break;

    case 'notifications':
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/notifications', data.id] });
      }
      break;

    default:
      // Fallback: invalidate all queries for unknown entity types
      console.log('🔄 Invalidating all queries for unknown entity type:', entityType);
      queryClient.invalidateQueries();
      break;
  }
}
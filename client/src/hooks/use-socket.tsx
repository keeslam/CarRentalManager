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
    });

    // Real-time data update handler
    socketInstance.on('data-update', (event) => {
      console.log('📡 Received real-time update:', event);
      
      const { entityType, action, data } = event;

      // Invalidate React Query cache for real-time updates
      // This will automatically refetch active queries and update the UI
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
      queryClient.invalidateQueries({ queryKey: ['/api/customers/with-reservations'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/customers', data.id] });
      }
      break;

    case 'reservations':
      // Force immediate refetch of ALL reservation queries including calendar range queries
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/reservations');
        },
        type: 'active' // Only refetch currently active queries
      });
      
      // Also refetch these specific queries that depend on reservation data
      queryClient.refetchQueries({ 
        queryKey: ['/api/vehicles-with-reservations'],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/filtered-vehicles'],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/vehicles/available'],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/vehicles/apk-expiring'],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/vehicles/warranty-expiring'],
        type: 'active'
      });
      
      if (data?.id) {
        queryClient.refetchQueries({ queryKey: ['/api/reservations', data.id], type: 'active' });
      }
      // Also invalidate related vehicles data
      if (data?.vehicleId) {
        queryClient.refetchQueries({ queryKey: ['/api/vehicles', data.vehicleId], type: 'active' });
      }
      break;

    case 'expenses':
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/recent'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/expenses', data.id] });
      }
      // Also invalidate related vehicles data and vehicle-specific expenses
      if (data?.vehicleId) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.vehicleId] });
        queryClient.invalidateQueries({ queryKey: ['/api/expenses/vehicle', data.vehicleId] });
      }
      break;

    case 'documents':
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/documents', data.id] });
      }
      // Also invalidate related vehicles data and vehicle-specific documents
      if (data?.vehicleId) {
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles', data.vehicleId] });
        queryClient.invalidateQueries({ queryKey: ['/api/documents/vehicle', data.vehicleId] });
      }
      break;

    case 'notifications':
      // Invalidate all notification-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-notifications/unread'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-notifications/user'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/notifications', data.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/custom-notifications', data.id] });
      }
      // Invalidate type-specific notifications if type is available
      if (data?.type) {
        queryClient.invalidateQueries({ queryKey: ['/api/custom-notifications/type', data.type] });
      }
      break;

    default:
      // Fallback: invalidate all queries for unknown entity types
      console.log('🔄 Invalidating all queries for unknown entity type:', entityType);
      queryClient.invalidateQueries();
      break;
  }
}
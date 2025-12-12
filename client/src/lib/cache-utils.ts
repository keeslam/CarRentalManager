import { queryClient } from "./queryClient";

export function invalidateVehicleData(vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/vehicles')) return true;
      if (key.startsWith('/api/reservations')) return true;
      if (vehicleId && key.includes(`/${vehicleId}`)) return true;
      
      return false;
    }
  });
  
  queryClient.refetchQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      return key.startsWith('/api/vehicles') || key.startsWith('/api/reservations');
    },
    type: 'active'
  });
}

export function invalidateReservationData(reservationId?: number, vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/reservations')) return true;
      if (key.startsWith('/api/vehicles')) return true;
      if (key.startsWith('/api/placeholder-reservations')) return true;
      if (reservationId && key.includes(`/${reservationId}`)) return true;
      if (vehicleId && key.includes(`/${vehicleId}`)) return true;
      
      return false;
    }
  });
  
  queryClient.refetchQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      return key.startsWith('/api/reservations') || key.startsWith('/api/vehicles');
    },
    type: 'active'
  });
}

export function invalidateAllRelatedData() {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      return key.startsWith('/api/vehicles') || 
             key.startsWith('/api/reservations') ||
             key.startsWith('/api/customers') ||
             key.startsWith('/api/expenses') ||
             key.startsWith('/api/placeholder-reservations');
    }
  });
  
  queryClient.refetchQueries({ type: 'active' });
}

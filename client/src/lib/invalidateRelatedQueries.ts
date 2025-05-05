import { queryClient } from "./queryClient";

/**
 * Helper function to invalidate all related queries when a record is updated
 * @param resourceType - The type of resource (customers, vehicles, etc.)
 * @param id - The ID of the specific resource
 */
export const invalidateRelatedQueries = async (
  resourceType: string,
  id?: number
) => {
  // Always invalidate the main collection
  await queryClient.invalidateQueries({ queryKey: [`/api/${resourceType}`] });
  
  // If we have an ID, also invalidate that specific resource's query
  if (id) {
    await queryClient.invalidateQueries({ 
      queryKey: [`/api/${resourceType}/${id}`] 
    });
  }
  
  // Invalidate any other related collections based on resource type
  switch (resourceType) {
    case "customers":
      // Also invalidate reservations that might contain customer data
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/reservations"] 
      });
      if (id) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/reservations/customer/${id}`]
        });
      }
      break;
      
    case "vehicles":
      // Also invalidate reservations and documents that might contain vehicle data
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/reservations"] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/documents"] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/expenses"] 
      });
      if (id) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/reservations/vehicle/${id}`]
        });
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/documents/vehicle/${id}`]
        });
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/expenses/vehicle/${id}`]
        });
      }
      break;
      
    case "reservations":
      // Invalidate customers and vehicles queries as they may display reservation information
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/customers"] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/vehicles"] 
      });
      // Also invalidate the "upcoming" endpoint
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/reservations/upcoming"] 
      });
      break;
      
    default:
      break;
  }
};
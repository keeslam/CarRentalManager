import { 
  users, type User, type InsertUser,
  vehicles, type Vehicle, type InsertVehicle,
  customers, type Customer, type InsertCustomer,
  reservations, type Reservation, type InsertReservation,
  expenses, type Expense, type InsertExpense,
  documents, type Document, type InsertDocument,
  pdfTemplates, type PdfTemplate, type InsertPdfTemplate,
  customNotifications, type CustomNotification, type InsertCustomNotification,
  backupSettings, type BackupSettings, type InsertBackupSettings,
  appSettings, type AppSettings, type InsertAppSettings
} from "../shared/schema";
import { addMonths, addDays, parseISO, isBefore, isAfter, isEqual } from "date-fns";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, inArray, not, or, ilike, isNull } from "drizzle-orm";
import { IStorage } from "./storage";

// Helper function for NOT IN array since drizzle-orm doesn't have a direct equivalent
function notInArray(column: any, values: any[]) {
  if (values.length === 0) return sql`1=1`; // Always true if no values
  return not(inArray(column, values));
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    // Don't allow updating the password through this method
    // Password updates should use a dedicated method with proper hashing
    if (userData.password) {
      delete userData.password;
    }
    
    // Add updatedAt timestamp
    const updateData = {
      ...userData,
      updatedAt: new Date()
    };
    
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
      
    return updatedUser;
  }
  
  async updateUserPassword(id: number, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
      
    return result.rowCount > 0;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Vehicle methods
  async getAllVehicles(searchQuery?: string): Promise<Vehicle[]> {
    if (!searchQuery) {
      return await db.select().from(vehicles);
    }
    
    // Sanitize the search query to handle license plates with or without dashes
    const sanitizedQuery = searchQuery.replace(/-/g, "").toUpperCase();
    
    // Search by license plate (without dashes), brand, or model
    return await db.select()
      .from(vehicles)
      .where(
        or(
          // Handle license plate search with or without dashes - using upper for case insensitivity
          sql`UPPER(replace(${vehicles.licensePlate}, '-', '')) LIKE ${`%${sanitizedQuery}%`}`,
          sql`UPPER(${vehicles.brand}) LIKE ${`%${sanitizedQuery}%`}`,
          sql`UPPER(${vehicles.model}) LIKE ${`%${sanitizedQuery}%`}`
        )
      )
      .limit(10);
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(vehicleData: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(vehicleData).returning();
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    console.log(`Database updateVehicle called for ID ${id} with data:`, JSON.stringify(vehicleData, null, 2));
    try {
      // Explicitly debug the updatedBy value
      if ('updatedBy' in vehicleData) {
        console.log(`updatedBy value before database call: "${vehicleData.updatedBy}"`);
        
        // Try a direct SQL update to ensure the updated_by field is set
        console.log("Executing direct SQL update for updated_by field");
        const updateResult = await db.execute(sql`
          UPDATE vehicles
          SET updated_by = ${vehicleData.updatedBy}
          WHERE id = ${id}
        `);
        console.log("Direct SQL update result:", updateResult);
      } else {
        console.log("No updatedBy field in update data");
      }
      
      // Handle other properties normally
      const updateObject = {...vehicleData};
      if ('updatedBy' in updateObject) {
        delete updateObject.updatedBy; // Remove since we're handling separately
      }
      
      // Normal update for all other fields
      if (Object.keys(updateObject).length > 0) {
        const [updatedVehicle] = await db
          .update(vehicles)
          .set(updateObject)
          .where(eq(vehicles.id, id))
          .returning();
        
        console.log("Database returned vehicle:", JSON.stringify(updatedVehicle, null, 2));
        return updatedVehicle || undefined;
      } else {
        // If we only updated updatedBy, we need to return the vehicle anyway
        const [vehicle] = await db
          .select()
          .from(vehicles)
          .where(eq(vehicles.id, id));
        
        return vehicle || undefined;
      }
    } catch (error) {
      console.error("Error in database updateVehicle:", error);
      throw error;
    }
  }
  
  // Complete rewrite with basic direct statements to update vehicle registration
  async updateVehicleRegistrationStatus(id: number, status: string, userData: {
    username: string;
    date: string;
  }): Promise<Vehicle | undefined> {
    try {
      // Simple backup approach without any SQL parameters
      if (status === 'opnaam') {
        await this.updateVehicle(id, {
          registeredTo: "true",
          registeredToDate: userData.date,
          registeredToBy: userData.username,
          company: "false"
        });
      }
      else if (status === 'not-opnaam') {
        await this.updateVehicle(id, {
          registeredTo: "false",
          registeredToDate: userData.date,
          registeredToBy: userData.username
        });
      }
      else if (status === 'bv') {
        await this.updateVehicle(id, {
          company: "true",
          companyDate: userData.date,
          companyBy: userData.username,
          registeredTo: "false"
        });
      }
      else if (status === 'not-bv') {
        await this.updateVehicle(id, {
          company: "false",
          companyDate: userData.date,
          companyBy: userData.username
        });
      }
      else {
        throw new Error(`Invalid registration status: ${status}`);
      }
      
      // Get the updated vehicle data
      const updatedVehicle = await this.getVehicle(id);
      
      console.log("Database returned vehicle after status update:", JSON.stringify(updatedVehicle, null, 2));
      return updatedVehicle || undefined;
    } catch (error) {
      console.error(`Error in updateVehicleRegistrationStatus for ${status}:`, error);
      throw error;
    }
  }
  
  async deleteVehicle(id: number): Promise<boolean> {
    // Start a transaction to ensure all related records are deleted
    return await db.transaction(async (tx) => {
      try {
        // Delete related documents first
        await tx.delete(documents).where(eq(documents.vehicleId, id));
        
        // Delete related expenses
        await tx.delete(expenses).where(eq(expenses.vehicleId, id));
        
        // Delete related reservations
        await tx.delete(reservations).where(eq(reservations.vehicleId, id));
        
        // Finally delete the vehicle
        const [deleted] = await tx
          .delete(vehicles)
          .where(eq(vehicles.id, id))
          .returning();
        
        return !!deleted;
      } catch (error) {
        console.error("Error during vehicle deletion transaction:", error);
        throw error;
      }
    });
  }

  async getAvailableVehicles(): Promise<Vehicle[]> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all vehicles that don't have a non-cancelled reservation that includes today
    const reservedVehicleIds = await db
      .select({ vehicleId: reservations.vehicleId })
      .from(reservations)
      .where(
        and(
          sql`${reservations.status} != 'cancelled'`,
          sql`${reservations.startDate} <= ${today}`,
          sql`${reservations.endDate} >= ${today}`
        )
      );
    
    const reservedIds = new Set(reservedVehicleIds.map(row => row.vehicleId));
    
    if (reservedIds.size === 0) {
      return await db.select().from(vehicles);
    }
    
    // When we have reserved vehicles, query for all those not in the reserved list
    const reservedIdsArray = Array.from(reservedIds);
    
    // Handle each vehicle separately with individual OR conditions to avoid array parameter issues
    const vehicleConditions = reservedIdsArray.map(id => sql`${vehicles.id} != ${id}`);
    const combinedCondition = sql.join(vehicleConditions, sql` AND `);
    
    return await db
      .select()
      .from(vehicles)
      .where(combinedCondition);
  }

  async getVehiclesWithApkExpiringSoon(): Promise<Vehicle[]> {
    const today = new Date();
    const twoMonthsFromNow = addMonths(today, 2);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = twoMonthsFromNow.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(vehicles)
      .where(
        and(
          sql`${vehicles.apkDate} IS NOT NULL`,
          sql`${vehicles.apkDate} > ${todayStr}`,
          sql`${vehicles.apkDate} <= ${futureStr}`
        )
      );
  }

  async getVehiclesWithWarrantyExpiringSoon(): Promise<Vehicle[]> {
    const today = new Date();
    const twoMonthsFromNow = addMonths(today, 2);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = twoMonthsFromNow.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(vehicles)
      .where(
        and(
          sql`${vehicles.warrantyEndDate} IS NOT NULL`,
          sql`${vehicles.warrantyEndDate} > ${todayStr}`,
          sql`${vehicles.warrantyEndDate} <= ${futureStr}`
        )
      );
  }

  // Customer methods
  async getAllCustomers(searchQuery?: string): Promise<Customer[]> {
    if (!searchQuery) {
      return await db.select().from(customers);
    }
    
    // Convert to uppercase for case-insensitivity
    const upperQuery = searchQuery.toUpperCase();
    
    // Search by name, email, or phone - using UPPER for consistent case-insensitivity
    return await db.select()
      .from(customers)
      .where(
        or(
          sql`UPPER(${customers.name}) LIKE ${`%${upperQuery}%`}`,
          sql`UPPER(${customers.email}) LIKE ${`%${upperQuery}%`}`,
          sql`UPPER(${customers.phone}) LIKE ${`%${upperQuery}%`}`,
          sql`UPPER(${customers.debtorNumber}) LIKE ${`%${upperQuery}%`}`
        )
      )
      .limit(10);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    
    return updatedCustomer || undefined;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const deletedRows = await db
      .delete(customers)
      .where(eq(customers.id, id));
    
    return deletedRows.rowCount > 0;
  }

  // Reservation methods
  async getAllReservations(searchQuery?: string): Promise<Reservation[]> {
    let reservationsData;
    
    if (searchQuery) {
      // Sanitize the search query to handle license plates with or without dashes
      const sanitizedQuery = searchQuery.replace(/-/g, "").toUpperCase();
      
      // First, search for vehicles and customers matching the query
      const matchingVehicles = await db.select()
        .from(vehicles)
        .where(
          or(
            // Handle license plate search with or without dashes - using upper for case insensitivity
            sql`UPPER(replace(${vehicles.licensePlate}, '-', '')) LIKE ${`%${sanitizedQuery}%`}`,
            sql`UPPER(${vehicles.brand}) LIKE ${`%${sanitizedQuery}%`}`,
            sql`UPPER(${vehicles.model}) LIKE ${`%${sanitizedQuery}%`}`
          )
        );
      
      const matchingCustomers = await db.select()
        .from(customers)
        .where(
          or(
            sql`UPPER(${customers.name}) LIKE ${`%${sanitizedQuery}%`}`,
            sql`UPPER(${customers.email}) LIKE ${`%${sanitizedQuery}%`}`,
            sql`UPPER(${customers.phone}) LIKE ${`%${sanitizedQuery}%`}`
          )
        );
      
      const vehicleIds = matchingVehicles.map(v => v.id);
      const customerIds = matchingCustomers.map(c => c.id);
      
      // Query reservations that match either vehicle or customer
      if (vehicleIds.length > 0 || customerIds.length > 0) {
        const conditions = [];
        if (vehicleIds.length > 0) {
          conditions.push(inArray(reservations.vehicleId, vehicleIds));
        }
        if (customerIds.length > 0) {
          conditions.push(inArray(reservations.customerId, customerIds));
        }
        
        reservationsData = await db.select()
          .from(reservations)
          .where(and(or(...conditions), isNull(reservations.deletedAt)))
          .limit(10);
      } else {
        // If no matching vehicles or customers, check if search matches a date
        reservationsData = await db.select()
          .from(reservations)
          .where(
            and(
              or(
                sql`UPPER(${reservations.startDate}) LIKE ${`%${sanitizedQuery}%`}`,
                sql`UPPER(${reservations.endDate}) LIKE ${`%${sanitizedQuery}%`}`,
                sql`UPPER(${reservations.status}) LIKE ${`%${sanitizedQuery}%`}`
              ),
              isNull(reservations.deletedAt)
            )
          )
          .limit(10);
      }
    } else {
      reservationsData = await db.select().from(reservations).where(isNull(reservations.deletedAt));
    }
    
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    for (const reservation of reservationsData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
      const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  async getReservation(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations).where(and(eq(reservations.id, id), isNull(reservations.deletedAt)));
    
    if (!reservation) {
      return undefined;
    }
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
    const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
    
    return {
      ...reservation,
      vehicle,
      customer
    };
  }

  async createReservation(reservationData: InsertReservation): Promise<Reservation> {
    // Convert totalPrice to string if it's a number
    const dataToInsert = {
      ...reservationData,
      // Convert totalPrice to string if present
      totalPrice: reservationData.totalPrice !== undefined 
        ? String(reservationData.totalPrice) 
        : undefined
    };
    
    const [reservation] = await db.insert(reservations).values(dataToInsert).returning();
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
    const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
    
    return {
      ...reservation,
      vehicle,
      customer
    };
  }

  async updateReservation(id: number, reservationData: Partial<InsertReservation>): Promise<Reservation | undefined> {
    // Convert totalPrice to string if it's a number
    const dataToUpdate = {
      ...reservationData,
      // Convert totalPrice to string if present
      totalPrice: reservationData.totalPrice !== undefined 
        ? String(reservationData.totalPrice) 
        : undefined
    };
    
    const [updatedReservation] = await db
      .update(reservations)
      .set(dataToUpdate)
      .where(eq(reservations.id, id))
      .returning();
    
    if (!updatedReservation) {
      return undefined;
    }
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, updatedReservation.vehicleId));
    const [customer] = await db.select().from(customers).where(eq(customers.id, updatedReservation.customerId));
    
    return {
      ...updatedReservation,
      vehicle,
      customer
    };
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    const result = await db
      .delete(reservations)
      .where(eq(reservations.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getReservationsInDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const reservationsData = await db
      .select()
      .from(reservations)
      .where(
        and(
          sql`(${reservations.startDate} <= ${endDate} AND ${reservations.endDate} >= ${startDate})
              OR (${reservations.startDate} >= ${startDate} AND ${reservations.startDate} <= ${endDate})
              OR (${reservations.endDate} >= ${startDate} AND ${reservations.endDate} <= ${endDate})`,
          isNull(reservations.deletedAt)
        )
      );
    
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    for (const reservation of reservationsData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
      let customer = null;
      
      // For maintenance blocks, try to find customer from active open-ended rental
      if (reservation.type === 'maintenance_block' && !reservation.customerId && reservation.vehicleId) {
        console.log(`🔍 Looking for active rental for maintenance block ${reservation.id} on vehicle ${reservation.vehicleId}`);
        const [activeRental] = await db.select()
          .from(reservations)
          .where(
            and(
              eq(reservations.vehicleId, reservation.vehicleId),
              eq(reservations.type, 'standard'),
              sql`(${reservations.endDate} IS NULL OR ${reservations.endDate} = 'undefined')`,
              sql`${reservations.status} IN ('confirmed', 'pending')`,
              isNull(reservations.deletedAt)
            )
          )
          .limit(1);
        
        console.log(`📋 Found active rental:`, activeRental);
        
        if (activeRental && activeRental.customerId) {
          const [rentalCustomer] = await db.select().from(customers).where(eq(customers.id, activeRental.customerId));
          customer = rentalCustomer;
          console.log(`✅ Found customer from active rental:`, customer?.name);
        } else {
          console.log(`❌ No active rental found for vehicle ${reservation.vehicleId}`);
        }
      } else if (reservation.customerId) {
        // Normal reservation with direct customer assignment
        const [directCustomer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
        customer = directCustomer;
      }
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  async getUpcomingReservations(): Promise<Reservation[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const reservationsData = await db
      .select()
      .from(reservations)
      .where(
        and(
          sql`${reservations.startDate} >= ${today}`,
          sql`${reservations.status} != 'cancelled'`
        )
      )
      .orderBy(reservations.startDate)
      .limit(5);
    
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    for (const reservation of reservationsData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
      const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  async getReservationsByVehicle(vehicleId: number): Promise<Reservation[]> {
    const reservationsData = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.vehicleId, vehicleId), isNull(reservations.deletedAt)))
      .orderBy(desc(reservations.startDate));
    
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    
    for (const reservation of reservationsData) {
      const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  async getReservationsByCustomer(customerId: number): Promise<Reservation[]> {
    const reservationsData = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.customerId, customerId), isNull(reservations.deletedAt)))
      .orderBy(desc(reservations.startDate));
    
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    
    for (const reservation of reservationsData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, reservation.vehicleId));
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  async checkReservationConflicts(
    vehicleId: number, 
    startDate: string, 
    endDate: string | null, 
    excludeReservationId: number | null
  ): Promise<Reservation[]> {
    // For open-ended rentals (null endDate), use a far-future date for conflict checking
    // This ensures that an open-ended rental conflicts with all future reservations
    const effectiveEndDate = endDate || '9999-12-31';
    
    let query = db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.vehicleId, vehicleId),
          sql`${reservations.status} != 'cancelled'`,
          sql`(
            (${reservations.startDate} <= ${effectiveEndDate} AND ${reservations.endDate} >= ${startDate})
            OR (${reservations.startDate} <= ${effectiveEndDate} AND (${reservations.endDate} IS NULL OR ${reservations.endDate} = 'undefined'))
          )`
        )
      );
    
    if (excludeReservationId !== null) {
      query = db
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.vehicleId, vehicleId),
            sql`${reservations.status} != 'cancelled'`,
            sql`(
              (${reservations.startDate} <= ${effectiveEndDate} AND ${reservations.endDate} >= ${startDate})
              OR (${reservations.startDate} <= ${effectiveEndDate} AND (${reservations.endDate} IS NULL OR ${reservations.endDate} = 'undefined'))
            )`,
            sql`${reservations.id} != ${excludeReservationId}`
          )
        );
    }
    
    const reservationsData = await query;
    const result: Reservation[] = [];
    
    // Fetch vehicle and customer data for each reservation
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    
    for (const reservation of reservationsData) {
      const [customer] = await db.select().from(customers).where(eq(customers.id, reservation.customerId));
      
      result.push({
        ...reservation,
        vehicle,
        customer
      });
    }
    
    return result;
  }

  // Expense methods
  async getAllExpenses(): Promise<Expense[]> {
    const expensesData = await db.select().from(expenses);
    const result: Expense[] = [];
    
    // Fetch vehicle data for each expense
    for (const expense of expensesData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, expense.vehicleId));
      
      result.push({
        ...expense,
        vehicle
      });
    }
    
    return result;
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    
    if (!expense) {
      return undefined;
    }
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, expense.vehicleId));
    
    return {
      ...expense,
      vehicle
    };
  }

  async createExpense(expenseData: InsertExpense): Promise<Expense> {
    // Ensure amount is a string if it's a number
    const finalData = {
      ...expenseData,
      amount: typeof expenseData.amount === 'number' ? String(expenseData.amount) : expenseData.amount
    };
    
    console.log("Database - creating expense with data:", finalData);
    const [expense] = await db.insert(expenses).values(finalData).returning();
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, expense.vehicleId));
    
    return {
      ...expense,
      vehicle
    };
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<Expense | undefined> {
    // Ensure amount is a string if it's a number
    const finalData = {
      ...expenseData
    };
    
    if (finalData.amount !== undefined && typeof finalData.amount === 'number') {
      finalData.amount = String(finalData.amount);
    }
    
    console.log("Database - updating expense with data:", finalData);
    const [updatedExpense] = await db
      .update(expenses)
      .set(finalData)
      .where(eq(expenses.id, id))
      .returning();
    
    if (!updatedExpense) {
      return undefined;
    }
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, updatedExpense.vehicleId));
    
    return {
      ...updatedExpense,
      vehicle
    };
  }

  async getExpensesByVehicle(vehicleId: number): Promise<Expense[]> {
    const expensesData = await db
      .select()
      .from(expenses)
      .where(eq(expenses.vehicleId, vehicleId));
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    
    return expensesData.map(expense => ({
      ...expense,
      vehicle
    }));
  }

  async getRecentExpenses(limit: number): Promise<Expense[]> {
    const expensesData = await db
      .select()
      .from(expenses)
      .orderBy(desc(expenses.createdAt))
      .limit(limit);
    
    const result: Expense[] = [];
    
    // Fetch vehicle data for each expense
    for (const expense of expensesData) {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, expense.vehicleId));
      
      result.push({
        ...expense,
        vehicle
      });
    }
    
    return result;
  }
  
  async deleteExpense(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(expenses)
        .where(eq(expenses.id, id));
      
      // Check if any rows were affected by the deletion
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting expense:", error);
      return false;
    }
  }

  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(documentData).returning();
    return document;
  }

  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set(documentData)
      .where(eq(documents.id, id))
      .returning();
    
    return updatedDocument || undefined;
  }

  async getDocumentsByVehicle(vehicleId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.vehicleId, vehicleId));
  }

  async deleteDocument(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning();
    
    return !!deleted;
  }
  
  // PDF Template methods
  async getAllPdfTemplates(): Promise<PdfTemplate[]> {
    return await db.select().from(pdfTemplates);
  }
  
  async getPdfTemplate(id: number): Promise<PdfTemplate | undefined> {
    const [template] = await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, id));
    return template || undefined;
  }
  
  async getDefaultPdfTemplate(): Promise<PdfTemplate | undefined> {
    try {
      // Use SQL query directly to handle potential column name mismatch
      console.log('Searching for default template...');
      const result = await db.execute(
        sql`SELECT * FROM pdf_templates WHERE is_default = true LIMIT 1`
      );
      
      if (result.length > 0) {
        const template = result[0];
        console.log('Found default template:', template.id, template.name);
        
        // Fix the isDefault property by adding it if missing
        if (template.isDefault === undefined && template.is_default !== undefined) {
          console.log('Fixing template isDefault property');
          template.isDefault = template.is_default;
        }
        
        // Process fields if it's a string
        if (template.fields && typeof template.fields === 'string') {
          try {
            // Try to parse JSON string
            const parsedFields = JSON.parse(template.fields);
            console.log(`Successfully parsed ${parsedFields.length} fields`);
            template.fields = parsedFields;
          } catch (error) {
            console.error('Error parsing template fields:', error);
          }
        }
        
        return template;
      } else {
        // If no default template found via 'is_default', try a fallback
        console.log('No templates with is_default=true found, checking all templates...');
        const allTemplates = await db.select().from(pdfTemplates);
        
        if (allTemplates.length > 0) {
          // Try first to find one with isDefault = true, then fallback to first template
          const defaultTemplate = allTemplates.find(t => t.isDefault === true) || allTemplates[0];
          
          console.log(`Using fallback template: ${defaultTemplate.name} with ID: ${defaultTemplate.id}`);
          
          // Process fields if it's a string
          if (defaultTemplate.fields && typeof defaultTemplate.fields === 'string') {
            try {
              const parsedFields = JSON.parse(defaultTemplate.fields);
              console.log(`Successfully parsed ${parsedFields.length} fields`);
              defaultTemplate.fields = parsedFields;
            } catch (error) {
              console.error('Error parsing template fields:', error);
            }
          }
          
          return defaultTemplate;
        }
      }
      
      console.log('No templates found at all');
      return undefined;
    } catch (error) {
      console.error('Error getting default template:', error);
      return undefined;
    }
  }
  
  async createPdfTemplate(templateData: InsertPdfTemplate): Promise<PdfTemplate> {
    try {
      console.log('Creating PDF template with data:', templateData);
      
      // If setting as default, update all other templates to not be default
      if (templateData.isDefault) {
        await db.execute(sql`UPDATE pdf_templates SET is_default = false`);
      }
      
      // Ensure fields is always an array (start with empty array for new templates)
      let fieldsToStore = templateData.fields || [];
      if (typeof fieldsToStore === 'string') {
        try {
          fieldsToStore = JSON.parse(fieldsToStore);
        } catch {
          fieldsToStore = [];
        }
      }
      
      // Convert fields to JSON string for storage
      const fieldsJson = JSON.stringify(fieldsToStore);
      const isDefault = templateData.isDefault || false;
      const templateName = templateData.name || 'Untitled Template';
      
      console.log('Inserting template:', {
        name: templateName,
        fields: fieldsJson,
        is_default: isDefault
      });
      
      // Use parameterized query for safety
      const result = await db.execute(sql`
        INSERT INTO pdf_templates (name, fields, is_default) 
        VALUES (${templateName}, ${fieldsJson}, ${isDefault})
        RETURNING *
      `);
      
      console.log('Insert result:', result);
      
      if (result.rows.length > 0) {
        const template = result.rows[0] as PdfTemplate;
        console.log('Template created successfully:', template);
        return template;
      }
      
      throw new Error('Failed to create PDF template - no rows returned');
    } catch (error) {
      console.error('Error creating PDF template:', error);
      console.error('Template data:', templateData);
      throw new Error(`Failed to create PDF template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async updatePdfTemplate(id: number, templateData: Partial<InsertPdfTemplate>): Promise<PdfTemplate | undefined> {
    try {
      // If setting as default, update all other templates to not be default
      if (templateData.isDefault) {
        await db.execute(sql`UPDATE pdf_templates SET is_default = false`);
      }
      
      // Process fields to ensure it's a string for storage
      let processedFields = templateData.fields;
      if (templateData.fields !== undefined && typeof templateData.fields === 'object') {
        processedFields = JSON.stringify(templateData.fields);
      }
      
      // Build update object, handling column name mapping
      const updateData: any = {};
      
      if (templateData.name !== undefined) {
        updateData.name = templateData.name;
      }
      
      if (processedFields !== undefined) {
        updateData.fields = processedFields;
      }
      
      if (templateData.isDefault !== undefined) {
        updateData.is_default = templateData.isDefault;
      }
      
      // Always update timestamp
      updateData.updated_at = new Date();
      
      console.log('Updating template with processed data:', {
        id,
        name: templateData.name,
        isDefault: templateData.isDefault,
        fields: typeof processedFields === 'string' ? 'JSON string' : processedFields,
        updatedBy: templateData.updatedBy
      });
      
      // Build dynamic SQL using Drizzle's sql template
      const setClauses = [];
      
      if (updateData.name !== undefined) {
        setClauses.push(sql`name = ${updateData.name}`);
      }
      
      if (updateData.fields !== undefined) {
        setClauses.push(sql`fields = ${updateData.fields}`);
      }
      
      if (updateData.is_default !== undefined) {
        setClauses.push(sql`is_default = ${updateData.is_default}`);
      }
      
      // Always update timestamp
      setClauses.push(sql`updated_at = ${updateData.updated_at}`);
      
      if (setClauses.length === 0) {
        console.log('No fields to update');
        return undefined;
      }
      
      console.log('Updating template with ID:', id);
      console.log('Update data:', updateData);
      
      // Use proper Drizzle SQL template syntax
      const result = await db.execute(sql`
        UPDATE pdf_templates 
        SET ${sql.join(setClauses, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length > 0) {
        console.log('Template updated successfully:', result.rows[0]);
        return result.rows[0] as PdfTemplate;
      }
      
      console.log('Template not found for update');
      return undefined;
    } catch (error) {
      console.error('Error updating PDF template:', error);
      return undefined;
    }
  }
  
  async deletePdfTemplate(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(pdfTemplates)
      .where(eq(pdfTemplates.id, id))
      .returning();
    
    return !!deleted;
  }
  
  // Custom Notifications methods
  async getAllCustomNotifications(): Promise<CustomNotification[]> {
    return await db
      .select()
      .from(customNotifications)
      .orderBy(desc(customNotifications.createdAt));
  }
  
  async getCustomNotification(id: number): Promise<CustomNotification | undefined> {
    const [notification] = await db
      .select()
      .from(customNotifications)
      .where(eq(customNotifications.id, id));
    
    return notification || undefined;
  }
  
  async getUnreadCustomNotifications(): Promise<CustomNotification[]> {
    return await db
      .select()
      .from(customNotifications)
      .where(eq(customNotifications.isRead, false))
      .orderBy(desc(customNotifications.createdAt));
  }
  
  async getCustomNotificationsByType(type: string): Promise<CustomNotification[]> {
    return await db
      .select()
      .from(customNotifications)
      .where(eq(customNotifications.type, type))
      .orderBy(desc(customNotifications.createdAt));
  }
  
  async getCustomNotificationsByUser(userId: number): Promise<CustomNotification[]> {
    return await db
      .select()
      .from(customNotifications)
      .where(eq(customNotifications.userId, userId))
      .orderBy(desc(customNotifications.createdAt));
  }
  
  async createCustomNotification(notificationData: InsertCustomNotification): Promise<CustomNotification> {
    const [notification] = await db
      .insert(customNotifications)
      .values(notificationData)
      .returning();
    
    return notification;
  }
  
  async updateCustomNotification(id: number, notificationData: Partial<InsertCustomNotification>): Promise<CustomNotification | undefined> {
    const [updatedNotification] = await db
      .update(customNotifications)
      .set(notificationData)
      .where(eq(customNotifications.id, id))
      .returning();
    
    return updatedNotification || undefined;
  }
  
  async markCustomNotificationAsRead(id: number): Promise<boolean> {
    const result = await db
      .update(customNotifications)
      .set({ isRead: true })
      .where(eq(customNotifications.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async markCustomNotificationAsUnread(id: number): Promise<boolean> {
    const result = await db
      .update(customNotifications)
      .set({ isRead: false })
      .where(eq(customNotifications.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteCustomNotification(id: number): Promise<boolean> {
    const result = await db
      .delete(customNotifications)
      .where(eq(customNotifications.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Backup Settings methods
  async getBackupSettings(): Promise<BackupSettings | undefined> {
    const [settings] = await db.select().from(backupSettings);
    return settings || undefined;
  }
  
  async createBackupSettings(settings: InsertBackupSettings): Promise<BackupSettings> {
    const [newSettings] = await db.insert(backupSettings).values(settings).returning();
    return newSettings;
  }
  
  async updateBackupSettings(id: number, settingsData: Partial<InsertBackupSettings>): Promise<BackupSettings | undefined> {
    const [updatedSettings] = await db
      .update(backupSettings)
      .set(settingsData)
      .where(eq(backupSettings.id, id))
      .returning();
    
    return updatedSettings || undefined;
  }

  // Placeholder spare vehicle methods (Missing implementations)
  async getPlaceholderReservations(startDate?: string, endDate?: string): Promise<Reservation[]> {
    const conditions = [
      eq(reservations.placeholderSpare, true),
      eq(reservations.type, 'replacement'),
      sql`${reservations.vehicleId} IS NULL`
    ];

    if (startDate) {
      conditions.push(gte(reservations.startDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(reservations.startDate, endDate));
    }

    return await db
      .select()
      .from(reservations)
      .where(and(...conditions));
  }

  async getPlaceholderReservationsNeedingAssignment(daysAhead: number = 7): Promise<Reservation[]> {
    const cutoffDate = addDays(new Date(), daysAhead);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    const results = await db
      .select({
        id: reservations.id,
        vehicleId: reservations.vehicleId,
        customerId: reservations.customerId,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
        status: reservations.status,
        type: reservations.type,
        placeholderSpare: reservations.placeholderSpare,
        replacementForReservationId: reservations.replacementForReservationId,
        customer: customers,
      })
      .from(reservations)
      .leftJoin(customers, eq(reservations.customerId, customers.id))
      .where(
        and(
          eq(reservations.placeholderSpare, true),
          eq(reservations.type, 'replacement'),
          sql`${reservations.vehicleId} IS NULL`,
          lte(reservations.startDate, cutoffDateString)
        )
      );
    
    return results as any;
  }

  async createPlaceholderReservation(originalReservationId: number, customerId: number, startDate: string, endDate?: string): Promise<Reservation> {
    // Verify the original reservation exists
    const [originalReservation] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, originalReservationId));
    
    if (!originalReservation) {
      throw new Error('Original reservation not found');
    }

    // Check for duplicate placeholder
    const [duplicate] = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.replacementForReservationId, originalReservationId),
          eq(reservations.placeholderSpare, true)
        )
      );

    if (duplicate) {
      throw new Error('A placeholder spare reservation already exists for this original reservation');
    }

    const placeholderData: InsertReservation = {
      vehicleId: null,
      customerId,
      startDate,
      endDate: endDate || null,
      status: 'pending',
      type: 'replacement',
      replacementForReservationId: originalReservationId,
      placeholderSpare: true,
      notes: `TBD spare vehicle for reservation #${originalReservationId}`,
      totalPrice: null,
      damageCheckPath: null
    };

    const [placeholder] = await db
      .insert(reservations)
      .values(placeholderData)
      .returning();

    // Create notification for pending spare assignment
    await this.createCustomNotification({
      title: "Spare Vehicle Assignment Required",
      description: `TBD spare vehicle needs assignment for ${startDate}${endDate ? ` - ${endDate}` : ''}`,
      date: startDate,
      type: "spare_assignment",
      isRead: false,
      link: "/dashboard",
      icon: "Car",
      priority: "high",
      userId: null // System-wide notification
    });

    return placeholder;
  }

  async assignVehicleToPlaceholder(reservationId: number, vehicleId: number, endDate?: string): Promise<Reservation | undefined> {
    // Get the placeholder reservation
    const [reservation] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId));

    if (!reservation || !reservation.placeholderSpare || reservation.vehicleId != null || reservation.type !== 'replacement') {
      return undefined;
    }

    // Verify the target vehicle exists
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId));

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Check if vehicle is available (not in service)
    if (vehicle.maintenanceStatus === 'in_service') {
      throw new Error('Vehicle is currently in service and not available');
    }

    // For open-ended placeholders, require an explicit endDate for assignment
    const assignmentEndDate = endDate || reservation.endDate;
    if (!assignmentEndDate && !reservation.endDate) {
      throw new Error('End date must be specified when assigning vehicle to open-ended placeholder reservation');
    }

    // Check for conflicts with the new vehicle assignment
    const conflicts = await this.checkReservationConflicts(
      vehicleId,
      reservation.startDate,
      assignmentEndDate || reservation.startDate,
      reservationId
    );

    if (conflicts.length > 0) {
      throw new Error('Vehicle has conflicting reservations during the assignment period');
    }

    // Assign the vehicle to the placeholder
    const [updatedReservation] = await db
      .update(reservations)
      .set({
        vehicleId,
        endDate: assignmentEndDate,
        placeholderSpare: false,
        notes: `Spare vehicle ${vehicle.licensePlate} (${vehicle.brand} ${vehicle.model}) assigned for reservation #${reservation.replacementForReservationId}`,
        updatedAt: new Date()
      })
      .where(eq(reservations.id, reservationId))
      .returning();

    // Mark related notifications as read when assignment is complete
    await db
      .update(customNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(customNotifications.type, "spare_assignment"),
          eq(customNotifications.date, reservation.startDate),
          eq(customNotifications.isRead, false)
        )
      );

    return updatedReservation || undefined;
  }

  // Other missing spare vehicle methods
  async getAvailableVehiclesInRange(startDate: string, endDate: string, excludeVehicleId?: number): Promise<Vehicle[]> {
    // Get all vehicles
    let vehicleQuery = db.select().from(vehicles);

    if (excludeVehicleId) {
      vehicleQuery = vehicleQuery.where(not(eq(vehicles.id, excludeVehicleId)));
    }

    const allVehicles = await vehicleQuery;

    // Get conflicting reservations in the date range
    const conflictingReservations = await db
      .select()
      .from(reservations)
      .where(
        and(
          not(eq(reservations.status, 'cancelled')),
          sql`${reservations.vehicleId} IS NOT NULL`,
          or(
            and(
              lte(reservations.startDate, endDate),
              gte(reservations.endDate, startDate)
            ),
            and(
              lte(reservations.startDate, endDate),
              sql`${reservations.endDate} IS NULL`
            )
          )
        )
      );

    const unavailableVehicleIds = new Set(
      conflictingReservations.map(r => r.vehicleId).filter(id => id !== null)
    );

    return allVehicles.filter(vehicle => 
      !unavailableVehicleIds.has(vehicle.id) && 
      vehicle.maintenanceStatus !== 'in_service'
    );
  }

  async getActiveReplacementByOriginal(originalReservationId: number): Promise<Reservation | undefined> {
    const [replacement] = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.replacementForReservationId, originalReservationId),
          eq(reservations.type, 'replacement'),
          not(eq(reservations.status, 'cancelled'))
        )
      );
    
    return replacement || undefined;
  }

  async createReplacementReservation(originalReservationId: number, spareVehicleId: number, startDate: string, endDate?: string): Promise<Reservation> {
    const [original] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, originalReservationId));
      
    if (!original) {
      throw new Error('Original reservation not found');
    }

    // Ensure spare vehicle is not the same as original
    if (spareVehicleId === original.vehicleId) {
      throw new Error('Spare vehicle cannot be the same as original vehicle');
    }

    // Get vehicle details for meaningful notes
    const [originalVehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, original.vehicleId!));

    const [spareVehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, spareVehicleId));

    const finalEndDate = endDate || original.endDate;

    // Check for conflicts on the spare vehicle
    const conflicts = await this.checkReservationConflicts(spareVehicleId, startDate, finalEndDate || startDate, null);
    if (conflicts.length > 0) {
      throw new Error('Spare vehicle has conflicting reservations');
    }

    const originalVehicleInfo = originalVehicle 
      ? `${originalVehicle.licensePlate} (${originalVehicle.brand} ${originalVehicle.model})`
      : `Vehicle ID ${original.vehicleId}`;
    const spareVehicleInfo = spareVehicle 
      ? `${spareVehicle.licensePlate} (${spareVehicle.brand} ${spareVehicle.model})`
      : `Vehicle ID ${spareVehicleId}`;

    const replacementData: InsertReservation = {
      vehicleId: spareVehicleId,
      customerId: original.customerId,
      startDate,
      endDate: finalEndDate,
      status: new Date(startDate) <= new Date() ? 'active' : 'pending',
      type: 'replacement',
      replacementForReservationId: originalReservationId,
      placeholderSpare: false,
      totalPrice: null,
      notes: `Spare vehicle ${spareVehicleInfo} for reservation #${originalReservationId}`,
      damageCheckPath: null
    };

    const [replacement] = await db
      .insert(reservations)
      .values(replacementData)
      .returning();

    return replacement;
  }

  async updateLegacyNotesWithVehicleDetails(): Promise<number> {
    // This is a maintenance method - for DatabaseStorage, return 0 as no legacy data to update
    return 0;
  }

  async closeReplacementReservation(replacementReservationId: number, endDate: string): Promise<Reservation | undefined> {
    const [updatedReservation] = await db
      .update(reservations)
      .set({
        endDate,
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(reservations.id, replacementReservationId))
      .returning();

    return updatedReservation || undefined;
  }

  async markVehicleForService(vehicleId: number, maintenanceStatus: string, maintenanceNote?: string): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await db
      .update(vehicles)
      .set({
        maintenanceStatus,
        maintenanceNote: maintenanceNote || null,
        updatedAt: new Date()
      })
      .where(eq(vehicles.id, vehicleId))
      .returning();

    return updatedVehicle || undefined;
  }

  async createMaintenanceBlock(vehicleId: number, startDate: string, endDate?: string): Promise<Reservation> {
    const maintenanceData: InsertReservation = {
      vehicleId,
      customerId: null,
      startDate,
      endDate: endDate || null,
      status: 'active',
      type: 'maintenance_block',
      replacementForReservationId: null,
      placeholderSpare: false,
      totalPrice: null,
      notes: 'Vehicle maintenance block',
      damageCheckPath: null
    };

    const [maintenanceBlock] = await db
      .insert(reservations)
      .values(maintenanceData)
      .returning();

    return maintenanceBlock;
  }

  async closeMaintenanceBlock(blockReservationId: number, endDate: string): Promise<Reservation | undefined> {
    const [updatedBlock] = await db
      .update(reservations)
      .set({
        endDate,
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(reservations.id, blockReservationId))
      .returning();

    return updatedBlock || undefined;
  }

  // App Settings methods
  async getAllAppSettings(): Promise<AppSettings[]> {
    return await db.select().from(appSettings).orderBy(appSettings.category, appSettings.key);
  }

  async getAppSetting(id: number): Promise<AppSettings | undefined> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.id, id));
    return setting || undefined;
  }

  async getAppSettingByKey(key: string): Promise<AppSettings | undefined> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting || undefined;
  }

  async getAppSettingsByCategory(category: string): Promise<AppSettings[]> {
    return await db.select().from(appSettings).where(eq(appSettings.category, category)).orderBy(appSettings.key);
  }

  async createAppSetting(insertSetting: InsertAppSettings): Promise<AppSettings> {
    const [setting] = await db.insert(appSettings).values(insertSetting).returning();
    return setting;
  }

  async updateAppSetting(id: number, settingData: Partial<InsertAppSettings>): Promise<AppSettings | undefined> {
    const updateData = {
      ...settingData,
      updatedAt: new Date()
    };
    
    const [updatedSetting] = await db
      .update(appSettings)
      .set(updateData)
      .where(eq(appSettings.id, id))
      .returning();
      
    return updatedSetting || undefined;
  }

  async deleteAppSetting(id: number): Promise<boolean> {
    const result = await db.delete(appSettings).where(eq(appSettings.id, id));
    return result.rowCount > 0;
  }
}
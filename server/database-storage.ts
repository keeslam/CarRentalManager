import { 
  users, type User, type InsertUser,
  vehicles, type Vehicle, type InsertVehicle,
  customers, type Customer, type InsertCustomer,
  reservations, type Reservation, type InsertReservation,
  expenses, type Expense, type InsertExpense,
  documents, type Document, type InsertDocument
} from "@shared/schema";
import { addMonths, parseISO, isBefore, isAfter, isEqual } from "date-fns";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, inArray, not } from "drizzle-orm";
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

  // Vehicle methods
  async getAllVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles);
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
    const [updatedVehicle] = await db
      .update(vehicles)
      .set(vehicleData)
      .where(eq(vehicles.id, id))
      .returning();
    
    return updatedVehicle || undefined;
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
  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
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

  // Reservation methods
  async getAllReservations(): Promise<Reservation[]> {
    const reservationsData = await db.select().from(reservations);
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
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
    
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

  async getReservationsInDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const reservationsData = await db
      .select()
      .from(reservations)
      .where(
        sql`(${reservations.startDate} <= ${endDate} AND ${reservations.endDate} >= ${startDate})
            OR (${reservations.startDate} >= ${startDate} AND ${reservations.startDate} <= ${endDate})
            OR (${reservations.endDate} >= ${startDate} AND ${reservations.endDate} <= ${endDate})`
      );
    
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
      .where(eq(reservations.vehicleId, vehicleId))
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
      .where(eq(reservations.customerId, customerId))
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
    endDate: string, 
    excludeReservationId: number | null
  ): Promise<Reservation[]> {
    let query = db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.vehicleId, vehicleId),
          sql`${reservations.status} != 'cancelled'`,
          sql`(${reservations.startDate} <= ${endDate} AND ${reservations.endDate} >= ${startDate})`
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
            sql`(${reservations.startDate} <= ${endDate} AND ${reservations.endDate} >= ${startDate})`,
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
    const [expense] = await db.insert(expenses).values(expenseData).returning();
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, expense.vehicleId));
    
    return {
      ...expense,
      vehicle
    };
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updatedExpense] = await db
      .update(expenses)
      .set(expenseData)
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
      .orderBy(desc(expenses.date))
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
}
import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  licensePlate: text("license_plate").notNull().unique(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  vehicleType: text("vehicle_type"),
  chassisNumber: text("chassis_number"),
  fuel: text("fuel"),
  euroZone: text("euro_zone"),
  apkDate: text("apk_date"),
  warrantyDate: text("warranty_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Customers table
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country").default("Nederland"),
  driverLicenseNumber: text("driver_license_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Reservations table
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  customerId: integer("customer_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").default("pending").notNull(),
  totalPrice: numeric("total_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: text("content_type").notNull(),
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
  notes: text("notes"),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadDate: true,
});

// Define types for each model
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Reservation = typeof reservations.$inferSelect & {
  vehicle?: Vehicle;
  customer?: Customer;
};
export type InsertReservation = z.infer<typeof insertReservationSchema>;

export type Expense = typeof expenses.$inferSelect & {
  vehicle?: Vehicle;
};
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

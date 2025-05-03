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
  adBlue: boolean("ad_blue"),
  euroZone: text("euro_zone"),
  euroZoneEndDate: text("euro_zone_end_date"),
  internalAppointments: text("internal_appointments"),
  apkDate: text("apk_date"),
  company: text("company"),
  companyDate: text("company_date"),
  registeredTo: text("registered_to"),
  registeredToDate: text("registered_to_date"),
  gps: boolean("gps"),
  monthlyPrice: numeric("monthly_price"),
  dailyPrice: numeric("daily_price"),
  dateIn: text("date_in"),
  dateOut: text("date_out"),
  contractNumber: text("contract_number"),
  damageCheck: boolean("damage_check"),
  damageCheckDate: text("damage_check_date"),
  damageCheckAttachment: text("damage_check_attachment"),
  damageCheckAttachmentDate: text("damage_check_attachment_date"),
  creationDate: text("creation_date"),
  createdBy: text("created_by"),
  departureMileage: integer("departure_mileage"),
  returnMileage: integer("return_mileage"),
  roadsideAssistance: boolean("roadside_assistance"),
  spareKey: boolean("spare_key"),
  remarks: text("remarks"),
  winterTires: boolean("winter_tires"),
  tireSize: text("tire_size"),
  wokNotification: boolean("wok_notification"),
  radioCode: text("radio_code"),
  warrantyEndDate: text("warranty_end_date"),
  seatcovers: boolean("seatcovers"),
  backupbeepers: boolean("backupbeepers"),
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
  debtorNumber: text("debtor_number"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  driverName: text("driver_name"),
  contactPerson: text("contact_person"),
  
  // Communication
  email: text("email"),
  emailForMOT: text("email_for_mot"), // For APK inspection
  emailForInvoices: text("email_for_invoices"),
  emailGeneral: text("email_general"),
  phone: text("phone"),
  driverPhone: text("driver_phone"),
  
  // Address
  streetName: text("street_name"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country").default("Nederland"),
  
  // Identification
  driverLicenseNumber: text("driver_license_number"),
  chamberOfCommerceNumber: text("chamber_of_commerce_number"), // CoC
  rsin: text("rsin"), // Legal Entity Identification Number
  vatNumber: text("vat_number"),
  
  // Status
  status: text("status"),
  statusDate: text("status_date"),
  
  // Notes
  notes: text("notes"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdByUser: integer("created_by_user_id").references(() => users.id),
  updatedByUser: integer("updated_by_user_id").references(() => users.id),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: true,
  updatedByUser: true,
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
  damageCheckPath: text("damage_check_path"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdByUser: integer("created_by_user_id").references(() => users.id),
  updatedByUser: integer("updated_by_user_id").references(() => users.id),
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: true,
  updatedByUser: true,
})
.extend({
  totalPrice: z.number().optional().or(z.string().transform(val => Number(val) || 0))
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
  receiptFile: text("receipt_file"), // Stores the file name
  receiptFilePath: text("receipt_file_path"), // Stores the path to the file
  receiptFileSize: integer("receipt_file_size"), // Stores the file size
  receiptContentType: text("receipt_content_type"), // Stores the file content type
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdByUser: integer("created_by_user_id").references(() => users.id),
  updatedByUser: integer("updated_by_user_id").references(() => users.id),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: true,
  updatedByUser: true,
}).extend({
  amount: z.union([
    z.number(),
    z.string().transform(val => parseFloat(val) || 0)
  ]),
  receiptPath: z.string().nullable().optional(),
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
  
  // Tracking
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdByUser: integer("created_by_user_id").references(() => users.id),
  updatedByUser: integer("updated_by_user_id").references(() => users.id),
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

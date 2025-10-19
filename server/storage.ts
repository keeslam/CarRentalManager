import { 
  users, type User, type InsertUser,
  vehicles, type Vehicle, type InsertVehicle,
  customers, type Customer, type InsertCustomer,
  reservations, type Reservation, type InsertReservation,
  expenses, type Expense, type InsertExpense,
  documents, type Document, type InsertDocument,
  pdfTemplates, type PdfTemplate, type InsertPdfTemplate,
  customNotifications, type CustomNotification, type InsertCustomNotification,
  appSettings, type AppSettings, type InsertAppSettings,
  drivers, type Driver, type InsertDriver,
  savedReports, type SavedReport, type InsertSavedReport,
  damageCheckTemplates, type DamageCheckTemplate, type InsertDamageCheckTemplate
} from "../shared/schema";
import { addMonths, addDays, parseISO, isBefore, isAfter, isEqual } from "date-fns";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<boolean>;
  deleteUser(id: number): Promise<boolean>;
  
  // Vehicle methods
  getAllVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicleData: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  getAvailableVehicles(): Promise<Vehicle[]>;
  getVehiclesWithApkExpiringSoon(): Promise<Vehicle[]>;
  getVehiclesWithWarrantyExpiringSoon(): Promise<Vehicle[]>;
  
  // Customer methods
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  
  // Reservation methods
  getAllReservations(): Promise<Reservation[]>;
  getReservation(id: number): Promise<Reservation | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, reservationData: Partial<InsertReservation>): Promise<Reservation | undefined>;
  deleteReservation(id: number): Promise<boolean>;
  getReservationsInDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  getUpcomingReservations(): Promise<Reservation[]>;
  getUpcomingMaintenanceReservations(): Promise<Reservation[]>;
  getReservationsByVehicle(vehicleId: number): Promise<Reservation[]>;
  getReservationsByCustomer(customerId: number): Promise<Reservation[]>;
  checkReservationConflicts(vehicleId: number, startDate: string, endDate: string, excludeReservationId: number | null, isMaintenanceBlock?: boolean): Promise<Reservation[]>;
  
  // Spare vehicle management methods
  getAvailableVehiclesInRange(startDate: string, endDate: string, excludeVehicleId?: number): Promise<Vehicle[]>;
  getActiveReplacementByOriginal(originalReservationId: number): Promise<Reservation | undefined>;
  createReplacementReservation(originalReservationId: number, spareVehicleId: number, startDate: string, endDate?: string): Promise<Reservation>;
  updateLegacyNotesWithVehicleDetails(): Promise<number>;
  closeReplacementReservation(replacementReservationId: number, endDate: string): Promise<Reservation | undefined>;
  markVehicleForService(vehicleId: number, maintenanceStatus: string, maintenanceNote?: string): Promise<Vehicle | undefined>;
  createMaintenanceBlock(vehicleId: number, startDate: string, endDate?: string): Promise<Reservation>;
  closeMaintenanceBlock(blockReservationId: number, endDate: string): Promise<Reservation | undefined>;
  
  // Placeholder spare vehicle methods
  getPlaceholderReservations(startDate?: string, endDate?: string): Promise<Reservation[]>;
  getPlaceholderReservationsNeedingAssignment(daysAhead?: number): Promise<Reservation[]>;
  assignVehicleToPlaceholder(reservationId: number, vehicleId: number, endDate?: string): Promise<Reservation | undefined>;
  createPlaceholderReservation(originalReservationId: number, customerId: number, startDate: string, endDate?: string): Promise<Reservation>;
  
  // Expense methods
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<Expense | undefined>;
  getExpensesByVehicle(vehicleId: number): Promise<Expense[]>;
  getRecentExpenses(limit: number): Promise<Expense[]>;
  deleteExpense(id: number): Promise<boolean>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined>;
  getDocumentsByVehicle(vehicleId: number): Promise<Document[]>;
  getDocumentsByReservation(reservationId: number): Promise<Document[]>;
  deleteDocument(id: number): Promise<boolean>;
  
  // PDF Template methods
  getAllPdfTemplates(): Promise<PdfTemplate[]>;
  getPdfTemplate(id: number): Promise<PdfTemplate | undefined>;
  getDefaultPdfTemplate(): Promise<PdfTemplate | undefined>;
  createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate>;
  updatePdfTemplate(id: number, templateData: Partial<InsertPdfTemplate>): Promise<PdfTemplate | undefined>;
  deletePdfTemplate(id: number): Promise<boolean>;
  
  // Custom Notification methods
  getAllCustomNotifications(): Promise<CustomNotification[]>;
  getCustomNotification(id: number): Promise<CustomNotification | undefined>;
  getUnreadCustomNotifications(): Promise<CustomNotification[]>;
  getCustomNotificationsByType(type: string): Promise<CustomNotification[]>;
  getCustomNotificationsByUser(userId: number): Promise<CustomNotification[]>;
  createCustomNotification(notification: InsertCustomNotification): Promise<CustomNotification>;
  updateCustomNotification(id: number, notificationData: Partial<InsertCustomNotification>): Promise<CustomNotification | undefined>;
  markCustomNotificationAsRead(id: number): Promise<boolean>;
  deleteCustomNotification(id: number): Promise<boolean>;
  
  // App Settings methods
  getAllAppSettings(): Promise<AppSettings[]>;
  getAppSetting(id: number): Promise<AppSettings | undefined>;
  getAppSettingByKey(key: string): Promise<AppSettings | undefined>;
  getAppSettingsByCategory(category: string): Promise<AppSettings[]>;
  createAppSetting(setting: InsertAppSettings): Promise<AppSettings>;
  updateAppSetting(id: number, settingData: Partial<InsertAppSettings>): Promise<AppSettings | undefined>;
  deleteAppSetting(id: number): Promise<boolean>;
  
  // Driver methods
  getAllDrivers(): Promise<Driver[]>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDriversByCustomer(customerId: number): Promise<Driver[]>;
  getActiveDriversByCustomer(customerId: number): Promise<Driver[]>;
  getPrimaryDriverByCustomer(customerId: number): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: number, driverData: Partial<InsertDriver>): Promise<Driver | undefined>;
  deleteDriver(id: number): Promise<boolean>;
  
  // Saved Reports methods
  getAllSavedReports(): Promise<any[]>;
  getSavedReport(id: number): Promise<any | undefined>;
  createSavedReport(report: any): Promise<any>;
  deleteSavedReport(id: number): Promise<boolean>;
  executeReport(configuration: any): Promise<any[]>;
  
  // WhatsApp Messages methods
  getAllWhatsAppMessages(): Promise<any[]>;
  getWhatsAppMessage(id: number): Promise<any | undefined>;
  getWhatsAppMessagesByCustomer(customerId: number): Promise<any[]>;
  createWhatsAppMessage(message: any): Promise<any>;
  updateWhatsAppMessage(id: number, messageData: any): Promise<any | undefined>;
  
  // Damage Check Template methods
  getAllDamageCheckTemplates(): Promise<any[]>;
  getDamageCheckTemplate(id: number): Promise<any | undefined>;
  getDamageCheckTemplatesByVehicle(make?: string, model?: string, type?: string): Promise<any[]>;
  getDefaultDamageCheckTemplate(): Promise<any | undefined>;
  createDamageCheckTemplate(template: any): Promise<any>;
  updateDamageCheckTemplate(id: number, templateData: any): Promise<any | undefined>;
  deleteDamageCheckTemplate(id: number): Promise<boolean>;
  
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private vehicles: Map<number, Vehicle>;
  private customers: Map<number, Customer>;
  private reservations: Map<number, Reservation>;
  private expenses: Map<number, Expense>;
  private documents: Map<number, Document>;
  private pdfTemplates: Map<number, PdfTemplate>;
  private customNotifications: Map<number, CustomNotification>;
  
  private userId: number;
  private vehicleId: number;
  private customerId: number;
  private reservationId: number;
  private expenseId: number;
  private documentId: number;
  private pdfTemplateId: number;
  private customNotificationId: number;

  constructor() {
    this.users = new Map();
    this.vehicles = new Map();
    this.customers = new Map();
    this.reservations = new Map();
    this.expenses = new Map();
    this.documents = new Map();
    this.pdfTemplates = new Map();
    this.customNotifications = new Map();
    
    this.userId = 1;
    this.vehicleId = 1;
    this.customerId = 1;
    this.reservationId = 1;
    this.expenseId = 1;
    this.documentId = 1;
    this.pdfTemplateId = 1;
    this.customNotificationId = 1;
    
    // Initialize with sample data for demo
    this.initializeSampleData();
    
    // Debug log users (without sensitive data)
    console.log("Sample users initialized:");
    for (const user of this.users.values()) {
      console.log(`User ${user.id}: username=${user.username}, role=${user.role}`);
    }
  }

  private initializeSampleData() {
    // Create sample admin user
    this.createUser({
      username: "admin",
      password: "password", // Plain text password for development purposes only
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
      permissions: ["manage_users", "manage_vehicles", "manage_customers", "manage_reservations", "manage_expenses", "manage_documents", "view_dashboard"],
      active: true
    });

    // Create a regular user
    this.createUser({
      username: "user",
      password: "password", // Plain text password for development purposes only
      fullName: "Regular User",
      email: "user@example.com",
      role: "user",
      permissions: ["view_dashboard"],
      active: true
    });
    
    // Sample vehicles
    this.createVehicle({
      licensePlate: "AB-123-C",
      brand: "Volkswagen",
      model: "Golf",
      vehicleType: "Hatchback",
      chassisNumber: "WVW123456789",
      fuel: "Gasoline",
      euroZone: "Euro 6",
      apkDate: "2024-05-15",
      warrantyEndDate: "2024-07-10"
    });
    
    this.createVehicle({
      licensePlate: "XY-789-Z",
      brand: "Toyota",
      model: "Corolla",
      vehicleType: "Sedan",
      chassisNumber: "JTD987654321",
      fuel: "Hybrid",
      euroZone: "Euro 6",
      apkDate: "2024-03-01",
      warrantyEndDate: "2024-04-15"
    });
    
    this.createVehicle({
      licensePlate: "TR-567-P",
      brand: "Ford",
      model: "Focus",
      vehicleType: "Sedan",
      chassisNumber: "WF0123456789",
      fuel: "Diesel",
      euroZone: "Euro 5",
      apkDate: "2024-04-20",
      warrantyEndDate: "2024-06-30"
    });
    
    // Sample customers
    this.createCustomer({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "0612345678",
      address: "Kerkweg 1",
      city: "Amsterdam",
      postalCode: "1234 AB",
      country: "Nederland",
      driverLicenseNumber: "12345678"
    });
    
    this.createCustomer({
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "0687654321",
      address: "Hoofdstraat 10",
      city: "Rotterdam",
      postalCode: "3000 XY",
      country: "Nederland",
      driverLicenseNumber: "87654321"
    });
    
    // Sample reservations
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 7);
    
    const nextDay = new Date();
    nextDay.setDate(today.getDate() + 1);
    
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);
    
    this.createReservation({
      vehicleId: 1,
      customerId: 1,
      startDate: today.toISOString().split('T')[0],
      endDate: nextDay.toISOString().split('T')[0],
      status: "confirmed",
      totalPrice: 120,
      notes: "Sample reservation"
    });
    
    this.createReservation({
      vehicleId: 2,
      customerId: 2,
      startDate: weekLater.toISOString().split('T')[0],
      endDate: nextMonth.toISOString().split('T')[0],
      status: "pending",
      totalPrice: 1200,
      notes: "Long-term rental"
    });
    
    // Sample expenses
    this.createExpense({
      vehicleId: 1,
      category: "Maintenance",
      amount: 150,
      date: "2024-01-15",
      description: "Oil change and filter replacement"
    });
    
    this.createExpense({
      vehicleId: 2,
      category: "Tires",
      amount: 320,
      date: "2024-01-05",
      description: "New winter tires"
    });
    
    this.createExpense({
      vehicleId: 3,
      category: "Repair",
      amount: 450,
      date: "2024-01-10",
      description: "Brake system repair"
    });
    
    // Sample documents
    this.createDocument({
      vehicleId: 1,
      documentType: "APK Inspection",
      fileName: "apk_report_2023.pdf",
      filePath: "/uploads/1/APK Inspection/apk_report_2023.pdf",
      fileSize: 250000,
      contentType: "application/pdf",
      notes: "Annual APK inspection report"
    });
    
    this.createDocument({
      vehicleId: 2,
      documentType: "Insurance",
      fileName: "insurance_policy.pdf",
      filePath: "/uploads/2/Insurance/insurance_policy.pdf",
      fileSize: 180000,
      contentType: "application/pdf",
      notes: "Vehicle insurance policy"
    });
    
    // Sample PDF template
    this.createPdfTemplate({
      name: "Default Contract Template",
      isDefault: true,
      fields: JSON.stringify([
        {
          id: "1",
          name: "Customer Name",
          x: 100,
          y: 150,
          fontSize: 12,
          isBold: true,
          source: "customer.name"
        },
        {
          id: "2",
          name: "Vehicle",
          x: 100,
          y: 180,
          fontSize: 12,
          isBold: true,
          source: "vehicle.brand"
        },
        {
          id: "3",
          name: "License Plate",
          x: 100,
          y: 210,
          fontSize: 12,
          isBold: false,
          source: "vehicle.licensePlate"
        },
        {
          id: "4",
          name: "Start Date",
          x: 350,
          y: 150,
          fontSize: 12,
          isBold: false,
          source: "startDate"
        },
        {
          id: "5",
          name: "End Date",
          x: 350,
          y: 180,
          fontSize: 12,
          isBold: false,
          source: "endDate"
        }
      ])
    });
    
    // Sample custom notifications
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    this.createCustomNotification({
      title: "Team Meeting",
      description: "Team meeting to discuss new vehicle arrivals",
      date: tomorrow.toISOString().split('T')[0],
      type: "custom",
      isRead: false,
      icon: "CalendarDays",
      link: "/dashboard",
      priority: "high",
      userId: 1
    });
    
    const inventoryDate = new Date();
    inventoryDate.setDate(inventoryDate.getDate() + 7);
    
    this.createCustomNotification({
      title: "Inventory Check",
      description: "Perform monthly inventory check of all vehicles",
      date: inventoryDate.toISOString().split('T')[0],
      type: "custom",
      isRead: false,
      icon: "ClipboardCheck",
      link: "/vehicles",
      priority: "normal",
      userId: 1
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      fullName: insertUser.fullName ?? null,
      email: insertUser.email ?? null,
      role: insertUser.role ?? 'user',
      permissions: insertUser.permissions ?? [],
      active: insertUser.active ?? true,
      createdAt: now,
      updatedAt: now,
      createdBy: insertUser.createdBy ?? null,
      updatedBy: insertUser.updatedBy ?? null
    };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => a.username.localeCompare(b.username));
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }
    
    // Don't allow updating password through this method
    if (userData.password) {
      delete userData.password;
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async updateUserPassword(id: number, hashedPassword: string): Promise<boolean> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return false;
    }
    
    const updatedUser: User = {
      ...existingUser,
      password: hashedPassword,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return true;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Vehicle methods
  async getAllVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values());
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async createVehicle(vehicleData: InsertVehicle): Promise<Vehicle> {
    const id = this.vehicleId++;
    const now = new Date();
    const vehicle: Vehicle = {
      ...vehicleData,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: vehicleData.createdBy ?? null,
      updatedBy: vehicleData.updatedBy ?? null,
      vehicleType: vehicleData.vehicleType ?? null,
      chassisNumber: vehicleData.chassisNumber ?? null,
      fuel: vehicleData.fuel ?? null,
      adBlue: vehicleData.adBlue ?? null,
      euroZone: vehicleData.euroZone ?? null,
      euroZoneEndDate: vehicleData.euroZoneEndDate ?? null,
      internalAppointments: vehicleData.internalAppointments ?? null,
      apkDate: vehicleData.apkDate ?? null,
      company: vehicleData.company ?? null,
      companyDate: vehicleData.companyDate ?? null,
      companyBy: vehicleData.companyBy ?? null,
      registeredTo: vehicleData.registeredTo ?? null,
      registeredToDate: vehicleData.registeredToDate ?? null,
      registeredToBy: vehicleData.registeredToBy ?? null,
      gps: vehicleData.gps ?? null,
      monthlyPrice: vehicleData.monthlyPrice ?? null,
      dailyPrice: vehicleData.dailyPrice ?? null,
      dateIn: vehicleData.dateIn ?? null,
      dateOut: vehicleData.dateOut ?? null,
      contractNumber: vehicleData.contractNumber ?? null,
      damageCheck: vehicleData.damageCheck ?? null,
      damageCheckDate: vehicleData.damageCheckDate ?? null,
      damageCheckAttachment: vehicleData.damageCheckAttachment ?? null,
      damageCheckAttachmentDate: vehicleData.damageCheckAttachmentDate ?? null,
      creationDate: vehicleData.creationDate ?? null,
      departureMileage: vehicleData.departureMileage ?? null,
      returnMileage: vehicleData.returnMileage ?? null,
      roadsideAssistance: vehicleData.roadsideAssistance ?? null,
      spareKey: vehicleData.spareKey ?? null,
      remarks: vehicleData.remarks ?? null,
      winterTires: vehicleData.winterTires ?? null,
      tireSize: vehicleData.tireSize ?? null,
      wokNotification: vehicleData.wokNotification ?? null,
      radioCode: vehicleData.radioCode ?? null,
      warrantyEndDate: vehicleData.warrantyEndDate ?? null,
      seatcovers: vehicleData.seatcovers ?? null,
      backupbeepers: vehicleData.backupbeepers ?? null
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const existingVehicle = this.vehicles.get(id);
    if (!existingVehicle) {
      return undefined;
    }
    
    const updatedVehicle: Vehicle = {
      ...existingVehicle,
      ...vehicleData,
      updatedAt: new Date()
    };
    
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }
  
  async deleteVehicle(id: number): Promise<boolean> {
    return this.vehicles.delete(id);
  }

  async getAvailableVehicles(): Promise<Vehicle[]> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all vehicles
    const allVehicles = Array.from(this.vehicles.values());
    
    // Get active reservations
    const activeReservations = Array.from(this.reservations.values()).filter(r => 
      r.status !== "cancelled" && 
      r.startDate <= today && 
      r.endDate >= today
    );
    
    // Get IDs of vehicles with active reservations
    const reservedVehicleIds = new Set(activeReservations.map(r => r.vehicleId));
    
    // Filter out reserved vehicles
    return allVehicles.filter(v => !reservedVehicleIds.has(v.id));
  }

  async getVehiclesWithApkExpiringSoon(): Promise<Vehicle[]> {
    const today = new Date();
    const twoMonthsFromNow = addMonths(today, 2);
    
    return Array.from(this.vehicles.values()).filter(vehicle => {
      if (!vehicle.apkDate) return false;
      
      const apkDate = parseISO(vehicle.apkDate);
      return isAfter(apkDate, today) && isBefore(apkDate, twoMonthsFromNow);
    });
  }

  async getVehiclesWithWarrantyExpiringSoon(): Promise<Vehicle[]> {
    const today = new Date();
    const twoMonthsFromNow = addMonths(today, 2);
    
    return Array.from(this.vehicles.values()).filter(vehicle => {
      if (!vehicle.warrantyEndDate) return false;
      
      const warrantyEndDate = parseISO(vehicle.warrantyEndDate);
      return isAfter(warrantyEndDate, today) && isBefore(warrantyEndDate, twoMonthsFromNow);
    });
  }

  // Customer methods
  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const id = this.customerId++;
    const now = new Date();
    const customer: Customer = { ...customerData, id, createdAt: now, updatedAt: now };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    if (!existingCustomer) {
      return undefined;
    }
    
    const updatedCustomer: Customer = {
      ...existingCustomer,
      ...customerData,
      updatedAt: new Date()
    };
    
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  // Reservation methods
  async getAllReservations(): Promise<Reservation[]> {
    const reservations = Array.from(this.reservations.values());
    
    // Populate vehicle and customer data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async getReservation(id: number): Promise<Reservation | undefined> {
    const reservation = this.reservations.get(id);
    if (!reservation) {
      return undefined;
    }
    
    // Populate vehicle and customer data
    return {
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    };
  }

  async createReservation(reservationData: InsertReservation): Promise<Reservation> {
    const id = this.reservationId++;
    const now = new Date();
    const reservation: Reservation = { ...reservationData, id, createdAt: now, updatedAt: now };
    this.reservations.set(id, reservation);
    
    // Return with populated data
    return {
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    };
  }

  async updateReservation(id: number, reservationData: Partial<InsertReservation>): Promise<Reservation | undefined> {
    const existingReservation = this.reservations.get(id);
    if (!existingReservation) {
      return undefined;
    }
    
    const updatedReservation: Reservation = {
      ...existingReservation,
      ...reservationData,
      updatedAt: new Date()
    };
    
    this.reservations.set(id, updatedReservation);
    
    // Return with populated data
    return {
      ...updatedReservation,
      vehicle: this.vehicles.get(updatedReservation.vehicleId),
      customer: this.customers.get(updatedReservation.customerId)
    };
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    return this.reservations.delete(id);
  }

  async getReservationsInDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const reservations = Array.from(this.reservations.values()).filter(r => {
      // Check if reservation overlaps with date range
      return (
        (r.startDate <= endDate && r.endDate >= startDate) ||
        (r.startDate >= startDate && r.startDate <= endDate) ||
        (r.endDate >= startDate && r.endDate <= endDate)
      );
    });
    
    // Populate vehicle and customer data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async getUpcomingReservations(): Promise<Reservation[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const reservations = Array.from(this.reservations.values())
      .filter(r => r.startDate >= today && r.status !== "cancelled")
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5); // Limit to 5 reservations
    
    // Populate vehicle and customer data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async getUpcomingMaintenanceReservations(): Promise<Reservation[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const reservations = Array.from(this.reservations.values())
      .filter(r => 
        r.startDate >= today && 
        r.type === 'maintenance_block' && 
        (r.maintenanceStatus === 'scheduled' || r.maintenanceStatus === 'in') &&
        r.status !== "cancelled"
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    
    // Populate vehicle data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async getReservationsByVehicle(vehicleId: number): Promise<Reservation[]> {
    const reservations = Array.from(this.reservations.values())
      .filter(r => r.vehicleId === vehicleId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)); // Sort by start date, newest first
    
    // Populate vehicle and customer data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async getReservationsByCustomer(customerId: number): Promise<Reservation[]> {
    const reservations = Array.from(this.reservations.values())
      .filter(r => r.customerId === customerId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)); // Sort by start date, newest first
    
    // Populate vehicle and customer data
    return reservations.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  async checkReservationConflicts(
    vehicleId: number, 
    startDate: string, 
    endDate: string, 
    excludeReservationId: number | null,
    isMaintenanceBlock: boolean = false
  ): Promise<Reservation[]> {
    const conflicts = Array.from(this.reservations.values()).filter(r => {
      // Skip the reservation we're checking against (for updates)
      if (excludeReservationId !== null && r.id === excludeReservationId) {
        return false;
      }
      
      // Skip cancelled reservations
      if (r.status === "cancelled") {
        return false;
      }
      
      // If this is a maintenance block, only check for conflicts with OTHER maintenance blocks
      // Regular rentals can continue during maintenance (with spare vehicles)
      if (isMaintenanceBlock) {
        if (r.type !== 'maintenance_block') {
          return false;
        }
      } else {
        // For regular rentals, maintenance blocks don't cause conflicts (rentals continue during maintenance)
        if (r.type === 'maintenance_block') {
          return false;
        }
      }
      
      // Check if this is for the same vehicle and if dates overlap
      return (
        r.vehicleId === vehicleId &&
        (
          (r.startDate <= endDate && r.endDate >= startDate) ||
          (r.startDate >= startDate && r.startDate <= endDate) ||
          (r.endDate >= startDate && r.endDate <= endDate)
        )
      );
    });
    
    // Populate vehicle and customer data
    return conflicts.map(reservation => ({
      ...reservation,
      vehicle: this.vehicles.get(reservation.vehicleId),
      customer: this.customers.get(reservation.customerId)
    }));
  }

  // Expense methods
  async getAllExpenses(): Promise<Expense[]> {
    const expenses = Array.from(this.expenses.values());
    
    // Populate vehicle data
    return expenses.map(expense => ({
      ...expense,
      vehicle: this.vehicles.get(expense.vehicleId)
    }));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const expense = this.expenses.get(id);
    if (!expense) {
      return undefined;
    }
    
    // Populate vehicle data
    return {
      ...expense,
      vehicle: this.vehicles.get(expense.vehicleId)
    };
  }

  async createExpense(expenseData: InsertExpense): Promise<Expense> {
    const id = this.expenseId++;
    const now = new Date();
    const expense: Expense = { ...expenseData, id, createdAt: now, updatedAt: now };
    this.expenses.set(id, expense);
    
    // Return with populated data
    return {
      ...expense,
      vehicle: this.vehicles.get(expense.vehicleId)
    };
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const existingExpense = this.expenses.get(id);
    if (!existingExpense) {
      return undefined;
    }
    
    const updatedExpense: Expense = {
      ...existingExpense,
      ...expenseData,
      updatedAt: new Date()
    };
    
    this.expenses.set(id, updatedExpense);
    
    // Return with populated data
    return {
      ...updatedExpense,
      vehicle: this.vehicles.get(updatedExpense.vehicleId)
    };
  }

  async getExpensesByVehicle(vehicleId: number): Promise<Expense[]> {
    const expenses = Array.from(this.expenses.values())
      .filter(e => e.vehicleId === vehicleId)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date, newest first
    
    // Populate vehicle data
    return expenses.map(expense => ({
      ...expense,
      vehicle: this.vehicles.get(expense.vehicleId)
    }));
  }

  async getRecentExpenses(limit: number): Promise<Expense[]> {
    const expenses = Array.from(this.expenses.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by creation date, newest first
      .slice(0, limit);
    
    // Populate vehicle data
    return expenses.map(expense => ({
      ...expense,
      vehicle: this.vehicles.get(expense.vehicleId)
    }));
  }
  
  async deleteExpense(id: number): Promise<boolean> {
    return this.expenses.delete(id);
  }

  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const id = this.documentId++;
    const now = new Date();
    const document: Document = { ...documentData, id, uploadDate: now };
    this.documents.set(id, document);
    return document;
  }
  
  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    const existingDocument = this.documents.get(id);
    if (!existingDocument) {
      return undefined;
    }
    
    const updatedDocument: Document = {
      ...existingDocument,
      ...documentData
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async getDocumentsByVehicle(vehicleId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(d => d.vehicleId === vehicleId)
      .sort((a, b) => {
        // Sort by upload date, newest first
        const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return dateB - dateA;
      });
  }

  async getDocumentsByReservation(reservationId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(d => d.reservationId === reservationId)
      .sort((a, b) => {
        // Sort by upload date, newest first
        const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return dateB - dateA;
      });
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }
  
  // PDF Template methods
  async getAllPdfTemplates(): Promise<PdfTemplate[]> {
    return Array.from(this.pdfTemplates.values());
  }
  
  async getPdfTemplate(id: number): Promise<PdfTemplate | undefined> {
    return this.pdfTemplates.get(id);
  }
  
  async getDefaultPdfTemplate(): Promise<PdfTemplate | undefined> {
    return Array.from(this.pdfTemplates.values()).find(
      template => template.isDefault
    );
  }
  
  async createPdfTemplate(templateData: InsertPdfTemplate): Promise<PdfTemplate> {
    const id = this.pdfTemplateId++;
    const now = new Date();
    
    // If this template is set as default, update all others to not be default
    if (templateData.isDefault) {
      for (const template of this.pdfTemplates.values()) {
        this.pdfTemplates.set(template.id, {
          ...template,
          isDefault: false,
          updatedAt: now
        });
      }
    }
    
    const template: PdfTemplate = {
      ...templateData,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.pdfTemplates.set(id, template);
    return template;
  }
  
  async updatePdfTemplate(id: number, templateData: Partial<InsertPdfTemplate>): Promise<PdfTemplate | undefined> {
    const existingTemplate = this.pdfTemplates.get(id);
    if (!existingTemplate) {
      return undefined;
    }
    
    const now = new Date();
    
    // If this template is being set as default, update all others to not be default
    if (templateData.isDefault) {
      for (const template of this.pdfTemplates.values()) {
        if (template.id !== id) {
          this.pdfTemplates.set(template.id, {
            ...template,
            isDefault: false,
            updatedAt: now
          });
        }
      }
    }
    
    const updatedTemplate: PdfTemplate = {
      ...existingTemplate,
      ...templateData,
      updatedAt: now
    };
    
    this.pdfTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }
  
  async deletePdfTemplate(id: number): Promise<boolean> {
    const wasDefault = this.pdfTemplates.get(id)?.isDefault;
    const deleted = this.pdfTemplates.delete(id);
    
    // If the deleted template was the default, set a new default if there are any left
    if (wasDefault && deleted && this.pdfTemplates.size > 0) {
      const firstTemplate = Array.from(this.pdfTemplates.values())[0];
      this.pdfTemplates.set(firstTemplate.id, {
        ...firstTemplate,
        isDefault: true,
        updatedAt: new Date()
      });
    }
    
    return deleted;
  }
  
  // Custom Notification methods
  async getAllCustomNotifications(): Promise<CustomNotification[]> {
    return Array.from(this.customNotifications.values())
      .sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
  
  async getCustomNotification(id: number): Promise<CustomNotification | undefined> {
    return this.customNotifications.get(id);
  }
  
  async getUnreadCustomNotifications(): Promise<CustomNotification[]> {
    return Array.from(this.customNotifications.values())
      .filter(notification => !notification.isRead)
      .sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
  
  async getCustomNotificationsByType(type: string): Promise<CustomNotification[]> {
    return Array.from(this.customNotifications.values())
      .filter(notification => notification.type === type)
      .sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
  
  async getCustomNotificationsByUser(userId: number): Promise<CustomNotification[]> {
    return Array.from(this.customNotifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
  
  async createCustomNotification(notificationData: InsertCustomNotification): Promise<CustomNotification> {
    const id = this.customNotificationId++;
    const now = new Date();
    const notification: CustomNotification = {
      ...notificationData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.customNotifications.set(id, notification);
    return notification;
  }
  
  async updateCustomNotification(id: number, notificationData: Partial<InsertCustomNotification>): Promise<CustomNotification | undefined> {
    const existingNotification = this.customNotifications.get(id);
    if (!existingNotification) {
      return undefined;
    }
    
    const updatedNotification: CustomNotification = {
      ...existingNotification,
      ...notificationData,
      updatedAt: new Date()
    };
    
    this.customNotifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markCustomNotificationAsRead(id: number): Promise<boolean> {
    const existingNotification = this.customNotifications.get(id);
    if (!existingNotification) {
      return false;
    }
    
    const updatedNotification: CustomNotification = {
      ...existingNotification,
      isRead: true,
      updatedAt: new Date()
    };
    
    this.customNotifications.set(id, updatedNotification);
    return true;
  }
  
  async deleteCustomNotification(id: number): Promise<boolean> {
    return this.customNotifications.delete(id);
  }

  // Spare vehicle management methods
  async getAvailableVehiclesInRange(startDate: string, endDate: string, excludeVehicleId?: number): Promise<Vehicle[]> {
    console.log(`🔍 Checking available vehicles from ${startDate} to ${endDate}, excluding vehicle ${excludeVehicleId || 'none'}`);
    const allVehicles = Array.from(this.vehicles.values());
    const availableVehicles: Vehicle[] = [];

    for (const vehicle of allVehicles) {
      // Skip excluded vehicle (usually the original vehicle needing service)
      if (excludeVehicleId && vehicle.id === excludeVehicleId) {
        continue;
      }

      // Only include vehicles that are in good maintenance status
      if (vehicle.maintenanceStatus !== 'ok') {
        continue;
      }

      // Check for any overlapping reservations (standard, replacement, maintenance_block)
      const hasConflicts = Array.from(this.reservations.values()).some(r => {
        if (r.vehicleId !== vehicle.id || r.status === 'cancelled') {
          return false;
        }
        
        const rStart = new Date(r.startDate);
        const rEnd = r.endDate ? new Date(r.endDate) : null; // null means ongoing
        const checkStart = new Date(startDate);
        const checkEnd = new Date(endDate);
        
        // Check for overlap: ongoing reservations (null end) or date range overlap
        if (!rEnd) {
          // Ongoing reservation - conflicts if check period overlaps with ongoing rental
          const conflicts = checkStart >= rStart;
          if (conflicts) {
            console.log(`  ❌ Vehicle ${vehicle.licensePlate} (ID ${vehicle.id}) has open-ended reservation starting ${r.startDate}`);
          }
          return conflicts;
        }
        
        // Standard date range overlap check
        const conflicts = checkStart <= rEnd && checkEnd >= rStart;
        if (conflicts) {
          console.log(`  ❌ Vehicle ${vehicle.licensePlate} (ID ${vehicle.id}) conflicts: reservation ${r.startDate} to ${r.endDate}`);
        }
        return conflicts;
      });
      
      if (!hasConflicts) {
        console.log(`  ✅ Vehicle ${vehicle.licensePlate} (ID ${vehicle.id}) is available`);
        availableVehicles.push(vehicle);
      }
    }

    console.log(`✅ Found ${availableVehicles.length} available vehicles`);
    return availableVehicles;
  }

  async getActiveReplacementByOriginal(originalReservationId: number): Promise<Reservation | undefined> {
    const today = new Date();
    return Array.from(this.reservations.values()).find(r => {
      if (r.type !== 'replacement' || 
          r.replacementForReservationId !== originalReservationId ||
          r.status === 'cancelled') {
        return false;
      }
      
      const rStart = new Date(r.startDate);
      const rEnd = r.endDate ? new Date(r.endDate) : null;
      
      // Active if today is within range (or ongoing if no end date)
      return today >= rStart && (!rEnd || today <= rEnd);
    });
  }

  async createReplacementReservation(originalReservationId: number, spareVehicleId: number, startDate: string, endDate?: string): Promise<Reservation> {
    const original = this.reservations.get(originalReservationId);
    if (!original) {
      throw new Error('Original reservation not found');
    }
    
    // Ensure spare vehicle is not the same as original
    if (spareVehicleId === original.vehicleId) {
      throw new Error('Spare vehicle cannot be the same as original vehicle');
    }
    
    // Get vehicle details for meaningful notes
    const originalVehicle = this.vehicles.get(original.vehicleId);
    const spareVehicle = this.vehicles.get(spareVehicleId);
    
    // Use original's end date if replacement end date not specified
    const finalEndDate = endDate || original.endDate;
    
    // Check for conflicts on the spare vehicle
    const conflicts = await this.checkReservationConflicts(spareVehicleId, startDate, finalEndDate || '', null);
    if (conflicts.length > 0) {
      throw new Error('Spare vehicle has conflicting reservations');
    }

    const id = this.reservationId++;
    const now = new Date();
    
    // Create meaningful notes with vehicle details instead of IDs
    const originalVehicleInfo = originalVehicle 
      ? `${originalVehicle.licensePlate} (${originalVehicle.brand} ${originalVehicle.model})`
      : `Vehicle ID ${original.vehicleId}`;
    const spareVehicleInfo = spareVehicle 
      ? `${spareVehicle.licensePlate} (${spareVehicle.brand} ${spareVehicle.model})`
      : `Vehicle ID ${spareVehicleId}`;
    
    const replacementReservation: Reservation = {
      id,
      vehicleId: spareVehicleId,
      customerId: original.customerId,
      startDate,
      endDate: finalEndDate,
      status: new Date(startDate) <= new Date() ? 'active' : 'pending',
      type: 'replacement',
      replacementForReservationId: originalReservationId,
      totalPrice: null,
      notes: `Spare vehicle ${spareVehicleInfo} for reservation #${originalReservationId}`,
      damageCheckPath: null,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      updatedBy: null,
      createdByUser: null,
      updatedByUser: null,
    };

    // Mark original vehicle as in service and create maintenance block
    await this.markVehicleForService(original.vehicleId, 'in_service', `Service period for replacement reservation #${id}`);
    await this.createMaintenanceBlock(original.vehicleId, startDate, finalEndDate);

    // Update the original reservation's notes to reflect the replacement
    const updatedOriginal: Reservation = {
      ...original,
      notes: original.notes 
        ? `${original.notes}\n\nOriginal vehicle ${originalVehicleInfo} under maintenance. Replaced with spare vehicle ${spareVehicleInfo}.`
        : `Original vehicle ${originalVehicleInfo} under maintenance. Replaced with spare vehicle ${spareVehicleInfo}.`,
      updatedAt: now
    };
    this.reservations.set(originalReservationId, updatedOriginal);

    this.reservations.set(id, replacementReservation);
    return replacementReservation;
  }

  async updateLegacyNotesWithVehicleDetails(): Promise<number> {
    let updatedCount = 0;
    
    // Regex patterns to find vehicle IDs in notes like "(39)" or "vehicle (36)"
    const vehicleIdPattern = /\((\d+)\)/g;
    const originalVehiclePattern = /Original vehicle \((\d+)\)/g;
    const replacedWithPattern = /Replaced with spare vehicle \((\d+)\)/g;
    
    for (const [reservationId, reservation] of this.reservations.entries()) {
      if (!reservation.notes) continue;
      
      let updatedNotes = reservation.notes;
      let hasChanges = false;
      
      // Replace original vehicle references
      updatedNotes = updatedNotes.replace(originalVehiclePattern, (match, vehicleId) => {
        const vehicle = this.vehicles.get(parseInt(vehicleId));
        if (vehicle) {
          hasChanges = true;
          return `Original vehicle ${vehicle.licensePlate} (${vehicle.brand} ${vehicle.model})`;
        }
        return match;
      });
      
      // Replace spare vehicle references  
      updatedNotes = updatedNotes.replace(replacedWithPattern, (match, vehicleId) => {
        const vehicle = this.vehicles.get(parseInt(vehicleId));
        if (vehicle) {
          hasChanges = true;
          return `Replaced with spare vehicle ${vehicle.licensePlate} (${vehicle.brand} ${vehicle.model})`;
        }
        return match;
      });
      
      // General replacement for any remaining vehicle IDs in parentheses
      updatedNotes = updatedNotes.replace(vehicleIdPattern, (match, vehicleId) => {
        // Skip if this doesn't look like a vehicle ID (e.g., reservation numbers)
        if (updatedNotes.includes(`reservation #${vehicleId}`) || updatedNotes.includes(`#${vehicleId}`)) {
          return match;
        }
        
        const vehicle = this.vehicles.get(parseInt(vehicleId));
        if (vehicle) {
          hasChanges = true;
          return `${vehicle.licensePlate} (${vehicle.brand} ${vehicle.model})`;
        }
        return match;
      });
      
      if (hasChanges) {
        const updatedReservation: Reservation = {
          ...reservation,
          notes: updatedNotes,
          updatedAt: new Date()
        };
        this.reservations.set(reservationId, updatedReservation);
        updatedCount++;
      }
    }
    
    return updatedCount;
  }

  async closeReplacementReservation(replacementReservationId: number, endDate: string): Promise<Reservation | undefined> {
    const reservation = this.reservations.get(replacementReservationId);
    if (!reservation || reservation.type !== 'replacement' || !reservation.replacementForReservationId) {
      return undefined;
    }
    
    const original = this.reservations.get(reservation.replacementForReservationId);
    if (!original) {
      return undefined;
    }

    const updatedReservation: Reservation = {
      ...reservation,
      endDate,
      status: 'returned',
      updatedAt: new Date()
    };

    // Restore original vehicle to good status
    await this.markVehicleForService(original.vehicleId, 'ok');
    
    // Close any maintenance blocks for the original vehicle
    const maintenanceBlocks = Array.from(this.reservations.values()).filter(r =>
      r.type === 'maintenance_block' && 
      r.vehicleId === original.vehicleId &&
      r.status !== 'cancelled' &&
      (!r.endDate || new Date(r.endDate) >= new Date())
    );
    
    for (const block of maintenanceBlocks) {
      await this.closeMaintenanceBlock(block.id, endDate);
    }

    this.reservations.set(replacementReservationId, updatedReservation);
    return updatedReservation;
  }

  async markVehicleForService(vehicleId: number, maintenanceStatus: string, maintenanceNote?: string): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      return undefined;
    }

    const updatedVehicle: Vehicle = {
      ...vehicle,
      maintenanceStatus,
      maintenanceNote: maintenanceNote || null,
      updatedAt: new Date()
    };

    this.vehicles.set(vehicleId, updatedVehicle);
    return updatedVehicle;
  }
  
  async createMaintenanceBlock(vehicleId: number, startDate: string, endDate?: string): Promise<Reservation> {
    const id = this.reservationId++;
    const now = new Date();
    
    const maintenanceBlock: Reservation = {
      id,
      vehicleId,
      customerId: 0, // System reservation, no customer
      startDate,
      endDate: endDate || null,
      status: 'active',
      type: 'maintenance_block',
      replacementForReservationId: null,
      totalPrice: null,
      notes: 'Vehicle maintenance block',
      damageCheckPath: null,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      updatedBy: null,
      createdByUser: null,
      updatedByUser: null,
    };

    this.reservations.set(id, maintenanceBlock);
    return maintenanceBlock;
  }
  
  async closeMaintenanceBlock(blockReservationId: number, endDate: string): Promise<Reservation | undefined> {
    const block = this.reservations.get(blockReservationId);
    if (!block || block.type !== 'maintenance_block') {
      return undefined;
    }

    const updatedBlock: Reservation = {
      ...block,
      endDate,
      status: 'completed',
      updatedAt: new Date()
    };

    this.reservations.set(blockReservationId, updatedBlock);
    return updatedBlock;
  }

  // Placeholder spare vehicle methods
  async getPlaceholderReservations(startDate?: string, endDate?: string): Promise<Reservation[]> {
    const placeholders = Array.from(this.reservations.values()).filter(r => 
      r.placeholderSpare === true && r.type === 'replacement' && r.vehicleId == null
    );

    if (!startDate && !endDate) {
      return placeholders;
    }

    return placeholders.filter(r => {
      const reservationStart = parseISO(r.startDate);
      // Treat null endDate as far future for open-ended reservations
      const reservationEnd = r.endDate ? parseISO(r.endDate) : new Date('2099-12-31');
      
      if (startDate && isAfter(parseISO(startDate), reservationEnd)) {
        return false;
      }
      if (endDate && isBefore(parseISO(endDate), reservationStart)) {
        return false;
      }
      
      return true;
    });
  }

  async getPlaceholderReservationsNeedingAssignment(daysAhead: number = 7): Promise<Reservation[]> {
    const cutoffDate = addDays(new Date(), daysAhead);
    const placeholders = await this.getPlaceholderReservations();
    
    // Double-check that these are truly unassigned placeholders
    return placeholders.filter(r => {
      const startDate = parseISO(r.startDate);
      return isBefore(startDate, cutoffDate) && r.vehicleId == null;
    });
  }

  async assignVehicleToPlaceholder(reservationId: number, vehicleId: number, endDate?: string): Promise<Reservation | undefined> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || !reservation.placeholderSpare || reservation.vehicleId != null || reservation.type !== 'replacement') {
      return undefined;
    }

    // Verify the target vehicle exists
    const vehicle = this.vehicles.get(vehicleId);
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

    // Check for conflicts with the new vehicle assignment across the full period
    const conflicts = await this.checkReservationConflicts(
      vehicleId, 
      reservation.startDate, 
      assignmentEndDate || reservation.startDate,
      reservationId
    );
    
    if (conflicts.length > 0) {
      throw new Error('Vehicle is not available for the requested dates');
    }

    const updatedReservation: Reservation = {
      ...reservation,
      vehicleId,
      placeholderSpare: false,
      status: 'confirmed',
      endDate: assignmentEndDate || reservation.endDate, // Update endDate if provided
      updatedAt: new Date()
    };

    this.reservations.set(reservationId, updatedReservation);
    
    // Return enriched reservation with vehicle and customer data for consistency
    const customer = reservation.customerId ? await this.getCustomer(reservation.customerId) : undefined;
    return {
      ...updatedReservation,
      vehicle,
      customer
    };
  }

  async createPlaceholderReservation(originalReservationId: number, customerId: number, startDate: string, endDate?: string): Promise<Reservation> {
    // Verify the original reservation exists
    const originalReservation = this.reservations.get(originalReservationId);
    if (!originalReservation) {
      throw new Error('Original reservation not found');
    }

    // Check if a replacement (placeholder or active) already exists for this original reservation
    const existingReplacement = await this.getActiveReplacementByOriginal(originalReservationId);
    if (existingReplacement) {
      throw new Error('A replacement reservation already exists for this original reservation');
    }

    // Check for existing placeholder reservations with overlapping dates for the same original reservation
    const placeholders = await this.getPlaceholderReservations(startDate, endDate || startDate);
    const duplicatePlaceholder = placeholders.find(p => 
      p.replacementForReservationId === originalReservationId
    );
    if (duplicatePlaceholder) {
      throw new Error('A placeholder spare reservation already exists for this original reservation');
    }

    const newReservation: Reservation = {
      id: this.reservationId++,
      vehicleId: null, // Placeholder - no vehicle assigned yet
      customerId,
      startDate,
      endDate: endDate || null,
      status: 'pending',
      totalPrice: null,
      notes: `Placeholder spare vehicle for reservation ${originalReservationId}`,
      damageCheckPath: null,
      type: 'replacement',
      replacementForReservationId: originalReservationId,
      placeholderSpare: true, // This is a placeholder reservation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      createdByUser: null,
      updatedByUser: null
    };

    this.reservations.set(newReservation.id, newReservation);
    return newReservation;
  }

  async getAllSavedReports(): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getSavedReport(id: number): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async createSavedReport(report: any): Promise<any> {
    throw new Error('Not implemented in MemStorage');
  }

  async deleteSavedReport(id: number): Promise<boolean> {
    throw new Error('Not implemented in MemStorage');
  }

  async executeReport(configuration: any): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getAllWhatsAppMessages(): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getWhatsAppMessage(id: number): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getWhatsAppMessagesByCustomer(customerId: number): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async createWhatsAppMessage(message: any): Promise<any> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateWhatsAppMessage(id: number, messageData: any): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getAllDamageCheckTemplates(): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getDamageCheckTemplate(id: number): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getDamageCheckTemplatesByVehicle(make?: string, model?: string, type?: string): Promise<any[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getDefaultDamageCheckTemplate(): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async createDamageCheckTemplate(template: any): Promise<any> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateDamageCheckTemplate(id: number, templateData: any): Promise<any | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async deleteDamageCheckTemplate(id: number): Promise<boolean> {
    throw new Error('Not implemented in MemStorage');
  }
}

import { DatabaseStorage } from "./database-storage";

// Use DatabaseStorage for production
export const storage = new DatabaseStorage();

import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchVehicleInfoByLicensePlate } from "./utils/rdw-api";
import { generateRentalContract } from "./utils/pdf-generator";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { insertVehicleSchema, insertCustomerSchema, insertReservationSchema, insertExpenseSchema, insertDocumentSchema } from "@shared/schema";
import multer from "multer";

// Helper function to convert absolute paths to relative paths
function getRelativePath(absolutePath: string): string {
  return absolutePath.replace(/^\/home\/runner\/workspace\//, '');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // ==================== VEHICLE ROUTES ====================
  // Get available vehicles
  app.get("/api/vehicles/available", async (req, res) => {
    const vehicles = await storage.getAvailableVehicles();
    res.json(vehicles);
  });

  // Get vehicles with APK expiring soon
  app.get("/api/vehicles/apk-expiring", async (req, res) => {
    const vehicles = await storage.getVehiclesWithApkExpiringSoon();
    res.json(vehicles);
  });

  // Get vehicles with warranty expiring soon
  app.get("/api/vehicles/warranty-expiring", async (req, res) => {
    const vehicles = await storage.getVehiclesWithWarrantyExpiringSoon();
    res.json(vehicles);
  });
  
  // Get all vehicles
  app.get("/api/vehicles", async (req, res) => {
    const vehicles = await storage.getAllVehicles();
    res.json(vehicles);
  });

  // Get single vehicle
  app.get("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const vehicle = await storage.getVehicle(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.json(vehicle);
  });

  // Create vehicle
  app.post("/api/vehicles", async (req, res) => {
    try {
      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(vehicleData);
      res.status(201).json(vehicle);
    } catch (error) {
      res.status(400).json({ message: "Invalid vehicle data", error });
    }
  });

  // Update vehicle
  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }

      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.updateVehicle(id, vehicleData);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      res.json(vehicle);
    } catch (error) {
      res.status(400).json({ message: "Invalid vehicle data", error });
    }
  });
  
  // Delete vehicle
  app.delete("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }

      const deleted = await storage.deleteVehicle(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      res.json({ success: true, message: "Vehicle successfully deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting vehicle", error });
    }
  });

  // Lookup vehicle via RDW API
  app.get("/api/rdw/vehicle/:licensePlate", async (req, res) => {
    try {
      const licensePlate = req.params.licensePlate;
      const vehicleInfo = await fetchVehicleInfoByLicensePlate(licensePlate);
      res.json(vehicleInfo);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch vehicle information from RDW", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== CUSTOMER ROUTES ====================
  // Get all customers
  app.get("/api/customers", async (req, res) => {
    const customers = await storage.getAllCustomers();
    res.json(customers);
  });

  // Get single customer
  app.get("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  });

  // Create customer
  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }

      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.updateCustomer(id, customerData);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  // ==================== RESERVATION ROUTES ====================
  // Get reservations for a date range
  app.get("/api/reservations/range", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Missing startDate or endDate query parameters" });
      }
      
      const reservations = await storage.getReservationsInDateRange(startDate, endDate);
      res.json(reservations);
    } catch (error) {
      console.error("Error getting reservations by range:", error);
      res.status(500).json({ message: "Error getting reservations" });
    }
  });
  
  app.get("/api/reservations/range/:startDate/:endDate", async (req, res) => {
    const { startDate, endDate } = req.params;
    const reservations = await storage.getReservationsInDateRange(startDate, endDate);
    res.json(reservations);
  });

  // Get upcoming reservations
  app.get("/api/reservations/upcoming", async (req, res) => {
    const reservations = await storage.getUpcomingReservations();
    res.json(reservations);
  });

  // Get reservations by vehicle
  app.get("/api/reservations/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const reservations = await storage.getReservationsByVehicle(vehicleId);
    res.json(reservations);
  });

  // Get reservations by customer
  app.get("/api/reservations/customer/:customerId", async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const reservations = await storage.getReservationsByCustomer(customerId);
    res.json(reservations);
  });

  // Check availability
  app.get("/api/reservations/check-availability/:vehicleId/:startDate/:endDate", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    const { startDate, endDate } = req.params;
    
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const conflicts = await storage.checkReservationConflicts(vehicleId, startDate, endDate, null);
    res.json(conflicts);
  });

  // Get all reservations
  app.get("/api/reservations", async (req, res) => {
    const reservations = await storage.getAllReservations();
    res.json(reservations);
  });

  // Get single reservation
  app.get("/api/reservations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    const reservation = await storage.getReservation(id);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    res.json(reservation);
  });

  // Setup storage for damage check uploads
  const createDamageCheckStorage = async (req: Request, file: Express.Multer.File, callback: Function) => {
    try {
      const vehicleId = req.body.vehicleId;
      if (!vehicleId) {
        return callback(new Error("Vehicle ID is required"), false);
      }
      
      // Get vehicle details for organizing files
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return callback(new Error("Vehicle not found"), false);
      }
      
      // Create folders if they don't exist
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9-]/g, '_');
      const baseDir = path.join(process.cwd(), 'uploads', sanitizedPlate);
      const damageCheckDir = path.join(baseDir, 'damage_checks');
      
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(damageCheckDir)) {
        fs.mkdirSync(damageCheckDir, { recursive: true });
      }
      
      callback(null, damageCheckDir);
    } catch (error) {
      console.error("Error with damage check upload:", error);
      callback(error, false);
    }
  };

  // Configure multer for damage check uploads
  const damageCheckStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      createDamageCheckStorage(req, file, (err: any, result: any) => {
        if (err) return cb(err, '');
        cb(null, result);
      });
    },
    filename: async (req, file, cb) => {
      try {
        const timestamp = Date.now();
        const dateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const extension = path.extname(file.originalname);
        const startDate = req.body.startDate || dateString;
        
        // Get vehicle license plate
        const vehicleId = parseInt(req.body.vehicleId);
        const vehicle = await storage.getVehicle(vehicleId);
        
        if (!vehicle) {
          throw new Error("Vehicle not found");
        }
        
        // Sanitize license plate for filename (remove spaces, etc.)
        const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
        
        // Create filename with license plate, document type, and date
        const fileName = `${sanitizedPlate}_damage_check_${startDate}_${timestamp}${extension}`;
        
        cb(null, fileName);
      } catch (error) {
        console.error("Error creating filename for damage check:", error);
        const fallbackName = `damage_check_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, fallbackName);
      }
    }
  });
  
  const damageCheckUpload = multer({
    storage: damageCheckStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept only specific file types
      const fileTypes = /jpeg|jpg|png|pdf/;
      const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = fileTypes.test(file.mimetype);
      
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Only .jpg, .jpeg, .png, and .pdf files are allowed") as any, false);
      }
    },
  });
  
  // Create reservation with damage check upload
  app.post("/api/reservations", damageCheckUpload.single('damageCheckFile'), async (req, res) => {
    try {
      // Convert string fields to the correct types
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.customerId) req.body.customerId = parseInt(req.body.customerId);
      if (req.body.totalPrice) req.body.totalPrice = parseFloat(req.body.totalPrice);
      
      const reservationData = insertReservationSchema.parse(req.body);
      
      // Check for conflicts
      const conflicts = await storage.checkReservationConflicts(
        reservationData.vehicleId,
        reservationData.startDate,
        reservationData.endDate,
        null
      );
      
      if (conflicts.length > 0) {
        return res.status(409).json({ 
          message: "Reservation conflicts with existing bookings",
          conflicts
        });
      }
      
      const reservation = await storage.createReservation(reservationData);
      
      // If there's a file, create a document record linked to the vehicle
      // and update the reservation with the damage check path
      if (req.file) {
        const documentData = {
          vehicleId: reservationData.vehicleId,
          documentType: "Damage Check",
          fileName: req.file.originalname,
          filePath: getRelativePath(req.file.path),
          fileSize: req.file.size,
          contentType: req.file.mimetype,
          createdBy: `Reservation #${reservation.id}`,
          notes: `Damage check for reservation from ${reservationData.startDate} to ${reservationData.endDate}`
        };
        
        const document = await storage.createDocument(documentData);
        
        // Update the reservation with the damage check path (using relative path)
        await storage.updateReservation(reservation.id, {
          damageCheckPath: getRelativePath(req.file.path)
        });
      }
      
      res.status(201).json(reservation);
    } catch (error) {
      console.error("Error creating reservation:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid reservation data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to create reservation", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // Update reservation with damage check upload
  app.patch("/api/reservations/:id", damageCheckUpload.single('damageCheckFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      // Convert string fields to the correct types
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.customerId) req.body.customerId = parseInt(req.body.customerId);
      if (req.body.totalPrice) req.body.totalPrice = parseFloat(req.body.totalPrice);
      
      const reservationData = insertReservationSchema.parse(req.body);
      
      // Check for conflicts
      const conflicts = await storage.checkReservationConflicts(
        reservationData.vehicleId,
        reservationData.startDate,
        reservationData.endDate,
        id
      );
      
      if (conflicts.length > 0) {
        return res.status(409).json({ 
          message: "Reservation conflicts with existing bookings",
          conflicts
        });
      }
      
      const reservation = await storage.updateReservation(id, reservationData);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // If there's a file, create a document record linked to the vehicle
      // and update the reservation with the damage check path
      if (req.file) {
        const documentData = {
          vehicleId: reservationData.vehicleId,
          documentType: "Damage Check",
          fileName: req.file.originalname,
          filePath: getRelativePath(req.file.path),
          fileSize: req.file.size,
          contentType: req.file.mimetype,
          createdBy: `Reservation #${reservation.id} (Updated)`,
          notes: `Updated damage check for reservation from ${reservationData.startDate} to ${reservationData.endDate}`
        };
        
        const document = await storage.createDocument(documentData);
        
        // Update the reservation with the damage check path (using relative path)
        await storage.updateReservation(reservation.id, {
          damageCheckPath: getRelativePath(req.file.path)
        });
      }
      
      res.json(reservation);
    } catch (error) {
      console.error("Error updating reservation:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid reservation data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to update reservation", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // ==================== EXPENSE ROUTES ====================
  // Setup storage for expense receipt uploads
  const createExpenseReceiptStorage = async (req: Request, file: Express.Multer.File, callback: Function) => {
    try {
      const vehicleId = req.body.vehicleId;
      if (!vehicleId) {
        return callback(new Error("Vehicle ID is required"), false);
      }
      
      // Get vehicle details for organizing files
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return callback(new Error("Vehicle not found"), false);
      }
      
      // Create folders if they don't exist
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9-]/g, '_');
      const baseDir = path.join(process.cwd(), 'uploads', sanitizedPlate);
      const receiptsDir = path.join(baseDir, 'receipts');
      
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }
      
      callback(null, receiptsDir);
    } catch (error) {
      console.error("Error with expense receipt upload:", error);
      callback(error, false);
    }
  };

  // Configure multer for expense receipt uploads
  const expenseReceiptStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      createExpenseReceiptStorage(req, file, (err: any, result: any) => {
        if (err) return cb(err, '');
        cb(null, result);
      });
    },
    filename: async (req, file, cb) => {
      try {
        const timestamp = Date.now();
        const expenseDate = req.body.date || new Date().toISOString().split('T')[0];
        const category = req.body.category || 'unknown';
        const extension = path.extname(file.originalname);
        
        // Get vehicle license plate
        const vehicleId = parseInt(req.body.vehicleId);
        const vehicle = await storage.getVehicle(vehicleId);
        
        if (!vehicle) {
          throw new Error("Vehicle not found");
        }
        
        // Sanitize license plate for filename (remove spaces, etc.)
        const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
        
        // Create filename with license plate, expense category, and date
        const fileName = `${sanitizedPlate}_receipt_${category}_${expenseDate}_${timestamp}${extension}`;
        
        cb(null, fileName);
      } catch (error) {
        console.error("Error creating filename for expense receipt:", error);
        const expenseDate = req.body.date || new Date().toISOString().split('T')[0];
        const category = req.body.category || 'unknown';
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        const fallbackName = `receipt_${category}_${expenseDate}_${timestamp}${extension}`;
        cb(null, fallbackName);
      }
    }
  });
  
  const expenseReceiptUpload = multer({
    storage: expenseReceiptStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept only specific file types
      const fileTypes = /jpeg|jpg|png|pdf/;
      const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = fileTypes.test(file.mimetype);
      
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Only .jpg, .jpeg, .png, and .pdf files are allowed") as any, false);
      }
    },
  });

  // Get recent expenses
  app.get("/api/expenses/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const expenses = await storage.getRecentExpenses(limit);
    res.json(expenses);
  });
  
  // Get all expenses
  app.get("/api/expenses", async (req, res) => {
    const expenses = await storage.getAllExpenses();
    res.json(expenses);
  });

  // Get single expense
  app.get("/api/expenses/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid expense ID" });
    }

    const expense = await storage.getExpense(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(expense);
  });

  // Get expenses by vehicle
  app.get("/api/expenses/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const expenses = await storage.getExpensesByVehicle(vehicleId);
    res.json(expenses);
  });

  // Create expense with receipt upload
  app.post("/api/expenses", expenseReceiptUpload.single('receiptFile'), async (req, res) => {
    try {
      // Convert string fields to the correct types
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.amount) req.body.amount = parseFloat(req.body.amount);
      
      const expenseData = insertExpenseSchema.parse(req.body);
      
      // Create expense record
      const expense = await storage.createExpense({
        ...expenseData,
        receiptPath: req.file ? getRelativePath(req.file.path) : null
      });
      
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid expense data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to create expense", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // Update expense with receipt upload
  app.patch("/api/expenses/:id", expenseReceiptUpload.single('receiptFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }

      // Convert string fields to the correct types
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.amount) req.body.amount = parseFloat(req.body.amount);
      
      const expenseData = insertExpenseSchema.parse(req.body);
      
      // Update expense record
      const expense = await storage.updateExpense(id, {
        ...expenseData,
        receiptPath: req.file ? getRelativePath(req.file.path) : undefined
      });
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid expense data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to update expense", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // ==================== DOCUMENT ROUTES ====================
  // Setup storage for document uploads
  const createDocumentUploadStorage = async (req: Request, file: Express.Multer.File, callback: Function) => {
    try {
      const vehicleId = req.body.vehicleId;
      if (!vehicleId) {
        return callback(new Error("Vehicle ID is required"), false);
      }
      
      // Get vehicle details for organizing files
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return callback(new Error("Vehicle not found"), false);
      }
      
      // Create folders if they don't exist
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9-]/g, '_');
      const baseDir = path.join(process.cwd(), 'uploads', sanitizedPlate);
      let documentsDir = baseDir;
      
      // Organize by document type if provided
      if (req.body.documentType) {
        const sanitizedType = req.body.documentType.toLowerCase().replace(/\s+/g, '_');
        documentsDir = path.join(baseDir, sanitizedType);
      }
      
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir, { recursive: true });
      }
      
      callback(null, documentsDir);
    } catch (error) {
      console.error("Error with document upload:", error);
      callback(error, false);
    }
  };

  // Configure multer for document uploads
  const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      createDocumentUploadStorage(req, file, (err: any, result: any) => {
        if (err) return cb(err, '');
        cb(null, result);
      });
    },
    filename: async (req, file, cb) => {
      try {
        const timestamp = Date.now();
        const dateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const extension = path.extname(file.originalname);
        const documentType = req.body.documentType || 'document';
        
        // Get vehicle license plate
        const vehicleId = parseInt(req.body.vehicleId);
        const vehicle = await storage.getVehicle(vehicleId);
        
        if (!vehicle) {
          throw new Error("Vehicle not found");
        }
        
        // Sanitize license plate for filename (remove spaces, etc.)
        const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
        
        // Create filename with license plate, document type, and date
        const newFilename = `${sanitizedPlate}_${documentType.replace(/\s+/g, '_')}_${dateString}_${timestamp}${extension}`;
        
        cb(null, newFilename);
      } catch (error) {
        console.error("Error creating filename:", error);
        // Fallback to simple timestamped name if there's an error
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        const documentType = req.body.documentType || 'document';
        const fallbackName = `${documentType.replace(/\s+/g, '_')}_${timestamp}${extension}`;
        cb(null, fallbackName);
      }
    }
  });
  
  const documentUpload = multer({
    storage: documentStorage,
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for documents
    },
    fileFilter: (req, file, cb) => {
      // Accept common document types
      const fileTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|txt|csv/;
      const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
      
      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error("Unsupported file type") as any, false);
      }
    },
  });

  // Get all documents
  app.get("/api/documents", async (req, res) => {
    const documents = await storage.getAllDocuments();
    res.json(documents);
  });

  // Get documents by vehicle
  app.get("/api/documents/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const documents = await storage.getDocumentsByVehicle(vehicleId);
    res.json(documents);
  });

  // Get single document
  app.get("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const document = await storage.getDocument(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(document);
  });

  // Upload document
  app.post("/api/documents", documentUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Convert vehicleId to number
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      
      // Get the filename from the path (which is the formatted name)
      const formattedFileName = path.basename(req.file.path);
      
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        fileName: formattedFileName,
        filePath: getRelativePath(req.file.path),
        fileSize: req.file.size,
        contentType: req.file.mimetype
      });
      
      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid document data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to upload document", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // Update document
  app.patch("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // Get existing document
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Update only allowed fields (documentType and notes)
      const documentData = {
        ...(req.body.documentType && { documentType: req.body.documentType }),
        ...(req.body.notes !== undefined && { notes: req.body.notes })
      };
      
      const updatedDocument = await storage.updateDocument(id, documentData);
      if (!updatedDocument) {
        return res.status(404).json({ message: "Failed to update document" });
      }
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(400).json({ 
        message: "Failed to update document", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // Get document to check if file exists
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Try to delete the file if it exists
      if (document.filePath) {
        // Convert relative path to absolute path
        const absolutePath = path.join(process.cwd(), document.filePath);
        console.log(`Attempting to delete file at: ${absolutePath}`);
        
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
          console.log(`File deleted successfully: ${absolutePath}`);
        } else {
          console.log(`File not found at: ${absolutePath}`);
        }
      }

      // Delete the document record
      const success = await storage.deleteDocument(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete document record" });
      }

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ 
        message: "Failed to delete document", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== CONTRACT GENERATION ====================
  // Generate rental contract PDF
  app.get("/api/contracts/generate/:reservationId", async (req, res) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      // Generate PDF contract
      const pdfBuffer = await generateRentalContract(reservation);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=rental_contract_${reservationId}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating contract:", error);
      res.status(500).json({ 
        message: "Failed to generate contract", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Setup static file serving for uploads
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        // If file not found, continue to next handler
        next();
      }
    });
  });

  // Create HTTP server and return it
  return createServer(app);
}
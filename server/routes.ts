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
        // Generate filename with reservation dates
        const startDate = req.body.startDate || new Date().toISOString().split('T')[0];
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        const fileName = `damage_check_${startDate}_${timestamp}${extension}`;
        
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
          filePath: req.file.path,
          fileSize: req.file.size,
          contentType: req.file.mimetype,
          createdBy: `Reservation #${reservation.id}`,
          notes: `Damage check for reservation from ${reservationData.startDate} to ${reservationData.endDate}`
        };
        
        const document = await storage.createDocument(documentData);
        
        // Update the reservation with the damage check path
        await storage.updateReservation(reservation.id, {
          damageCheckPath: req.file.path
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
          filePath: req.file.path,
          fileSize: req.file.size,
          contentType: req.file.mimetype,
          createdBy: `Reservation #${reservation.id} (Updated)`,
          notes: `Updated damage check for reservation from ${reservationData.startDate} to ${reservationData.endDate}`
        };
        
        const document = await storage.createDocument(documentData);
        
        // Update the reservation with the damage check path
        await storage.updateReservation(reservation.id, {
          damageCheckPath: req.file.path
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

  // Generate rental contract PDF
  app.get("/api/reservations/:id/contract", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      const pdfBuffer = await generateRentalContract(reservation);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contract_${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to generate contract",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== EXPENSE ROUTES ====================
  // Get expenses by vehicle
  app.get("/api/expenses/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const expenses = await storage.getExpensesByVehicle(vehicleId);
    res.json(expenses);
  });

  // Get recent expenses
  app.get("/api/expenses/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const expenses = await storage.getRecentExpenses(limit);
      res.json(expenses);
    } catch (error) {
      console.error("Error getting recent expenses:", error);
      res.status(500).json({ message: "Error getting recent expenses" });
    }
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

  // Create expense
  app.post("/api/expenses", async (req, res) => {
    try {
      const expenseData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense data", error });
    }
  });

  // Update expense
  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }

      const expenseData = insertExpenseSchema.parse(req.body);
      const expense = await storage.updateExpense(id, expenseData);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(expense);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense data", error });
    }
  });
  
  // Setup storage for expense receipts
  const createExpenseReceiptStorage = async (req: Request, file: Express.Multer.File, callback: Function) => {
    try {
      // Get the vehicle ID from the request
      const vehicleId = req.body.vehicleId;
      
      if (!vehicleId) {
        return callback(new Error("Vehicle ID is required"));
      }
      
      // Get the vehicle to get the license plate
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      
      if (!vehicle) {
        return callback(new Error("Vehicle not found"));
      }
      
      const licensePlate = vehicle.licensePlate;
      
      // Create folder structure if it doesn't exist
      // Format: /uploads/[license_plate]/expenses
      const folderPath = path.join(process.cwd(), "uploads", licensePlate, "expenses");
      
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      
      callback(null, folderPath);
    } catch (error) {
      console.error("Error setting up expense receipt storage:", error);
      callback(error);
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
        // Get vehicle info to retrieve license plate
        const vehicleId = req.body.vehicleId;
        const vehicle = await storage.getVehicle(parseInt(vehicleId));
        
        if (!vehicle) {
          return cb(new Error("Vehicle not found"), "" as any);
        }
        
        const licensePlate = vehicle.licensePlate;
        
        // Format the current date as YYYY-MM-DD
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        
        // Create filename in the format: licensePlate-receipt-date-uniqueSuffix.extension
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Math.round(Math.random() * 1E6);
        const sanitizedLicensePlate = licensePlate.replace(/[^a-zA-Z0-9-]/g, '');
        const filename = `${sanitizedLicensePlate}-receipt-${dateString}-${uniqueSuffix}${extension}`;
        
        cb(null, filename);
      } catch (error) {
        console.error("Error creating filename for expense receipt:", error);
        // If there's an error, use a fallback naming strategy
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = file.originalname.replace(extension, '') + '-' + uniqueSuffix + extension;
        cb(null, filename);
      }
    }
  });
  
  const uploadExpenseReceipt = multer({ 
    storage: expenseReceiptStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
      // Accept PDF, JPG, JPEG, PNG and GIF files
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG and GIF files are allowed.') as any, false);
      }
    }
  });
  
  // Create expense with receipt file
  app.post("/api/expenses/with-receipt", uploadExpenseReceipt.single('receiptFile'), async (req, res) => {
    try {
      const file = req.file;
      const { vehicleId, category, amount, date, description } = req.body;
      
      if (!vehicleId || !category || !amount || !date || !file) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create expense data with receipt file information
      const expenseData = {
        vehicleId: parseInt(vehicleId),
        category,
        amount: parseFloat(amount).toString(), // Convert to string as per schema
        date,
        description: description || null,
        receiptFile: file.filename,
        receiptFilePath: file.path,
        receiptFileSize: file.size,
        receiptContentType: file.mimetype
      };
      
      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense with receipt:", error);
      res.status(400).json({ 
        message: "Invalid expense data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Update expense with receipt file
  app.post("/api/expenses/:id/with-receipt", uploadExpenseReceipt.single('receiptFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }
      
      const file = req.file;
      const { vehicleId, category, amount, date, description } = req.body;
      
      if (!vehicleId || !category || !amount || !date || !file) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create expense data with receipt file information
      const expenseData = {
        vehicleId: parseInt(vehicleId),
        category,
        amount: parseFloat(amount).toString(), // Convert to string as per schema
        date,
        description: description || null,
        receiptFile: file.filename,
        receiptFilePath: file.path,
        receiptFileSize: file.size,
        receiptContentType: file.mimetype
      };
      
      const expense = await storage.updateExpense(id, expenseData);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense with receipt:", error);
      res.status(400).json({ 
        message: "Invalid expense data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== DOCUMENT ROUTES ====================
  // Configure storage for multer
  const createDocumentUploadStorage = async (req: Request, file: Express.Multer.File, callback: Function) => {
    try {
      // Get vehicle info based on vehicleId to retrieve license plate
      const vehicleId = req.body.vehicleId;
      if (!vehicleId) {
        return callback(new Error("Vehicle ID is required"), null);
      }
      
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return callback(new Error("Vehicle not found"), null);
      }
      
      const licensePlate = vehicle.licensePlate;
      const documentType = req.body.documentType || "Other";
      
      // Create directory structure if it doesn't exist
      const dirPath = path.join(process.cwd(), "uploads", licensePlate, documentType);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      callback(null, dirPath);
    } catch (error) {
      callback(error, null);
    }
  };
  
  const multerStorage = multer.diskStorage({
    destination: createDocumentUploadStorage,
    filename: async (req, file, callback) => {
      try {
        // Get vehicle info to retrieve license plate
        const vehicleId = req.body.vehicleId;
        const vehicle = await storage.getVehicle(parseInt(vehicleId));
        
        if (!vehicle) {
          return callback(new Error("Vehicle not found"), "" as any);
        }
        
        const licensePlate = vehicle.licensePlate;
        const documentType = req.body.documentType || "Other";
        
        // Format the current date as YYYY-MM-DD
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        
        // Create filename in the format: licensePlate-documentType-date-uniqueSuffix.extension
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Math.round(Math.random() * 1E6);
        const filename = `${licensePlate} - ${documentType} - ${dateString} - ${uniqueSuffix}${extension}`;
        
        callback(null, filename);
      } catch (error) {
        // If there's an error, use a fallback naming strategy
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = file.originalname.replace(extension, '') + '-' + uniqueSuffix + extension;
        callback(null, filename);
      }
    }
  });
  
  const upload = multer({ 
    storage: multerStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    }
  });
  
  // Upload document
  app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { vehicleId, documentType, notes, createdBy } = req.body;
      
      if (!vehicleId || !documentType || !file) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get the license plate for storing in the correct folder
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      const licensePlate = vehicle.licensePlate;
      
      // Prepare document data
      const documentData = {
        vehicleId: parseInt(vehicleId),
        documentType,
        fileName: file.filename, // Use the renamed filename instead of originalname
        filePath: file.path,
        fileSize: file.size,
        contentType: file.mimetype,
        createdBy: createdBy || 'System',
        notes: notes || null
      };

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(400).json({ 
        message: "Invalid document data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
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

  // Download document
  app.get("/api/documents/download/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const document = await storage.getDocument(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    // Serve the actual file
    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.sendFile(document.filePath);
  });
  
  // Get all documents
  app.get("/api/documents", async (req, res) => {
    const documents = await storage.getAllDocuments();
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

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    // Get document before deleting to know the file path
    const document = await storage.getDocument(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    // Delete the file from disk if it exists
    if (document.filePath && fs.existsSync(document.filePath)) {
      try {
        fs.unlinkSync(document.filePath);
      } catch (error) {
        console.error("Failed to delete file from disk:", error);
        // Continue with the database deletion even if file deletion fails
      }
    }

    const success = await storage.deleteDocument(id);
    if (!success) {
      return res.status(404).json({ message: "Document not found in database" });
    }

    res.status(204).end();
  });

  // ==================== BULK IMPORT ROUTES ====================
  // Bulk import vehicles by license plates
  app.post("/api/vehicles/bulk-import-plates", async (req, res) => {
    try {
      // Expect an array of license plates
      const { licensePlates } = req.body;
      
      if (!Array.isArray(licensePlates) || licensePlates.length === 0) {
        return res.status(400).json({ message: "Please provide a non-empty array of license plates" });
      }
      
      const results = {
        imported: [] as any[],
        failed: [] as any[]
      };
      
      // Process each license plate
      for (const licensePlate of licensePlates) {
        try {
          // Fetch vehicle info from RDW API
          const vehicleInfo = await fetchVehicleInfoByLicensePlate(licensePlate);
          
          if (vehicleInfo) {
            // Create the vehicle in the database
            const vehicle = await storage.createVehicle(vehicleInfo);
            results.imported.push({ licensePlate, vehicle });
          } else {
            results.failed.push({ licensePlate, error: "No vehicle information found" });
          }
        } catch (error) {
          results.failed.push({ 
            licensePlate, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }
      
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to process bulk import", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

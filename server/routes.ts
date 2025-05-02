import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchVehicleInfoByLicensePlate } from "./utils/rdw-api";
import { generateRentalContract } from "./utils/pdf-generator";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { insertVehicleSchema, insertCustomerSchema, insertReservationSchema, insertExpenseSchema, insertDocumentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // ==================== VEHICLE ROUTES ====================
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

  // Create reservation
  app.post("/api/reservations", async (req, res) => {
    try {
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
      res.status(201).json(reservation);
    } catch (error) {
      res.status(400).json({ message: "Invalid reservation data", error });
    }
  });

  // Update reservation
  app.patch("/api/reservations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

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
      
      res.json(reservation);
    } catch (error) {
      res.status(400).json({ message: "Invalid reservation data", error });
    }
  });

  // Get reservations for a date range
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
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const expenses = await storage.getRecentExpenses(limit);
    res.json(expenses);
  });

  // ==================== DOCUMENT ROUTES ====================
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

  // Upload document
  app.post("/api/documents/upload", async (req, res) => {
    try {
      // This would normally use multer middleware for file uploads
      // Since we're using in-memory storage, we'll simulate file upload
      const { vehicleId, documentType, file, notes } = req.body;
      
      if (!vehicleId || !documentType || !file) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const fileName = file.name || "document.pdf";
      const filePath = `/uploads/${vehicleId}/${documentType}/${fileName}`;
      
      const documentData = {
        vehicleId: parseInt(vehicleId),
        documentType,
        fileName,
        filePath,
        fileSize: file.size || 100000, // Simulate file size
        contentType: file.type || "application/pdf",
        notes
      };

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      res.status(400).json({ message: "Invalid document data", error });
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

    // This would normally serve the actual file
    // Since we're using in-memory storage, we'll send a placeholder response
    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.send("This is a placeholder for the actual file content");
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const success = await storage.deleteDocument(id);
    if (!success) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.status(204).end();
  });

  const httpServer = createServer(app);
  return httpServer;
}

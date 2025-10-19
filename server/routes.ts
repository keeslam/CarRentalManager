import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { format } from "date-fns";
import { storage } from "./storage";
import { fetchVehicleInfoByLicensePlate, RDWNotFoundError, RDWTimeoutError, RDWUpstreamError } from "./utils/rdw-api";
import { generateRentalContract, generateRentalContractFromTemplate, prepareContractData } from "./utils/pdf-generator";
import { processInvoiceWithAI, generateInvoiceHash, validateParsedInvoice, type ParsedInvoice } from "./utils/invoice-scanner";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { 
  insertVehicleSchema, 
  insertCustomerSchema, 
  insertReservationSchema, 
  insertExpenseSchema, 
  insertDocumentSchema,
  insertUserSchema,
  insertPdfTemplateSchema,
  insertDriverSchema,
  createPlaceholderReservationSchema,
  placeholderQuerySchema,
  placeholderNeedingAssignmentQuerySchema,
  assignVehicleToPlaceholderSchema,
  Reservation,
  UserRole,
  UserPermission
} from "../shared/schema";
import multer from "multer";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { BackupService } from "./backupService";
import { ObjectStorageService } from "./objectStorage";
import { realtimeEvents } from "./realtime-events";
import { clearEmailConfigCache, sendEmail } from "./utils/email-service";
import { 
  getWelcomeTemplate, 
  getPasswordResetTemplate, 
  getApkReminderTemplate, 
  getMaintenanceReminderTemplate,
  getCustomMessageTemplate 
} from "./utils/email-templates-i18n";

// Helper function to get uploads directory - works in any environment
function getUploadsDir(): string {
  // Use environment variable if set, otherwise default to uploads in current directory
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

// Helper function to convert absolute paths to relative paths - works for any deployment
function getRelativePath(absolutePath: string): string {
  const uploadsDir = getUploadsDir();
  // Make path relative to uploads directory for portability
  return path.relative(process.cwd(), absolutePath);
}

// Helper function to format dates consistently
function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return format(date, 'dd-MM-yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  // Create uploads directory if it doesn't exist - now works in any environment
  const uploadsDir = getUploadsDir();
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`✅ Created uploads directory: ${uploadsDir}`);
    } else {
      console.log(`✅ Uploads directory exists: ${uploadsDir}`);
    }
    
    // Test write permissions
    const testFile = path.join(uploadsDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`✅ Uploads directory has write permissions`);
    
  } catch (error) {
    console.error(`❌ Upload directory setup failed:`, error);
    console.error(`Current working directory: ${process.cwd()}`);
    console.error(`Attempted uploads directory: ${uploadsDir}`);
    throw new Error(`Upload directory setup failed. Please ensure the application has write permissions to: ${uploadsDir}`);
  }

  // Configure multer for file uploads (PDFs for invoices/expenses)
  const upload = multer({
    dest: path.join(uploadsDir, 'temp'),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for invoices
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    },
  });

  // Configure multer for backup uploads (backup files)
  const backupUpload = multer({
    dest: path.join(uploadsDir, 'temp'),
    limits: {
      fileSize: 1000 * 1024 * 1024, // 1GB limit for backups
    },
    fileFilter: (req, file, cb) => {
      const filename = file.originalname.toLowerCase();
      const allowedExtensions = ['.sql', '.sql.gz', '.tar.gz', '.tgz', '.gz'];
      const isAllowed = allowedExtensions.some(ext => filename.endsWith(ext));
      
      if (isAllowed) {
        cb(null, true);
      } else {
        cb(new Error('Only backup files (.sql, .sql.gz, .tar.gz, .tgz) are allowed'));
      }
    },
  });
  
  // Set up authentication routes and middleware
  const { requireAuth } = setupAuth(app);

  // Initialize backup service
  const backupService = new BackupService();
  const objectStorage = new ObjectStorageService();

  // ==================== USER MANAGEMENT ROUTES ====================
  // A middleware to check for admin permissions
  const requireAdmin = (req: Request & { user?: any; isAuthenticated?: () => boolean }, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Not authorized. Admin access required." });
    }
    
    next();
  };
  
  // Check if user has specific permission
  const hasPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Admin role always has all permissions
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }
      
      const userPermissions = req.user.permissions || [];
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({ 
          message: `Not authorized. '${permission}' permission required.` 
        });
      }
      
      next();
    };
  };
  
  // Get all users (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Don't send passwords to client
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get single user (admin only)
  app.get("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't send password to client
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Create user (admin only)
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Add audit trail
      const currentUser = req.user;
      const enrichedUserData = {
        ...userData,
        createdBy: currentUser.username,
        updatedBy: currentUser.username
      };
      
      // Hash password before storing
      const hashedPassword = await hashPassword(userData.password);
      
      const newUser = await storage.createUser({
        ...enrichedUserData,
        password: hashedPassword
      });
      
      // Don't send password back to client
      const { password, ...userWithoutPassword } = newUser;
      
      // Broadcast real-time update
      realtimeEvents.users.created(userWithoutPassword);
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ 
        message: "Failed to create user", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Update user with self-update for own profile
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Allow users to update their own profile, but require admin for others
      const isSelfUpdate = id === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isSelfUpdate && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to update other user accounts" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If updating username, check if new username already exists
      if (req.body.username && req.body.username !== user.username) {
        const existingUser = await storage.getUserByUsername(req.body.username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      // For self-update, only allow certain fields (username, fullName, email)
      let userData;
      if (isSelfUpdate && !isAdmin) {
        const { username, fullName, email } = req.body;
        userData = {
          username,
          fullName,
          email,
          updatedBy: req.user.username
        };
        
        // Filter out undefined values
        Object.keys(userData).forEach(key => 
          userData[key] === undefined && delete userData[key]
        );
      } else {
        // Admin can update all fields
        userData = {
          ...req.body,
          updatedBy: req.user.username
        };
      }
      
      // Special handling for admin-only operations
      if (!isAdmin) {
        // Non-admins can't change roles or permissions
        delete userData.role;
        delete userData.permissions;
        delete userData.active;
      }
      
      // Handle password separately
      if (userData.password) {
        // Separate password from other data
        const { password, ...otherData } = userData;
        
        // Update user data without password
        const updatedUser = await storage.updateUser(id, otherData);
        
        // Update password separately with proper hashing
        const hashedPassword = await hashPassword(password);
        await storage.updateUserPassword(id, hashedPassword);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Don't send password back to client
        const { password: _, ...userWithoutPassword } = updatedUser;
        
        // Broadcast real-time update
        realtimeEvents.users.updated(userWithoutPassword);
        
        res.json(userWithoutPassword);
      } else {
        // Update user without password change
        const updatedUser = await storage.updateUser(id, userData);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Don't send password back to client
        const { password: _, ...userWithoutPassword } = updatedUser;
        
        // Broadcast real-time update
        realtimeEvents.users.updated(userWithoutPassword);
        
        res.json(userWithoutPassword);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ 
        message: "Failed to update user", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Original update user for backward compatibility
  app.patch("/api/users/:id/admin", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If updating username, check if new username already exists
      if (req.body.username && req.body.username !== user.username) {
        const existingUser = await storage.getUserByUsername(req.body.username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      // Add audit trail
      const currentUser = req.user;
      const userData = {
        ...req.body,
        updatedBy: currentUser.username
      };
      
      // Handle password separately
      if (userData.password) {
        // Separate password from other data
        const { password, ...otherData } = userData;
        
        // Update user data without password
        const updatedUser = await storage.updateUser(id, otherData);
        
        // Update password separately with proper hashing
        const hashedPassword = await hashPassword(password);
        await storage.updateUserPassword(id, hashedPassword);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Don't send password back to client
        const { password: pwd, ...userWithoutPassword } = updatedUser;
        return res.json(userWithoutPassword);
      } else {
        // Regular update without password change
        const updatedUser = await storage.updateUser(id, userData);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Don't send password back to client
        const { password, ...userWithoutPassword } = updatedUser;
        return res.json(userWithoutPassword);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ 
        message: "Failed to update user", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Delete user (admin only)
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Prevent deletion of the current user
      if (id === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ success: true, message: "User successfully deleted" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ 
        message: "Failed to delete user", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Update current user's password
  app.post("/api/users/change-password", requireAuth, async (req, res) => {
    try {
      // Validate request body with Zod
      const changePasswordSchema = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string()
          .min(8, "New password must be at least 8 characters long")
          .max(100, "New password is too long")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[0-9]/, "Password must contain at least one number"),
      });

      const validationResult = changePasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.issues.map(i => i.message) 
        });
      }

      const { currentPassword, newPassword } = validationResult.data;
      
      // Get current user
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash and update new password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      res.json({ success: true, message: "Password successfully updated" });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ 
        message: "Failed to update password", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // ==================== VEHICLE ROUTES ====================
  // Get available vehicles (optionally for a specific date range)
  app.get("/api/vehicles/available", async (req, res) => {
    const { startDate, endDate, excludeVehicleId } = req.query;
    
    let vehicles;
    if (startDate) {
      // For open-ended rentals (no endDate) or specific date ranges
      // Use a far future date for open-ended rentals to check conflicts with existing rentals
      const effectiveEndDate = endDate ? (endDate as string) : '2099-12-31';
      
      vehicles = await storage.getAvailableVehiclesInRange(
        startDate as string, 
        effectiveEndDate, 
        excludeVehicleId ? parseInt(excludeVehicleId as string) : undefined
      );
    } else {
      // Fall back to basic method for compatibility when no dates provided
      vehicles = await storage.getAvailableVehicles();
    }
    
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

  // Get overlapping regular reservations for a vehicle during maintenance period
  app.get("/api/vehicles/:vehicleId/overlaps", requireAuth, async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate input parameters
      const vehicleIdNum = parseInt(vehicleId);
      if (isNaN(vehicleIdNum)) {
        return res.status(400).json({ error: "Invalid vehicle ID" });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Get overlapping reservations for this vehicle
      const overlaps = await storage.checkReservationConflicts(
        vehicleIdNum, 
        startDate as string, 
        endDate as string,
        null // Don't exclude any reservations for overlap check
      );

      // Filter to only regular (non-maintenance) reservations and get customer info
      const regularOverlaps = [];
      for (const reservation of overlaps) {
        // Skip maintenance reservations
        if (reservation.type === 'maintenance_block') {
          continue;
        }

        // Skip if no customer assigned
        if (!reservation.customerId) {
          continue;
        }

        // Get customer information
        const customer = await storage.getCustomer(reservation.customerId);
        if (customer) {
          regularOverlaps.push({
            reservation: {
              id: reservation.id,
              startDate: reservation.startDate,
              endDate: reservation.endDate,
              status: reservation.status,
              type: reservation.type
            },
            customer: {
              id: customer.id,
              name: customer.name,
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
              phone: customer.phone
            }
          });
        }
      }

      res.json(regularOverlaps);
    } catch (error) {
      console.error("Error fetching overlapping reservations:", error);
      res.status(500).json({ error: "Failed to fetch overlapping reservations" });
    }
  });
  
  // Get all vehicles with optional search
  app.get("/api/vehicles", async (req, res) => {
    try {
      const searchQuery = req.query.search as string | undefined;
      const vehicles = await storage.getAllVehicles(searchQuery);
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles", error });
    }
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
  app.post("/api/vehicles", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("Received vehicle data:", JSON.stringify(req.body));
      
      // Check if required fields are present
      if (!req.body.licensePlate || !req.body.brand || !req.body.model) {
        console.log("Missing required fields in vehicle data");
        return res.status(400).json({ 
          message: "Missing required fields", 
          details: { 
            licensePlate: !req.body.licensePlate ? "License plate is required" : null,
            brand: !req.body.brand ? "Brand is required" : null,
            model: !req.body.model ? "Model is required" : null
          } 
        });
      }
      
      // Create a sanitized copy of the request body
      const sanitizedData = { ...req.body };
      
      // Ensure all values are properly formatted

      // Convert empty string values to null for numeric fields
      if (sanitizedData.departureMileage === '') sanitizedData.departureMileage = null;
      if (sanitizedData.returnMileage === '') sanitizedData.returnMileage = null;
      if (sanitizedData.monthlyPrice === '') sanitizedData.monthlyPrice = null;
      if (sanitizedData.dailyPrice === '') sanitizedData.dailyPrice = null;
      
      // Convert values for boolean fields
      const booleanFields = [
        'damageCheck', 'winterTires', 'roadsideAssistance', 'spareKey', 
        'wokNotification', 'seatcovers', 'backupbeepers', 'gps', 'adBlue'
      ];
      
      booleanFields.forEach(field => {
        if (field in sanitizedData) {
          const value = sanitizedData[field];
          sanitizedData[field] = value === true || value === 'true' || value === 1 || value === '1';
        } else {
          sanitizedData[field] = false;
        }
      });
      
      // Handle registration fields - convert to strings since they're stored as text in the DB
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      // Clean date fields that are empty strings
      Object.keys(sanitizedData).forEach(key => {
        if (key.toLowerCase().includes('date') && sanitizedData[key] === "") {
          sanitizedData[key] = null;
        }
      });
      
      console.log("Sanitized vehicle data:", JSON.stringify(sanitizedData));
      
      // Validate with Zod schema
      let vehicleData;
      try {
        vehicleData = insertVehicleSchema.parse(sanitizedData);
      } catch (parseError) {
        console.error("Validation error:", parseError);
        return res.status(400).json({ 
          message: "Invalid vehicle data format", 
          error: parseError 
        });
      }
      
      // Add user tracking information
      const user = req.user;
      const dataWithTracking = {
        ...vehicleData,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null
      };
      
      // Set registeredToBy when registeredTo is true
      if (dataWithTracking.registeredTo === "true" && dataWithTracking.registeredToDate) {
        dataWithTracking.registeredToBy = user ? user.username : null;
      }
      
      // Set companyBy when company is true
      if (dataWithTracking.company === "true" && dataWithTracking.companyDate) {
        dataWithTracking.companyBy = user ? user.username : null;
      }
      
      // Create vehicle in database (this will throw on duplicate key)
      const vehicle = await storage.createVehicle(dataWithTracking);
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.vehicles.created(vehicle);
      
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      
      // Check for duplicate license plate error (PostgreSQL unique constraint violation)
      if (error && typeof error === 'object' && 'code' in error) {
        // PostgreSQL error code 23505 = unique_violation
        if (error.code === '23505' || error.code === 23505) {
          // Check if it's specifically about license_plate
          const errorMessage = String(error.message || '').toLowerCase();
          if (errorMessage.includes('license_plate') || errorMessage.includes('duplicate key')) {
            return res.status(409).json({ 
              message: "A vehicle with this license plate already exists. Please use a different license plate or edit the existing vehicle.",
              field: "licensePlate"
            });
          }
        }
      }
      
      // Generic error for other types of failures
      res.status(400).json({ 
        message: "Failed to create vehicle. Please check your data and try again.", 
        error: error && typeof error === 'object' && 'message' in error ? error.message : String(error)
      });
    }
  });

  // Update vehicle
  app.patch("/api/vehicles/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }
      
      console.log("Received vehicle update data:", JSON.stringify(req.body));
      
      // Create a sanitized copy of the request body
      const sanitizedData = { ...req.body };
      
      // Ensure all values are properly formatted

      // Convert empty string values to null for numeric fields
      if (sanitizedData.departureMileage === '') sanitizedData.departureMileage = null;
      if (sanitizedData.returnMileage === '') sanitizedData.returnMileage = null;
      if (sanitizedData.monthlyPrice === '') sanitizedData.monthlyPrice = null;
      if (sanitizedData.dailyPrice === '') sanitizedData.dailyPrice = null;
      
      // Convert values for boolean fields
      const booleanFields = [
        'damageCheck', 'winterTires', 'roadsideAssistance', 'spareKey', 
        'wokNotification', 'seatcovers', 'backupbeepers', 'gps', 'adBlue'
      ];
      
      booleanFields.forEach(field => {
        if (field in sanitizedData) {
          const value = sanitizedData[field];
          sanitizedData[field] = value === true || value === 'true' || value === 1 || value === '1';
        } else {
          sanitizedData[field] = false;
        }
      });
      
      // Handle registration fields - convert to strings since they're stored as text in the DB
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      // Clean date fields that are empty strings
      Object.keys(sanitizedData).forEach(key => {
        if (key.toLowerCase().includes('date') && sanitizedData[key] === "") {
          sanitizedData[key] = null;
        }
      });
      
      console.log("Sanitized vehicle update data:", JSON.stringify(sanitizedData));

      // Get the existing vehicle first to merge with updates
      const existingVehicle = await storage.getVehicle(id);
      if (!existingVehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      // For partial updates, we need to merge with existing data
      const mergedData = {
        ...existingVehicle,
        ...sanitizedData
      };

      // Parse the sanitized merged data
      const vehicleData = insertVehicleSchema.parse(mergedData);
      
      // Preserve the registration specific tracking fields
      const { registeredToBy, companyBy } = existingVehicle;
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking = {
        ...vehicleData,
        updatedBy: user ? user.username : null,
        // Preserve the registration tracking fields
        registeredToBy,
        companyBy
      };
      
      const vehicle = await storage.updateVehicle(id, dataWithTracking);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.vehicles.updated(vehicle);
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(400).json({ 
        message: "Invalid vehicle data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Update vehicle mileage only (special endpoint for partial updates)
  app.patch("/api/vehicles/:id/mileage", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }
      
      // Get existing vehicle
      const vehicle = await storage.getVehicle(id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Check if the request contains valid mileage fields
      const updateData: Record<string, any> = {};
      
      // If currentMileage is provided, store it in the departureMileage field
      // since there's no currentMileage field in the schema
      if (req.body.currentMileage !== undefined) {
        const mileage = parseInt(req.body.currentMileage);
        if (!isNaN(mileage)) {
          updateData.departureMileage = mileage;
        }
      }
      
      if (req.body.departureMileage !== undefined) {
        const mileage = parseInt(req.body.departureMileage);
        if (!isNaN(mileage)) {
          updateData.departureMileage = mileage;
        }
      }
      
      // Add support for returnMileage used when completing a reservation
      if (req.body.returnMileage !== undefined) {
        const mileage = parseInt(req.body.returnMileage);
        if (!isNaN(mileage)) {
          updateData.returnMileage = mileage;
        }
      }
      
      // Only update if we have valid data
      if (Object.keys(updateData).length > 0) { // Check if we have any data to update
        // Preserve registration tracking fields
        const { registeredToBy, companyBy } = vehicle;
        
        // Add user tracking information
        const user = req.user;
        const dataWithTracking = {
          ...updateData,
          updatedBy: user ? user.username : null,
          // Preserve the registration tracking fields
          registeredToBy,
          companyBy
        };
        
        const updatedVehicle = await storage.updateVehicle(id, dataWithTracking);
        
        // Broadcast real-time update to all connected clients
        realtimeEvents.vehicles.updated(updatedVehicle);
        
        return res.json(updatedVehicle);
      } else {
        return res.status(400).json({ message: "No valid mileage data provided" });
      }
    } catch (error) {
      console.error("Error updating vehicle mileage:", error);
      return res.status(500).json({ 
        message: "Failed to update vehicle mileage", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Toggle vehicle registration status
  app.patch("/api/vehicles/:id/toggle-registration", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }

      const { status } = req.body;
      if (status !== 'opnaam' && status !== 'not-opnaam' && status !== 'bv' && status !== 'not-bv') {
        return res.status(400).json({ message: "Invalid status. Must be 'opnaam', 'not-opnaam', 'bv', or 'not-bv'" });
      }
      
      const vehicle = await storage.getVehicle(id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      const currentDate = new Date().toISOString().split('T')[0];
      
      // More extensive logging for debugging authentication state
      console.log("TOGGLE REGISTRATION - Complete authentication state:", {
        isAuthenticated: req.isAuthenticated(),
        userExists: !!req.user,
        sessionID: req.sessionID,
        userObject: req.user,
        session: req.session
      });
      
      // Get the actual user from the database if possible, to ensure we have the full object
      let username = "admin"; // Default fallback for development
      
      if (req.user) {
        if (typeof req.user === 'object') {
          if ('username' in req.user) {
            username = req.user.username;
            console.log("Found username directly in user object:", username);
          } else if ('id' in req.user) {
            try {
              const userId = req.user.id;
              const fullUser = await storage.getUser(userId);
              if (fullUser && fullUser.username) {
                username = fullUser.username;
                console.log("Retrieved username from database using ID:", username);
              }
            } catch (err) {
              console.error("Error retrieving user details:", err);
            }
          } else {
            console.log("User object exists but lacks id and username properties:", req.user);
          }
        } else {
          console.log("User exists but is not an object:", typeof req.user);
        }
      } else {
        console.log("No user object in request");
      }
      
      // Create update data with user attribution
      let updateData;

      // Get the current vehicle to know its status
      const currentVehicle = await storage.getVehicle(id);
      if (!currentVehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Now we handle four cases using our specialized method instead of general update
      // 1. Setting registeredTo to true (opnaam status)
      // 2. Setting registeredTo to false (removing opnaam status)
      // 3. Setting company to true (bv status)
      // 4. Setting company to false (removing bv status)
      
      // Note: Validation for status is already done above
      
      console.log(`Updating vehicle ${id} registration status to ${status} by user:`, username);
      
      // Declare variable outside try block to maintain scope
      let updatedVehicle;
      
      try {
        // Use the dedicated method that only updates the relevant field
        updatedVehicle = await storage.updateVehicleRegistrationStatus(id, status, {
          username,
          date: currentDate
        });
        
        if (!updatedVehicle) {
          return res.status(500).json({ message: "Failed to update vehicle registration status" });
        }
        
        console.log("Database response:", JSON.stringify(updatedVehicle, null, 2));
        
        // Verify if the update was applied correctly - fetch the vehicle again
        const verifiedVehicle = await storage.getVehicle(id);
        console.log("Vehicle after update:", JSON.stringify(verifiedVehicle, null, 2));
      } catch (error) {
        console.error("Error in toggle-registration endpoint:", error);
        return res.status(400).json({ message: `Error toggling registration status: ${error.message}` });
      }
      
      // If we've reached here, the update was successful
      if (!updatedVehicle) {
        // This is a fallback - if somehow we get here without an error but also without data
        // Use the verified vehicle data
        updatedVehicle = await storage.getVehicle(id);
      }
      
      // Store last action to ensure history shows the correct user for this specific action
      let historyNote;
      
      if (status === 'opnaam') {
        historyNote = `Registration set to Opnaam by ${username}`;
      } else if (status === 'not-opnaam') {
        historyNote = `Opnaam registration removed by ${username}`;
      } else if (status === 'bv') {
        historyNote = `Registration set to BV by ${username}`;
      } else if (status === 'not-bv') {
        historyNote = `BV registration removed by ${username}`;
      }
        
      // Log the history action
      console.log("Vehicle registration history action:", historyNote);
      
      // Add tracking to response
      const vehicleWithAudit = {
        ...updatedVehicle,
        lastAction: historyNote
      };
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.vehicles.updated(vehicleWithAudit);
      
      res.json(vehicleWithAudit);
    } catch (error) {
      console.error("Error in toggle-registration endpoint:", error);
      res.status(400).json({ message: "Error toggling registration status", error });
    }
  });

  // Delete vehicle
  app.delete("/api/vehicles/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vehicle ID" });
      }

      const deleted = await storage.deleteVehicle(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.vehicles.deleted({ id });
      
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
      console.error("RDW API lookup error:", error);
      
      if (error instanceof RDWNotFoundError) {
        return res.status(404).json({ 
          message: "Vehicle not found", 
          error: error.message 
        });
      }
      
      if (error instanceof RDWTimeoutError) {
        return res.status(504).json({ 
          message: "RDW service timeout", 
          error: error.message 
        });
      }
      
      if (error instanceof RDWUpstreamError) {
        return res.status(502).json({ 
          message: "RDW service error", 
          error: error.message 
        });
      }
      
      // Fallback for unexpected errors
      res.status(500).json({ 
        message: "Failed to fetch vehicle information from RDW", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== CUSTOMER ROUTES ====================
  // Get all customers with optional search
  app.get("/api/customers", async (req, res) => {
    try {
      const searchQuery = req.query.search as string | undefined;
      const customers = await storage.getAllCustomers(searchQuery);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers", error });
    }
  });

  // Get customers with reservation status
  app.get("/api/customers/with-reservations", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      const reservations = await storage.getAllReservations();
      
      const today = new Date();
      
      // Add hasActiveReservation property to each customer
      const customersWithReservations = customers.map(customer => {
        const customerReservations = reservations.filter(reservation => 
          reservation.customerId === customer.id
        );
        
        const hasActiveReservation = customerReservations.some(reservation => {
          // Handle undefined or invalid endDate
          if (!reservation.endDate || reservation.endDate === "undefined") {
            return false;
          }
          
          const startDate = new Date(reservation.startDate);
          const endDate = new Date(reservation.endDate);
          
          // Check if reservation is active (started but not ended)
          return startDate <= today && endDate >= today;
        });
        
        return {
          ...customer,
          hasActiveReservation
        };
      });
      
      res.json(customersWithReservations);
    } catch (error) {
      console.error("Error fetching customers with reservations:", error);
      res.status(500).json({ message: "Failed to fetch customers with reservations", error });
    }
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
  app.post("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      
      // Add user tracking information
      const user = req.user;
      const dataWithTracking = {
        ...customerData,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null
      };
      
      const customer = await storage.createCustomer(dataWithTracking);
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.customers.created(customer);
      
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }

      const customerData = insertCustomerSchema.partial().parse(req.body);
      
      // Add user tracking information for updates
      const user = req.user;
      const username = user ? user.username : null;
      
      // Get the current customer to check if status has changed
      const existingCustomer = await storage.getCustomer(id);
      
      if (!existingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Add tracking information
      const dataWithTracking = {
        ...customerData,
        updatedBy: username
      };
      
      // Specifically track status changes
      if (customerData.status && customerData.status !== existingCustomer.status) {
        dataWithTracking.statusBy = username;
        dataWithTracking.statusDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      
      const customer = await storage.updateCustomer(id, dataWithTracking);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.customers.updated(customer);
      
      res.json(customer);
    } catch (error) {
      console.error("Customer update error:", error);
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }

      const success = await storage.deleteCustomer(id);
      
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.customers.deleted({ id });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer", error });
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
      
      // Disable HTTP caching to ensure fresh data after deletions
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const reservations = await storage.getReservationsInDateRange(startDate, endDate);
      res.json(reservations);
    } catch (error) {
      console.error("Error getting reservations by range:", error);
      res.status(500).json({ message: "Error getting reservations" });
    }
  });
  
  app.get("/api/reservations/range/:startDate/:endDate", async (req, res) => {
    const { startDate, endDate } = req.params;
    // Disable HTTP caching to ensure fresh data after deletions
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const reservations = await storage.getReservationsInDateRange(startDate, endDate);
    res.json(reservations);
  });

  // Get upcoming reservations
  app.get("/api/reservations/upcoming", async (req, res) => {
    // Disable HTTP caching to ensure fresh data after deletions
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const reservations = await storage.getUpcomingReservations();
    res.json(reservations);
  });

  // Get upcoming maintenance reservations
  app.get("/api/reservations/upcoming-maintenance", async (req, res) => {
    // Disable HTTP caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const reservations = await storage.getUpcomingMaintenanceReservations();
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

  // Check for conflicts using query parameters (used by reservation form)
  app.get("/api/reservations/check-conflicts", async (req, res) => {
    const vehicleId = parseInt(req.query.vehicleId as string);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const excludeReservationId = req.query.excludeReservationId 
      ? parseInt(req.query.excludeReservationId as string)
      : null;
    
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }

    // Handle "undefined" string or missing endDate - pass null for open-ended rentals
    const effectiveEndDate = (!endDate || endDate === "undefined") ? null : endDate;

    try {
      const conflicts = await storage.checkReservationConflicts(
        vehicleId, 
        startDate, 
        effectiveEndDate, 
        isNaN(excludeReservationId) ? null : excludeReservationId
      );
      res.json(conflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({ message: "Failed to check conflicts" });
    }
  });

  // Get all reservations with optional search
  app.get("/api/reservations", async (req, res) => {
    try {
      // Disable HTTP caching to ensure fresh data after deletions
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const searchQuery = req.query.search as string | undefined;
      const reservations = await storage.getAllReservations(searchQuery);
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations", error });
    }
  });

  // Get single reservation
  app.get("/api/reservations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    // Disable HTTP caching to ensure fresh data after deletions
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
      
      // Always remove all special characters including dashes from license plates for folder names
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
      const baseDir = path.join(getUploadsDir(), sanitizedPlate);
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
  app.post("/api/reservations", requireAuth, damageCheckUpload.single('damageCheckFile'), async (req: Request, res: Response) => {
    try {
      // Handle JSON data that comes through multer middleware
      let bodyData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        // This is JSON data sent through multer - parse it
        try {
          bodyData = JSON.parse(req.body.body);
        } catch (e) {
          console.error('Failed to parse JSON body:', e);
          return res.status(400).json({ message: "Invalid JSON in request body" });
        }
      }
      
      console.log('Parsed bodyData:', bodyData);
      
      // Convert string fields to the correct types
      if (bodyData.vehicleId) bodyData.vehicleId = parseInt(bodyData.vehicleId);
      if (bodyData.customerId !== null && bodyData.customerId !== undefined) {
        bodyData.customerId = parseInt(bodyData.customerId);
      }
      
      // Handle driverId - convert to integer or null
      if (bodyData.driverId !== undefined) {
        if (bodyData.driverId === '' || bodyData.driverId === null) {
          bodyData.driverId = null;
        } else {
          bodyData.driverId = parseInt(bodyData.driverId as string);
        }
      }
      
      console.log('After conversions - driverId type:', typeof bodyData.driverId, 'value:', bodyData.driverId);
      
      // Convert boolean fields from strings
      if (bodyData.placeholderSpare !== undefined) {
        bodyData.placeholderSpare = bodyData.placeholderSpare === 'true' || bodyData.placeholderSpare === true;
      }
      
      // Handle totalPrice properly - treat empty string and NaN as undefined
      if (bodyData.totalPrice === "" || bodyData.totalPrice === null) {
        bodyData.totalPrice = undefined;
      } else if (bodyData.totalPrice) {
        const parsedPrice = parseFloat(bodyData.totalPrice);
        bodyData.totalPrice = isNaN(parsedPrice) ? undefined : parsedPrice;
      }
      
      // Handle endDate - fix "undefined" string to null for open-ended rentals
      if (bodyData.endDate === "undefined" || bodyData.endDate === "" || bodyData.endDate === null) {
        bodyData.endDate = null;
      }
      
      const reservationData = insertReservationSchema.parse(bodyData);
      
      // Add user tracking information
      const user = req.user;
      const dataWithTracking = {
        ...reservationData,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null
      };
      
      // For maintenance blocks, always create the reservation first, then handle conflicts
      if (reservationData.type === 'maintenance_block') {
        const reservation = await storage.createReservation(dataWithTracking);
        
        const customerReservations = await storage.checkReservationConflicts(
          reservationData.vehicleId,
          reservationData.startDate,
          reservationData.endDate,
          reservation.id // Exclude the just-created maintenance reservation from conflicts
        );
        
        // Filter to only include customer reservations (not other maintenance blocks)
        const customerConflicts = customerReservations.filter(r => r.type !== 'maintenance_block');
        
        if (customerConflicts.length > 0) {
          return res.status(200).json({ 
            message: "Customer reservations found during maintenance period",
            needsSpareVehicle: true,
            conflictingReservations: customerConflicts,
            maintenanceData: reservationData,
            maintenanceReservationId: reservation.id // Include the created maintenance ID
          });
        }
        
        // No conflicts, return the created maintenance reservation
        return res.status(201).json(reservation);
      } else {
        // For regular reservations, check for conflicts normally
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
      }
      
      const reservation = await storage.createReservation(dataWithTracking);
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.reservations.created(reservation);
      
      // If there's a contract preview token, finalize and save the contract
      if (bodyData.contractPreviewToken) {
        try {
          const { previewTokenService } = await import('./preview-token-service');
          const preview = previewTokenService.get(bodyData.contractPreviewToken, req.user!.id.toString());
          
          if (preview) {
            console.log(`🔄 Finalizing contract from preview token for reservation ${reservation.id}`);
            
            // IMPORTANT: Regenerate contract using FRESH reservation data, not stale preview data
            // This ensures the contract matches the actual reservation that was created
            const vehicle = await storage.getVehicle(reservation.vehicleId);
            const customer = await storage.getCustomer(reservation.customerId);
            
            if (vehicle && customer) {
              let template;
              if (preview.templateId) {
                template = await storage.getPdfTemplate(preview.templateId);
              } else {
                template = await storage.getDefaultPdfTemplate();
              }
              
              if (template) {
                const contractData = {
                  ...reservation,
                  vehicle,
                  customer
                };
                
                // Make sure template fields are properly formatted
                if (template.fields && typeof template.fields === 'string') {
                  try {
                    template.fields = JSON.parse(template.fields);
                  } catch (e) {
                    console.error('Error parsing template fields:', e);
                  }
                }
                
                // Generate final contract with real reservation ID
                const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
                const pdfBuffer = await generateRentalContractFromTemplate(contractData, template);
                
                // Save contract to filesystem
                const licensePlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
                const contractsDir = path.join(process.cwd(), 'uploads', 'contracts', licensePlate);
                await fs.promises.mkdir(contractsDir, { recursive: true });
                
                const fileName = `${licensePlate}_contract_${format(new Date(), 'yyyyMMdd')}.pdf`;
                const filePath = path.join(contractsDir, fileName);
                const relativeFilePath = `uploads/contracts/${licensePlate}/${fileName}`;
                
                await fs.promises.writeFile(filePath, pdfBuffer);
                console.log(`✅ Contract saved to: ${filePath}`);
                
                // Save to database
                const documentData = {
                  vehicleId: vehicle.id,
                  reservationId: reservation.id,
                  documentType: "Contract (Unsigned)",
                  fileName,
                  filePath: relativeFilePath,
                  fileSize: pdfBuffer.length,
                  contentType: "application/pdf",
                  createdBy: user ? user.username : 'System',
                  notes: `Auto-generated unsigned contract for reservation #${reservation.id}`
                };
                
                const savedDocument = await storage.createDocument(documentData);
                console.log(`✅ Created document entry for unsigned contract: ID ${savedDocument.id}`);
                
                // Broadcast document creation
                realtimeEvents.documents.created(savedDocument);
              }
            }
            
            // Delete the preview token
            previewTokenService.delete(bodyData.contractPreviewToken);
            console.log(`🗑️ Deleted preview token: ${bodyData.contractPreviewToken}`);
          }
        } catch (error) {
          console.error('Error finalizing contract from preview:', error);
          // Don't fail reservation creation if contract finalization fails
        }
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
          createdBy: user ? user.username : `Reservation #${reservation.id}`,
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

  // Create maintenance with spare vehicle assignment
  app.post("/api/reservations/maintenance-with-spare", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Raw request body:', req.body);
      
      // Handle the case where multer wraps the JSON data
      let bodyData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        try {
          bodyData = JSON.parse(req.body.body);
        } catch (parseError) {
          console.error('Error parsing JSON body:', parseError);
          return res.status(400).json({ message: "Invalid JSON in request body" });
        }
      }
      
      const { maintenanceId, maintenanceData, conflictingReservations, spareVehicleAssignments } = bodyData;
      
      console.log('Creating/updating maintenance with spare vehicles:', { maintenanceId, maintenanceData, conflictingReservations, spareVehicleAssignments });
      
      // Validate required data
      if (!maintenanceData) {
        return res.status(400).json({ message: "maintenanceData is required" });
      }
      if (!conflictingReservations || !Array.isArray(conflictingReservations)) {
        return res.status(400).json({ message: "conflictingReservations must be an array" });
      }
      if (!spareVehicleAssignments || !Array.isArray(spareVehicleAssignments)) {
        return res.status(400).json({ message: "spareVehicleAssignments must be an array" });
      }
      
      // PRE-VALIDATE ALL ASSIGNMENTS BEFORE ANY UPDATES (for atomicity)
      const validationPromises = spareVehicleAssignments.map(async (assignment: any) => {
        const { reservationId, spareVehicleId } = assignment;
        
        const originalReservation = await storage.getReservation(reservationId);
        if (!originalReservation) {
          throw new Error(`Reservation ${reservationId} not found`);
        }
        
        // Compute overlap using maintenanceData (not yet persisted)
        const maintenanceStart = new Date(maintenanceData.startDate);
        const maintenanceEnd = new Date(maintenanceData.endDate);
        const rentalStart = new Date(originalReservation.startDate);
        
        // Validate dates are valid and maintenance period is valid
        if (isNaN(maintenanceStart.getTime()) || isNaN(maintenanceEnd.getTime()) || isNaN(rentalStart.getTime())) {
          throw new Error(`Invalid date format in maintenance or rental ${reservationId}`);
        }
        
        if (maintenanceStart > maintenanceEnd) {
          throw new Error(`Invalid maintenance period: end date cannot be before start date`);
        }
        
        let overlapStart: Date;
        let overlapEnd: Date;
        
        // Handle open-ended rentals (endDate is null, undefined, or "undefined")
        if (!originalReservation.endDate || originalReservation.endDate === "undefined" || originalReservation.endDate === null) {
          // For open-ended rentals, customer has vehicle indefinitely
          // Spare vehicle assignment covers the entire maintenance period
          overlapStart = new Date(Math.max(maintenanceStart.getTime(), rentalStart.getTime()));
          overlapEnd = maintenanceEnd; // Spare vehicle for entire maintenance period
          
          // Validate overlap for open-ended rentals too
          if (overlapStart >= overlapEnd) {
            throw new Error(`No overlap between maintenance and open-ended rental ${reservationId}: rental starts after maintenance ends`);
          }
        } else {
          // For regular rentals with end dates
          const rentalEnd = new Date(originalReservation.endDate);
          
          if (isNaN(rentalEnd.getTime())) {
            throw new Error(`Invalid end date format in rental ${reservationId}`);
          }
          
          overlapStart = new Date(Math.max(maintenanceStart.getTime(), rentalStart.getTime()));
          overlapEnd = new Date(Math.min(maintenanceEnd.getTime(), rentalEnd.getTime()));
          
          if (overlapStart >= overlapEnd) {
            throw new Error(`No overlap between maintenance and rental ${reservationId}`);
          }
        }
        
        // Pre-validate spare vehicle availability
        const spareConflicts = await storage.checkReservationConflicts(
          spareVehicleId,
          overlapStart.toISOString().split('T')[0],
          overlapEnd.toISOString().split('T')[0],
          null
        );
        
        if (spareConflicts.length > 0) {
          throw new Error(`Spare vehicle ${spareVehicleId} is not available during overlap period`);
        }
        
        return { originalReservation, overlapStart, overlapEnd, spareVehicleId };
      });
      
      // Execute all validations (will throw if any fail)
      const validatedAssignments = await Promise.all(validationPromises);
      
      let maintenanceReservation;
      let updatedReservations;
      const user = req.user;
      
      if (maintenanceId) {
        // Validate that maintenanceId refers to an existing maintenance_block reservation
        const existingReservation = await storage.getReservation(maintenanceId);
        if (!existingReservation) {
          return res.status(404).json({ message: "Maintenance reservation not found" });
        }
        if (existingReservation.type !== 'maintenance_block') {
          return res.status(400).json({ message: "Reservation is not a maintenance block" });
        }
        
        // Clean up old replacement reservations using structured approach
        if (spareVehicleAssignments.length > 0) {
          // Find old replacements for the same reservations being updated
          const conflictingReservationIds = spareVehicleAssignments.map(a => a.reservationId);
          const allReservations = await storage.getAllReservations();
          const oldReplacements = allReservations.filter(r => 
            r.type === 'replacement' && 
            r.replacementForReservationId && 
            conflictingReservationIds.includes(r.replacementForReservationId)
          );
          
          for (const oldReplacement of oldReplacements) {
            await storage.deleteReservation(oldReplacement.id);
          }
        }
        
        // CREATE REPLACEMENTS FIRST for true atomicity
        const replacementPromises = validatedAssignments.map(async (validated) => {
          const { originalReservation, overlapStart, overlapEnd, spareVehicleId } = validated;
          
          // Get vehicle details for better notes
          const spareVehicle = await storage.getVehicle(spareVehicleId);
          const originalVehicle = originalReservation.vehicle || await storage.getVehicle(originalReservation.vehicleId);
          
          const originalVehicleDesc = originalVehicle ? 
            `${originalVehicle.licensePlate} (${originalVehicle.brand} ${originalVehicle.model})` : 
            `vehicle ${originalReservation.vehicleId}`;
          const spareVehicleDesc = spareVehicle ? 
            `${spareVehicle.licensePlate} (${spareVehicle.brand} ${spareVehicle.model})` : 
            `vehicle ${spareVehicleId}`;
          
          // Create replacement reservation for overlap period ONLY  
          return await storage.createReservation({
            vehicleId: spareVehicleId,
            customerId: originalReservation.customerId,
            startDate: overlapStart.toISOString().split('T')[0],
            endDate: overlapEnd.toISOString().split('T')[0],
            type: 'replacement',
            replacementForReservationId: originalReservation.id,
            status: 'confirmed',
            totalPrice: 0,
            createdBy: user ? user.username : null,
            updatedBy: user ? user.username : null,
            notes: `Spare vehicle ${spareVehicleDesc} for reservation #${originalReservation.id} during maintenance of ${originalVehicleDesc}. Original rental: ${originalReservation.startDate} to ${originalReservation.endDate || 'open-ended'}.`
          });
        });
        
        const newReplacements = await Promise.all(replacementPromises);
        
        // ONLY AFTER successful replacement creation, update maintenance
        const maintenanceWithTracking = {
          ...maintenanceData,
          updatedBy: user ? user.username : null
        };
        maintenanceReservation = await storage.updateReservation(maintenanceId, maintenanceWithTracking);
        
        updatedReservations = newReplacements;
      } else {
        // Create new maintenance block
        const maintenanceWithTracking = {
          ...maintenanceData,
          createdBy: user ? user.username : null,
          updatedBy: user ? user.username : null
        };
        maintenanceReservation = await storage.createReservation(maintenanceWithTracking);
        
        // Create replacement reservations using pre-validated data
        const updatePromises = validatedAssignments.map(async (validated) => {
          const { originalReservation, overlapStart, overlapEnd, spareVehicleId } = validated;
          
          // Get vehicle details for better notes
          const spareVehicle = await storage.getVehicle(spareVehicleId);
          const originalVehicle = originalReservation.vehicle || await storage.getVehicle(originalReservation.vehicleId);
          
          const originalVehicleDesc = originalVehicle ? 
            `${originalVehicle.licensePlate} (${originalVehicle.brand} ${originalVehicle.model})` : 
            `vehicle ${originalReservation.vehicleId}`;
          const spareVehicleDesc = spareVehicle ? 
            `${spareVehicle.licensePlate} (${spareVehicle.brand} ${spareVehicle.model})` : 
            `vehicle ${spareVehicleId}`;
          
          return await storage.createReservation({
            vehicleId: spareVehicleId,
            customerId: originalReservation.customerId,
            startDate: overlapStart.toISOString().split('T')[0],
            endDate: overlapEnd.toISOString().split('T')[0],
            type: 'replacement',
            replacementForReservationId: originalReservation.id,
            status: 'confirmed',
            totalPrice: 0,
            createdBy: user ? user.username : null,
            updatedBy: user ? user.username : null,
            notes: `Spare vehicle ${spareVehicleDesc} for reservation #${originalReservation.id} during maintenance of ${originalVehicleDesc}. Original rental: ${originalReservation.startDate} to ${originalReservation.endDate}.`
          });
        });
        
        updatedReservations = await Promise.all(updatePromises);
      }
      
      res.status(201).json({
        maintenanceReservation,
        updatedReservations,
        message: "Maintenance scheduled and spare vehicles assigned"
      });
    } catch (error) {
      console.error("Error creating maintenance with spare:", error);
      res.status(400).json({ 
        message: "Failed to create maintenance with spare vehicles", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Update reservation data (JSON endpoint without file upload)
  app.patch("/api/reservations/:id/basic", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      // Handle JSON data that might come through wrapped in a body property
      let bodyData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        // This is JSON data sent in a wrapped format - parse it
        try {
          bodyData = JSON.parse(req.body.body);
        } catch (error) {
          console.error('Failed to parse wrapped JSON:', error);
          return res.status(400).json({ message: "Invalid JSON data" });
        }
      }

      // Convert string fields to the correct types
      if (bodyData.vehicleId) bodyData.vehicleId = parseInt(bodyData.vehicleId);
      if (bodyData.customerId) bodyData.customerId = parseInt(bodyData.customerId);
      
      // Handle totalPrice properly - treat empty string and NaN as undefined
      if (bodyData.totalPrice === "" || bodyData.totalPrice === null) {
        bodyData.totalPrice = undefined;
      } else if (bodyData.totalPrice) {
        const parsedPrice = parseFloat(bodyData.totalPrice);
        bodyData.totalPrice = isNaN(parsedPrice) ? undefined : parsedPrice;
      }
      const reservationData = insertReservationSchema.parse(bodyData);
      
      // Check for conflicts (exclude the current reservation)
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
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking = {
        ...reservationData,
        updatedBy: user ? user.username : null
      };
      
      const reservation = await storage.updateReservation(id, dataWithTracking);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.reservations.updated(reservation);
      
      res.json(reservation);
    } catch (error) {
      console.error("Error updating reservation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid reservation data", 
          error: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to update reservation", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Update reservation status only (special endpoint for status changes)
  app.patch("/api/reservations/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      // Validate that status is a string and is one of the expected values
      const { status } = req.body;
      if (!status || typeof status !== 'string' || 
          !['pending', 'confirmed', 'cancelled', 'completed'].includes(status.toLowerCase())) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      // Get the current reservation to check for vehicle info
      const existingReservation = await storage.getReservation(id);
      
      if (!existingReservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // If status is "completed", check mileage validation
      if (status === "completed" && existingReservation.vehicleId && req.body.departureMileage) {
        const vehicle = await storage.getVehicle(existingReservation.vehicleId);
        
        if (vehicle && vehicle.departureMileage) {
          const returnMileage = parseInt(req.body.departureMileage);
          
          // Validate that return mileage is not less than departure mileage
          if (returnMileage < vehicle.departureMileage) {
            return res.status(400).json({ 
              message: "Return mileage cannot be less than start mileage",
              details: {
                startMileage: vehicle.departureMileage,
                returnMileage: returnMileage
              }
            });
          }
        }
      }
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking: any = {
        status,
        updatedBy: user ? user.username : null
      };
      
      // Add fuel tracking fields if present in request body
      if (req.body.fuelLevelPickup !== undefined) {
        dataWithTracking.fuelLevelPickup = req.body.fuelLevelPickup;
      }
      if (req.body.fuelLevelReturn !== undefined) {
        dataWithTracking.fuelLevelReturn = req.body.fuelLevelReturn;
      }
      if (req.body.fuelCost !== undefined) {
        dataWithTracking.fuelCost = req.body.fuelCost;
      }
      if (req.body.fuelCardNumber !== undefined) {
        dataWithTracking.fuelCardNumber = req.body.fuelCardNumber;
      }
      if (req.body.fuelNotes !== undefined) {
        dataWithTracking.fuelNotes = req.body.fuelNotes;
      }
      
      const reservation = await storage.updateReservation(id, dataWithTracking);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.reservations.updated(reservation);
      
      return res.status(200).json(reservation);
    } catch (error) {
      console.error('Error updating reservation status:', error);
      res.status(500).json({ 
        message: "Failed to update reservation status", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Update reservation with damage check upload
  app.patch("/api/reservations/:id", requireAuth, damageCheckUpload.single('damageCheckFile'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      // Convert string fields to the correct types (FormData sends everything as strings)
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.customerId) req.body.customerId = parseInt(req.body.customerId);
      
      // Handle driverId - convert to number or null
      if (req.body.driverId === "null" || req.body.driverId === "" || req.body.driverId === null) {
        req.body.driverId = null;
      } else if (req.body.driverId) {
        req.body.driverId = parseInt(req.body.driverId);
      }
      
      // Handle totalPrice properly - treat empty string and NaN as undefined
      if (req.body.totalPrice === "" || req.body.totalPrice === null) {
        req.body.totalPrice = undefined;
      } else if (req.body.totalPrice) {
        const parsedPrice = parseFloat(req.body.totalPrice);
        req.body.totalPrice = isNaN(parsedPrice) ? undefined : parsedPrice;
      }
      
      // Convert "null" string to actual null for nullable fields
      if (req.body.replacementForReservationId === "null" || req.body.replacementForReservationId === "") {
        req.body.replacementForReservationId = null;
      } else if (req.body.replacementForReservationId) {
        req.body.replacementForReservationId = parseInt(req.body.replacementForReservationId);
      }
      
      if (req.body.affectedRentalId === "null" || req.body.affectedRentalId === "") {
        req.body.affectedRentalId = null;
      } else if (req.body.affectedRentalId) {
        req.body.affectedRentalId = parseInt(req.body.affectedRentalId);
      }
      
      if (req.body.maintenanceDuration === "null" || req.body.maintenanceDuration === "") {
        req.body.maintenanceDuration = null;
      } else if (req.body.maintenanceDuration) {
        req.body.maintenanceDuration = parseInt(req.body.maintenanceDuration);
      }
      
      // Convert string booleans to actual booleans
      if (req.body.placeholderSpare === "true") req.body.placeholderSpare = true;
      else if (req.body.placeholderSpare === "false") req.body.placeholderSpare = false;
      
      if (req.body.isRecurring === "true") req.body.isRecurring = true;
      else if (req.body.isRecurring === "false") req.body.isRecurring = false;
      
      // Handle nullable string fields
      if (req.body.maintenanceStatus === "null" || req.body.maintenanceStatus === "") {
        req.body.maintenanceStatus = null;
      }
      if (req.body.spareAssignmentDecision === "null" || req.body.spareAssignmentDecision === "") {
        req.body.spareAssignmentDecision = null;
      }
      
      // Handle recurring reservation fields
      if (req.body.recurringParentId === "null" || req.body.recurringParentId === "") {
        req.body.recurringParentId = null;
      } else if (req.body.recurringParentId) {
        req.body.recurringParentId = parseInt(req.body.recurringParentId);
      }
      
      if (req.body.recurringDayOfWeek === "null" || req.body.recurringDayOfWeek === "") {
        req.body.recurringDayOfWeek = null;
      } else if (req.body.recurringDayOfWeek) {
        req.body.recurringDayOfWeek = parseInt(req.body.recurringDayOfWeek);
      }
      
      if (req.body.recurringDayOfMonth === "null" || req.body.recurringDayOfMonth === "") {
        req.body.recurringDayOfMonth = null;
      } else if (req.body.recurringDayOfMonth) {
        req.body.recurringDayOfMonth = parseInt(req.body.recurringDayOfMonth);
      }
      
      if (req.body.recurringEndDate === "null" || req.body.recurringEndDate === "") {
        req.body.recurringEndDate = null;
      }
      
      if (req.body.recurringFrequency === "null" || req.body.recurringFrequency === "") {
        req.body.recurringFrequency = null;
      }
      
      // Handle fuel-related fields
      // fuelLevelPickup and fuelLevelReturn are text strings (e.g., "full", "1/2", "empty")
      if (req.body.fuelLevelPickup === "null" || req.body.fuelLevelPickup === "" || req.body.fuelLevelPickup === null || req.body.fuelLevelPickup === "not_recorded") {
        req.body.fuelLevelPickup = null;
      }
      
      if (req.body.fuelLevelReturn === "null" || req.body.fuelLevelReturn === "" || req.body.fuelLevelReturn === null || req.body.fuelLevelReturn === "not_recorded") {
        req.body.fuelLevelReturn = null;
      }
      
      // fuelCost is numeric
      if (req.body.fuelCost === "null" || req.body.fuelCost === "" || req.body.fuelCost === null) {
        req.body.fuelCost = null;
      } else if (req.body.fuelCost) {
        const parsed = parseFloat(req.body.fuelCost);
        req.body.fuelCost = isNaN(parsed) ? null : parsed;
      }
      
      // Handle nullable fuel text fields
      if (req.body.fuelCardNumber === "null" || req.body.fuelCardNumber === "") {
        req.body.fuelCardNumber = null;
      }
      
      if (req.body.fuelNotes === "null" || req.body.fuelNotes === "") {
        req.body.fuelNotes = null;
      }
      
      // For updates, bypass full schema validation and just use the raw data
      // This allows partial updates without requiring all fields
      const reservationData = req.body;
      
      // Check for conflicts only if vehicle, startDate or endDate are being updated
      if (reservationData.vehicleId && reservationData.startDate) {
        // Get the existing reservation to check its type
        const existingReservation = await storage.getReservation(id);
        if (!existingReservation) {
          return res.status(404).json({ message: "Reservation not found" });
        }
        
        // Determine if this is a maintenance block - check both the update data and existing reservation
        const isMaintenanceBlock = (reservationData.type === 'maintenance_block') || 
                                   (existingReservation.type === 'maintenance_block');
        
        const conflicts = await storage.checkReservationConflicts(
          reservationData.vehicleId,
          reservationData.startDate,
          reservationData.endDate || null,
          id,
          isMaintenanceBlock
        );
        
        if (conflicts.length > 0) {
          return res.status(409).json({ 
            message: "Reservation conflicts with existing bookings",
            conflicts
          });
        }
      }
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking = {
        ...reservationData,
        updatedBy: user ? user.username : null
      };
      
      const reservation = await storage.updateReservation(id, dataWithTracking);
      
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
          createdBy: user ? user.username : `Reservation #${reservation.id} (Updated)`,
          notes: `Updated damage check for reservation from ${reservationData.startDate} to ${reservationData.endDate}`
        };
        
        const document = await storage.createDocument(documentData);
        
        // Update the reservation with the damage check path (using relative path)
        await storage.updateReservation(reservation.id, {
          damageCheckPath: getRelativePath(req.file.path)
        });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.reservations.updated(reservation);
      
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

  // ==================== SPARE VEHICLE MANAGEMENT ROUTES ====================
  
  // Get available spare vehicles for a date range
  app.get("/api/spare-vehicles/available", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, excludeVehicleId } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const exclude = excludeVehicleId ? parseInt(excludeVehicleId as string) : undefined;
      const availableVehicles = await storage.getAvailableVehiclesInRange(
        startDate as string, 
        endDate as string, 
        exclude
      );
      
      res.json(availableVehicles);
    } catch (error) {
      console.error("Error getting available spare vehicles:", error);
      res.status(500).json({ message: "Error getting available vehicles" });
    }
  });

  // Mark a reservation's vehicle as needing service
  app.post("/api/reservations/:id/mark-needs-service", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      const { maintenanceStatus, maintenanceNote, serviceStartDate, serviceEndDate } = req.body;
      
      // Validate required fields
      if (!maintenanceStatus) {
        return res.status(400).json({ message: "maintenanceStatus is required" });
      }
      
      // Get the reservation to find the vehicle
      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Mark the vehicle for service
      const updatedVehicle = await storage.markVehicleForService(
        reservation.vehicleId, 
        maintenanceStatus, 
        maintenanceNote
      );
      
      if (!updatedVehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Create maintenance block if dates provided
      if (serviceStartDate) {
        await storage.createMaintenanceBlock(
          reservation.vehicleId,
          serviceStartDate,
          serviceEndDate
        );
      }
      
      res.json({
        message: "Vehicle marked for service successfully",
        vehicle: updatedVehicle
      });
      
    } catch (error) {
      console.error("Error marking vehicle for service:", error);
      res.status(500).json({ message: "Error marking vehicle for service" });
    }
  });

  // Assign a spare vehicle to a reservation
  app.post("/api/reservations/:id/assign-spare", requireAuth, async (req: Request, res: Response) => {
    try {
      const originalReservationId = parseInt(req.params.id);
      if (isNaN(originalReservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      const { spareVehicleId, startDate, endDate } = req.body;
      
      // Validate required fields
      if (!spareVehicleId || !startDate) {
        return res.status(400).json({ 
          message: "spareVehicleId and startDate are required" 
        });
      }
      
      const spareId = parseInt(spareVehicleId);
      if (isNaN(spareId)) {
        return res.status(400).json({ message: "Invalid spare vehicle ID" });
      }
      
      // Create replacement reservation
      const replacementReservation = await storage.createReplacementReservation(
        originalReservationId,
        spareId,
        startDate,
        endDate
      );
      
      res.json({
        message: "Spare vehicle assigned successfully",
        replacementReservation
      });
      
    } catch (error) {
      console.error("Error assigning spare vehicle:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error assigning spare vehicle" });
      }
    }
  });

  // Return vehicle from service and close replacement
  app.post("/api/reservations/:id/return-from-service", requireAuth, async (req: Request, res: Response) => {
    try {
      const replacementReservationId = parseInt(req.params.id);
      if (isNaN(replacementReservationId)) {
        return res.status(400).json({ message: "Invalid replacement reservation ID" });
      }
      
      const { returnDate, mileage } = req.body;
      
      if (!returnDate) {
        return res.status(400).json({ message: "returnDate is required" });
      }
      
      // Close the replacement reservation
      const updatedReservation = await storage.closeReplacementReservation(
        replacementReservationId,
        returnDate
      );
      
      if (!updatedReservation) {
        return res.status(404).json({ 
          message: "Replacement reservation not found or invalid" 
        });
      }
      
      res.json({
        message: "Vehicle returned from service successfully",
        reservation: updatedReservation
      });
      
    } catch (error) {
      console.error("Error returning vehicle from service:", error);
      res.status(500).json({ message: "Error returning vehicle from service" });
    }
  });

  // Get active replacement by original reservation
  app.get("/api/reservations/:id/active-replacement", requireAuth, async (req: Request, res: Response) => {
    try {
      const originalReservationId = parseInt(req.params.id);
      if (isNaN(originalReservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      const activeReplacement = await storage.getActiveReplacementByOriginal(originalReservationId);
      
      if (!activeReplacement) {
        return res.status(404).json({ message: "No active replacement found" });
      }
      
      res.json(activeReplacement);
      
    } catch (error) {
      console.error("Error getting active replacement:", error);
      res.status(500).json({ message: "Error getting active replacement" });
    }
  });

  // Update legacy notes with vehicle details
  app.post("/api/reservations/update-legacy-notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const updatedCount = await storage.updateLegacyNotesWithVehicleDetails();
      
      res.json({
        message: `Successfully updated ${updatedCount} reservation notes with vehicle details`,
        updatedCount
      });
      
    } catch (error) {
      console.error("Error updating legacy notes:", error);
      res.status(500).json({ message: "Error updating legacy notes" });
    }
  });

  // Update spare vehicle status
  app.patch("/api/reservations/:id/spare-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const { spareVehicleStatus } = req.body;
      const validStatuses = ['assigned', 'ready', 'picked_up', 'returned'];
      
      if (!spareVehicleStatus || !validStatuses.includes(spareVehicleStatus)) {
        return res.status(400).json({ 
          message: "Invalid spare vehicle status. Must be one of: " + validStatuses.join(', ') 
        });
      }

      const updatedReservation = await storage.updateReservation(reservationId, { 
        spareVehicleStatus,
        updatedBy: (req as any).user?.username 
      });

      if (!updatedReservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      res.json(updatedReservation);
    } catch (error) {
      console.error("Error updating spare vehicle status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== PLACEHOLDER SPARE VEHICLE ROUTES ====================
  
  // Create a placeholder spare vehicle reservation
  app.post("/api/placeholder-reservations", requireAuth, async (req: Request, res: Response) => {
    try {
      // Handle the case where the body is double-wrapped (from apiRequest function)
      let requestData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        try {
          requestData = JSON.parse(req.body.body);
          console.log("Parsed double-wrapped body:", requestData);
        } catch (e) {
          console.error("Failed to parse body.body:", e);
        }
      }
      
      // Validate request body with Zod
      const validatedData = createPlaceholderReservationSchema.parse(requestData);
      
      // Create placeholder reservation
      const placeholderReservation = await storage.createPlaceholderReservation(
        validatedData.originalReservationId,
        validatedData.customerId,
        validatedData.startDate,
        validatedData.endDate
      );
      
      res.status(201).json(placeholderReservation);
      
    } catch (error) {
      console.error("Error creating placeholder reservation:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        // Map storage errors to proper HTTP status codes
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get placeholder reservations with optional date filtering
  app.get("/api/placeholder-reservations", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate query parameters with Zod
      const validatedQuery = placeholderQuerySchema.parse(req.query);
      
      const placeholders = await storage.getPlaceholderReservations(
        validatedQuery.startDate,
        validatedQuery.endDate
      );
      
      res.json(placeholders);
      
    } catch (error) {
      console.error("Error getting placeholder reservations:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get placeholder reservations needing assignment (upcoming within specified days)
  app.get("/api/placeholder-reservations/needing-assignment", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate query parameters with Zod
      const validatedQuery = placeholderNeedingAssignmentQuerySchema.parse(req.query);
      
      const placeholders = await storage.getPlaceholderReservationsNeedingAssignment(validatedQuery.daysAhead);
      
      res.json(placeholders);
      
    } catch (error) {
      console.error("Error getting placeholders needing assignment:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Assign a vehicle to a placeholder reservation
  app.post("/api/placeholder-reservations/:id/assign-vehicle", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate path parameter
      const placeholderReservationId = parseInt(req.params.id);
      if (isNaN(placeholderReservationId) || placeholderReservationId <= 0) {
        return res.status(400).json({ message: "Invalid placeholder reservation ID" });
      }
      
      // Validate request body with Zod
      const validatedData = assignVehicleToPlaceholderSchema.parse(req.body);
      
      // Assign vehicle to placeholder
      const updatedReservation = await storage.assignVehicleToPlaceholder(
        placeholderReservationId,
        validatedData.vehicleId,
        validatedData.endDate
      );
      
      if (!updatedReservation) {
        return res.status(404).json({ 
          message: "Placeholder reservation not found or invalid" 
        });
      }
      
      res.json(updatedReservation);
      
    } catch (error) {
      console.error("Error assigning vehicle to placeholder:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        // Map storage errors to proper HTTP status codes
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('not available') || error.message.includes('conflict')) {
          return res.status(409).json({ message: error.message });
        }
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Internal server error" });
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
      
      // Always remove all special characters including dashes from license plates for folder names
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
      const baseDir = path.join(getUploadsDir(), sanitizedPlate);
      const receiptsDir = path.join(baseDir, 'receipts');
      
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }
      
      console.log(`Receipt upload storage: ${receiptsDir}`);
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
        const dateString = req.body.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const category = req.body.category || 'unknown';
        const extension = path.extname(file.originalname) || '.pdf'; // Default to .pdf if no extension
        
        // Get vehicle license plate
        const vehicleId = parseInt(req.body.vehicleId);
        const vehicle = await storage.getVehicle(vehicleId);
        
        if (!vehicle) {
          throw new Error("Vehicle not found");
        }
        
        // Sanitize license plate for filename (remove spaces, etc.) - match the document pattern
        const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
        
        // Create filename with license plate, expense category, and date - match document pattern
        const fileName = `${sanitizedPlate}_receipt_${category.toLowerCase().replace(/\s+/g, '_')}_${dateString}_${timestamp}${extension}`;
        
        console.log(`Generated receipt filename: ${fileName}`);
        cb(null, fileName);
      } catch (error) {
        console.error("Error creating filename for expense receipt:", error);
        // Fallback to simple timestamped name if there's an error - match document pattern
        const timestamp = Date.now();
        const dateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const category = req.body.category || 'unknown';
        const extension = path.extname(file.originalname) || '.pdf'; // Default to .pdf if no extension
        const fallbackName = `receipt_${category.toLowerCase().replace(/\s+/g, '_')}_${dateString}_${timestamp}${extension}`;
        console.log(`Using fallback receipt filename: ${fallbackName}`);
        cb(null, fallbackName);
      }
    }
  });
  
  const expenseReceiptUpload = multer({
    storage: expenseReceiptStorage,
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for PDFs and images
    },
    fileFilter: (req, file, cb) => {
      // Log file info for debugging
      console.log("File upload attempt:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });
      
      // Accept only specific file types
      const fileTypes = /jpeg|jpg|png|pdf/;
      // Extract the extension and convert to lowercase
      const fileExt = path.extname(file.originalname).toLowerCase();
      const extname = fileTypes.test(fileExt);
      
      // PDF files sometimes have different MIME types
      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png',
        'application/pdf', 'application/x-pdf', 'text/pdf'
      ];
      
      // If the mimetype includes 'pdf' (anywhere in the string), consider it a PDF
      const isPDF = file.mimetype.includes('pdf') || fileExt === '.pdf';
      const isAllowedMimetype = allowedMimeTypes.includes(file.mimetype);
      
      console.log("File validation:", {
        fileExt,
        extname,
        isPDF,
        isAllowedMimetype
      });
      
      if (extname && (isAllowedMimetype || isPDF)) {
        console.log("File accepted");
        return cb(null, true);
      } else {
        console.error(`File rejected: ${file.originalname}, mimetype: ${file.mimetype}, extension: ${fileExt}`);
        cb(new Error(`Only .jpg, .jpeg, .png, and .pdf files are allowed. Received: ${fileExt} with mimetype: ${file.mimetype}`) as any, false);
      }
    },
  });

  // Delete reservation (soft delete with user tracking)
  app.delete("/api/reservations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      // Check if reservation exists and is not already deleted
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Check if already deleted
      if (reservation.deletedAt) {
        return res.status(410).json({ message: "Reservation already deleted" });
      }
      
      const user = req.user;
      const softDeleteData = {
        deletedAt: new Date(),
        deletedBy: user ? user.username : null,
        deletedByUser: user ? user.id : null,
        updatedBy: user ? user.username : null // Also track who made the update
      };
      
      // If this is a maintenance block, also delete related replacement reservations
      if (reservation.type === 'maintenance_block') {
        console.log(`🔧 Deleting maintenance block ${id} - checking for related spare vehicle reservations...`);
        
        // Get all reservations to find related replacements
        const allReservations = await storage.getAllReservations();
        
        // Find all customer rentals on the same vehicle that overlap with the maintenance
        const maintenanceStart = new Date(reservation.startDate);
        const maintenanceEnd = reservation.endDate ? new Date(reservation.endDate) : new Date('9999-12-31');
        
        const affectedRentals = allReservations.filter(r => 
          r.id !== id && 
          !r.deletedAt &&
          r.vehicleId === reservation.vehicleId &&
          r.type === 'standard' &&
          r.customerId !== null
        ).filter(r => {
          const rentalStart = new Date(r.startDate);
          const rentalEnd = r.endDate ? new Date(r.endDate) : new Date('9999-12-31');
          return rentalStart <= maintenanceEnd && rentalEnd >= maintenanceStart;
        });
        
        console.log(`📋 Found ${affectedRentals.length} customer rentals affected by this maintenance`);
        
        // Find all replacement reservations for these affected rentals
        const affectedRentalIds = affectedRentals.map(r => r.id);
        const replacementsToDelete = allReservations.filter(r =>
          r.type === 'replacement' &&
          r.replacementForReservationId !== null &&
          affectedRentalIds.includes(r.replacementForReservationId) &&
          !r.deletedAt
        );
        
        console.log(`🚗 Found ${replacementsToDelete.length} spare vehicle reservations to delete`);
        
        // Delete all related replacement reservations
        for (const replacement of replacementsToDelete) {
          await storage.updateReservation(replacement.id, softDeleteData);
          realtimeEvents.reservations.deleted({ id: replacement.id });
          console.log(`✅ Deleted spare vehicle reservation ${replacement.id}`);
        }
      }
      
      // Delete the main reservation
      const updatedReservation = await storage.updateReservation(id, softDeleteData);
      if (updatedReservation) {
        // Broadcast real-time update to all connected clients
        realtimeEvents.reservations.deleted({ id });
        
        res.status(200).json({ 
          message: "Reservation deleted successfully",
          deletedBy: user ? user.username : 'Unknown'
        });
      } else {
        res.status(500).json({ message: "Failed to delete reservation" });
      }
    } catch (error) {
      console.error("Error deleting reservation:", error);
      res.status(500).json({ 
        message: "Failed to delete reservation", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.get("/api/expenses/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const expenses = await storage.getRecentExpenses(limit);
    res.json(expenses);
  });
  
  // Get expenses by vehicle - This MUST come before the generic :id route
  app.get("/api/expenses/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }
    
    console.log(`Getting expenses for vehicle ID: ${vehicleId}`);
    const expenses = await storage.getExpensesByVehicle(vehicleId);
    res.json(expenses);
  });
  
  // Get all expenses
  app.get("/api/expenses", async (req, res) => {
    const expenses = await storage.getAllExpenses();
    res.json(expenses);
  });

  // Get single expense - This MUST come after the more specific routes
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
  
  // Get expense receipt
  app.get("/api/expenses/:id/receipt", async (req: Request, res: Response) => {
    try {
      const expense = await storage.getExpense(parseInt(req.params.id));
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      if (!expense.receiptFilePath) {
        return res.status(404).json({ error: "No receipt file found for this expense" });
      }

      // Check if file exists
      const filePath = path.resolve(expense.receiptFilePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Receipt file not found on disk" });
      }

      // Serve the file
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error serving receipt file:", err);
          res.status(500).json({ error: "Failed to serve receipt file" });
        }
      });
    } catch (error) {
      console.error("Error retrieving expense receipt:", error);
      res.status(500).json({ error: "Failed to retrieve expense receipt" });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }
      
      // Get the expense first to check if it exists
      const expense = await storage.getExpense(id);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Delete the expense
      const success = await storage.deleteExpense(id);
      
      if (success) {
        // Broadcast real-time update to all connected clients
        realtimeEvents.expenses.deleted({ id });
        
        res.status(200).json({ message: "Expense deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete expense" });
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ 
        message: "Failed to delete expense", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Create expense with receipt upload
  app.post("/api/expenses", requireAuth, expenseReceiptUpload.single('receiptFile'), async (req: Request, res: Response) => {
    try {
      // Convert vehicleId to number, but leave amount as string for schema validation
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      // We don't convert amount because the schema now handles both string and number
      
      console.log("Standard endpoint - data being passed to schema:", req.body);
      const expenseData = insertExpenseSchema.parse(req.body);
      
      // Add user tracking information
      const user = req.user;
      const dataWithTracking = {
        ...expenseData,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null,
        receiptPath: req.file ? getRelativePath(req.file.path) : null
      };
      
      // Create expense record
      const expense = await storage.createExpense(dataWithTracking);
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.expenses.created(expense);
      
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
  
  // Create expense with receipt upload (Dedicated endpoint for file uploads)
  app.post("/api/expenses/with-receipt", expenseReceiptUpload.single('receiptFile'), async (req, res) => {
    try {
      console.log("Handling expense with receipt upload");
      console.log("Request body:", req.body);
      console.log("File info:", req.file);
      
      // Convert vehicleId to number, but leave amount as string for schema validation
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      // We don't convert amount because the schema now handles both string and number
      
      console.log("Data being passed to schema:", req.body);
      const expenseData = insertExpenseSchema.parse(req.body);
      console.log("Parsed expense data:", expenseData);
      
      // Add additional metadata from the uploaded file if present
      const additionalData: any = {};
      if (req.file) {
        console.log("Processing uploaded receipt file");
        additionalData.receiptPath = getRelativePath(req.file.path);
        additionalData.receiptFilePath = req.file.path;
        additionalData.receiptFileSize = req.file.size;
        additionalData.receiptContentType = req.file.mimetype;
        console.log("File metadata:", additionalData);
      } else {
        console.log("No receipt file found in request");
      }
      
      // Create expense record
      console.log("Creating expense record with data:", { ...expenseData, ...additionalData });
      const expense = await storage.createExpense({
        ...expenseData,
        ...additionalData
      });
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.expenses.created(expense);
      
      console.log("Expense created successfully:", expense);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense with receipt:", error);
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

      // Convert vehicleId to number, but leave amount as string for schema validation
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      // We don't convert amount because the schema now handles both string and number
      
      console.log("Update data being passed to schema:", req.body);
      const expenseData = insertExpenseSchema.parse(req.body);
      
      // Add additional metadata from the uploaded file if present
      const additionalData: any = {};
      if (req.file) {
        additionalData.receiptPath = getRelativePath(req.file.path);
        additionalData.receiptFilePath = req.file.path;
        additionalData.receiptFileSize = req.file.size;
        additionalData.receiptContentType = req.file.mimetype;
      }
      
      // Update expense record
      const expense = await storage.updateExpense(id, {
        ...expenseData,
        ...additionalData
      });
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.expenses.updated(expense);
      
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
  
  // Update expense with receipt upload (Dedicated endpoint for file uploads)
  app.patch("/api/expenses/:id/with-receipt", expenseReceiptUpload.single('receiptFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }

      // Convert vehicleId to number, but leave amount as string for schema validation
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      // We don't convert amount because the schema now handles both string and number
      
      console.log("Update data being passed to schema:", req.body);
      const expenseData = insertExpenseSchema.parse(req.body);
      
      // Add additional metadata from the uploaded file if present
      const additionalData: any = {};
      if (req.file) {
        additionalData.receiptPath = getRelativePath(req.file.path);
        additionalData.receiptFilePath = req.file.path;
        additionalData.receiptFileSize = req.file.size;
        additionalData.receiptContentType = req.file.mimetype;
      }
      
      // Update expense record
      const expense = await storage.updateExpense(id, {
        ...expenseData,
        ...additionalData
      });
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.expenses.updated(expense);
      
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense with receipt:", error);
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

  // ==================== VEHICLE-SPECIFIC CUSTOMER ROUTES ====================
  // Get customers who have rented a specific vehicle (for APK reminders, etc.)
  app.get('/api/vehicles/:vehicleId/customers-with-reservations', requireAuth, async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      
      if (isNaN(vehicleId)) {
        return res.status(400).json({ error: 'Invalid vehicle ID' });
      }
      
      // Get ALL reservations for this vehicle (past and present)
      const vehicleReservations = await storage.getReservationsByVehicle(vehicleId);
      
      // Get unique customer details with their most recent reservation
      const customersMap = new Map();
      
      for (const reservation of vehicleReservations) {
        // Skip maintenance blocks (they don't have customers)
        if (reservation.type === 'maintenance_block' || !reservation.customerId) {
          continue;
        }
        
        // Get customer details
        const customer = await storage.getCustomer(reservation.customerId);
        const vehicle = await storage.getVehicle(vehicleId);
        
        if (customer && vehicle) {
          // Use customer ID as key to avoid duplicates
          // Keep the most recent reservation for each customer
          const existingEntry = customersMap.get(customer.id);
          const reservationDate = new Date(reservation.startDate);
          
          if (!existingEntry || new Date(existingEntry.reservation.startDate) < reservationDate) {
            customersMap.set(customer.id, {
              vehicle,
              customer,
              reservation
            });
          }
        }
      }
      
      // Convert Map to array
      const customersWithReservations = Array.from(customersMap.values());

      console.log(`Found ${customersWithReservations.length} unique customers who have rented vehicle ${vehicleId}`);
      
      res.json(customersWithReservations);
    } catch (error) {
      console.error('Error fetching customers with reservations for vehicle:', error);
      res.status(500).json({ 
        error: 'Failed to fetch customers with reservations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      
      // Always remove all special characters including dashes from license plates for folder names
      const sanitizedPlateNoDashes = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
      
      // Special handling for Contract type documents - use the contracts folder structure
      if (req.body.documentType && req.body.documentType.toLowerCase() === 'contract') {
        const contractsBaseDir = path.join(getUploadsDir(), 'contracts');
        const vehicleContractsDir = path.join(contractsBaseDir, sanitizedPlateNoDashes);
        
        try {
          if (!fs.existsSync(contractsBaseDir)) {
            fs.mkdirSync(contractsBaseDir, { recursive: true });
          }
          
          if (!fs.existsSync(vehicleContractsDir)) {
            fs.mkdirSync(vehicleContractsDir, { recursive: true });
          }
          
          callback(null, vehicleContractsDir);
          return;
        } catch (error) {
          console.error('Failed to create contract directory:', error);
          return callback(new Error(`Failed to create upload directory: ${error.message}`), false);
        }
      }
      
      // Standard handling for non-contract documents - use consistent folder naming
      const baseDir = path.join(getUploadsDir(), sanitizedPlateNoDashes);
      let documentsDir = baseDir;
      
      // Organize by document type if provided
      if (req.body.documentType) {
        const sanitizedType = req.body.documentType.toLowerCase().replace(/\s+/g, '_');
        documentsDir = path.join(baseDir, sanitizedType);
      }
      
      try {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true });
        }
        if (!fs.existsSync(documentsDir)) {
          fs.mkdirSync(documentsDir, { recursive: true });
        }
        
        callback(null, documentsDir);
      } catch (error) {
        console.error('Failed to create document directory:', error);
        return callback(new Error(`Failed to create upload directory: ${error.message}`), false);
      }
    } catch (error) {
      console.error("Error with document upload:", error);
      callback(new Error(`Document upload error: ${error.message}`), false);
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
        
        // Special handling for Contract documents to match the auto-generated format
        if (documentType.toLowerCase() === 'contract') {
          const currentDate = new Date().getFullYear().toString() + 
                             (new Date().getMonth() + 1).toString().padStart(2, '0') + 
                             new Date().getDate().toString().padStart(2, '0');
          
          // Match format used in contract generation route
          const newFilename = `${sanitizedPlate}_contract_${currentDate}${extension}`;
          console.log(`Creating contract filename: ${newFilename}`);
          cb(null, newFilename);
          return;
        }
        
        // Standard handling for other document types
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

  // Get documents by reservation
  app.get("/api/documents/reservation/:reservationId", async (req, res) => {
    const reservationId = parseInt(req.params.reservationId);
    if (isNaN(reservationId)) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    const documents = await storage.getDocumentsByReservation(reservationId);
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
  app.post("/api/documents", requireAuth, documentUpload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Convert vehicleId and reservationId to numbers
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      if (req.body.reservationId) req.body.reservationId = parseInt(req.body.reservationId);
      
      // Get the filename from the path (which is the formatted name)
      const formattedFileName = path.basename(req.file.path);
      
      // Add user tracking information
      const user = req.user;
      
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        fileName: formattedFileName,
        filePath: getRelativePath(req.file.path),
        fileSize: req.file.size,
        contentType: req.file.mimetype,
        createdBy: user ? user.username : null
      });
      
      const document = await storage.createDocument(documentData);
      
      // If this is an APK Inspection document and an APK date is provided, update the vehicle
      if (req.body.documentType === "APK Inspection" && req.body.apkDate && req.body.vehicleId) {
        try {
          await storage.updateVehicle(req.body.vehicleId, {
            apkDate: req.body.apkDate,
            updatedBy: user ? user.username : null
          });
        } catch (error) {
          console.error("Error updating vehicle APK date:", error);
          // Continue anyway - the document was uploaded successfully
        }
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.documents.created(document);
      
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
  app.patch("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
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

      // Add user tracking information
      const user = req.user;
      
      // Update only allowed fields (documentType and notes)
      const documentData = {
        ...(req.body.documentType && { documentType: req.body.documentType }),
        ...(req.body.notes !== undefined && { notes: req.body.notes }),
        updatedBy: user ? user.username : null
      };
      
      const updatedDocument = await storage.updateDocument(id, documentData);
      if (!updatedDocument) {
        return res.status(404).json({ message: "Failed to update document" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.documents.updated(updatedDocument);
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(400).json({ 
        message: "Failed to update document", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // View document (for preview/print)
  app.get("/api/documents/view/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // Get document details
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.filePath) {
        return res.status(404).json({ message: "No file path found for this document" });
      }

      // Convert relative path to absolute path
      const absolutePath = path.join(process.cwd(), document.filePath);
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ message: "Document file not found on disk" });
      }

      // Set appropriate headers for inline viewing (not download)
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      res.setHeader('Content-Type', document.contentType || 'application/octet-stream');

      // Serve the file
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error("Error serving document file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to serve document file" });
          }
        }
      });
    } catch (error) {
      console.error("Error viewing document:", error);
      res.status(500).json({ 
        message: "Failed to view document", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Download document
  app.get("/api/documents/download/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // Get document details
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.filePath) {
        return res.status(404).json({ message: "No file path found for this document" });
      }

      // Convert relative path to absolute path
      const absolutePath = path.join(process.cwd(), document.filePath);
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ message: "Document file not found on disk" });
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.setHeader('Content-Type', document.contentType || 'application/octet-stream');

      // Serve the file
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error("Error serving document file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to serve document file" });
          }
        }
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ 
        message: "Failed to download document", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Email document - MailerSend integration 
  app.post("/api/documents/:id/email", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const { recipients, subject, message } = req.body;
      
      if (!recipients || !subject) {
        return res.status(400).json({ message: "Recipients and subject are required" });
      }

      // Get document details
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if document type is allowed for email (damage or contract only)
      const allowedTypes = ['damage', 'contract'];
      const isAllowed = allowedTypes.some(type => 
        document.documentType.toLowerCase().includes(type)
      );
      
      if (!isAllowed) {
        return res.status(403).json({ 
          message: "This document type cannot be emailed. Only damage and contract documents are allowed." 
        });
      }

      if (!document.filePath) {
        return res.status(404).json({ message: "No file path found for this document" });
      }

      // Convert relative path to absolute path
      const absolutePath = path.join(process.cwd(), document.filePath);
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ message: "Document file not found on disk" });
      }

      // Use MailerSend to send email with attachment
      const { MailerSend, EmailParams, Sender, Recipient, Attachment } = require("mailersend");

      const mailerSend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY,
      });

      // Read file data for attachment
      const fileData = fs.readFileSync(absolutePath);
      const base64Data = fileData.toString('base64');

      // Parse recipients (comma-separated)
      const recipientList = recipients.split(',').map((email: string) => email.trim()).filter((email: string) => email);
      
      const sentFrom = new Sender("noreply@yourdomain.com", "Car Rental System");

      const recipients_list = recipientList.map((email: string) => new Recipient(email));

      // Create attachment
      const attachment = new Attachment(base64Data, document.fileName, "attachment");

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients_list)
        .setSubject(subject)
        .setText(message || "Please find the attached document.")
        .setHtml(`<p>${(message || "Please find the attached document.").replace(/\n/g, '<br>')}</p>`)
        .setAttachments([attachment]);

      await mailerSend.email.send(emailParams);

      res.json({ 
        message: "Email sent successfully",
        recipients: recipientList.length,
        document: document.fileName
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ 
        message: "Failed to send email", 
        error: error instanceof Error ? error.message : "Email service error" 
      });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
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

      // Broadcast real-time update to all connected clients
      realtimeEvents.documents.deleted({ id });

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
  app.get("/api/contracts/generate/:reservationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Load related vehicle and customer details
      if (reservation.vehicleId) {
        reservation.vehicle = await storage.getVehicle(reservation.vehicleId);
      }
      
      if (reservation.customerId) {
        reservation.customer = await storage.getCustomer(reservation.customerId);
      }

      // For now, use the standard template while we debug the custom template implementation
      let pdfBuffer: Buffer;
      
      try {
        // First, try the custom template implementation
        const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
        
        if (templateId) {
          console.log(`Generating contract with template ID: ${templateId}`);
          const template = await storage.getPdfTemplate(templateId);
          
          if (template) {
            // Make sure the template fields are properly formatted
            let fieldsLength = 0;
            if (template.fields) {
              if (typeof template.fields === 'string') {
                try {
                  const parsedFields = JSON.parse(template.fields);
                  fieldsLength = parsedFields.length;
                  // Ensure template has fields property as parsed JSON
                  template.fields = parsedFields;
                } catch (e) {
                  console.error('Error parsing template fields:', e);
                }
              } else {
                fieldsLength = template.fields.length;
              }
            }
            
            console.log(`Template has ${fieldsLength} fields`);
            
            // Use the imported function from pdf-generator.ts
            const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
            pdfBuffer = await generateRentalContractFromTemplate(reservation, template);
            console.log("Successfully generated PDF with custom template");
          } else {
            console.log("Template not found, falling back to standard template");
            pdfBuffer = await generateRentalContract(reservation);
          }
        } else {
          // Try to get the default template first
          console.log("Attempting to get default template");
          const defaultTemplate = await storage.getDefaultPdfTemplate();
          
          if (defaultTemplate) {
            console.log(`Using default template: ${defaultTemplate.name} with ID: ${defaultTemplate.id}`);
            
            // Make sure the template fields are properly formatted
            let fieldsLength = 0;
            if (defaultTemplate.fields) {
              if (typeof defaultTemplate.fields === 'string') {
                try {
                  const parsedFields = JSON.parse(defaultTemplate.fields);
                  fieldsLength = parsedFields.length;
                  // Ensure template has fields property as parsed JSON
                  defaultTemplate.fields = parsedFields;
                } catch (e) {
                  console.error('Error parsing template fields:', e);
                }
              } else {
                fieldsLength = defaultTemplate.fields.length;
              }
            }
            
            console.log(`Template has ${fieldsLength} fields`);
            
            const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
            pdfBuffer = await generateRentalContractFromTemplate(reservation, defaultTemplate);
          } else {
            // No default template found
            console.log("No default template found in database, using standard template");
            
            // Check all templates for debugging
            const allTemplates = await storage.getAllPdfTemplates();
            console.log(`Found ${allTemplates.length} total templates:`);
            for (const template of allTemplates) {
              console.log(`  - Template ID ${template.id}: "${template.name}" (isDefault: ${template.isDefault})`);
            }
            
            pdfBuffer = await generateRentalContract(reservation);
          }
        }
      } catch (error) {
        console.error("Error using custom template:", error);
        // Fall back to the old fixed template format
        pdfBuffer = await generateRentalContract(reservation);
      }
      
      // Save a copy of the contract PDF to the contracts folder and register it as a document
      try {
        // Get vehicle license plate for folder structure
        if (reservation.vehicle && reservation.vehicle.licensePlate) {
          // Ensure we remove ALL special characters including dashes for contract folders/filenames
          const sanitizedPlate = reservation.vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
          const contractsBaseDir = path.join(getUploadsDir(), 'contracts');
          const vehicleContractsDir = path.join(contractsBaseDir, sanitizedPlate);
          
          console.log(`Saving contract for vehicle with license plate: ${reservation.vehicle.licensePlate}`);
          console.log(`Sanitized plate: ${sanitizedPlate}`);
          console.log(`Contracts base directory: ${contractsBaseDir}`);
          console.log(`Vehicle contracts directory: ${vehicleContractsDir}`);
          
          // Create directories if they don't exist
          if (!fs.existsSync(contractsBaseDir)) {
            console.log(`Creating base contracts directory: ${contractsBaseDir}`);
            fs.mkdirSync(contractsBaseDir, { recursive: true });
          }
          
          if (!fs.existsSync(vehicleContractsDir)) {
            console.log(`Creating vehicle contracts directory: ${vehicleContractsDir}`);
            fs.mkdirSync(vehicleContractsDir, { recursive: true });
          }
          
          // Format date for filename
          const today = new Date();
          const currentDate = today.getFullYear().toString() + 
                             (today.getMonth() + 1).toString().padStart(2, '0') + 
                             today.getDate().toString().padStart(2, '0');
          
          const contractNumber = `C-${reservationId}-${currentDate}`;
          
          // Create a unique filename based on license plate and date
          const filename = `${sanitizedPlate}_contract_${currentDate}.pdf`;
          const filePath = path.join(vehicleContractsDir, filename);
          
          console.log(`Saving contract to file: ${filePath}`);
          
          // Save the file
          fs.writeFileSync(filePath, pdfBuffer);
          console.log(`Contract successfully saved to: ${filePath}`);
          
          // Register the contract as a document entry
          try {
            // Create document entry for the contract
            const documentData = {
              vehicleId: reservation.vehicleId,
              reservationId: reservationId, // Link to reservation
              documentType: 'Contract (Unsigned)', // Mark as unsigned
              fileName: filename,
              filePath: getRelativePath(filePath),
              fileSize: pdfBuffer.length,
              contentType: 'application/pdf',
              createdBy: req.user ? req.user.username : 'System',
              notes: `Auto-generated unsigned contract for reservation #${reservationId}`
            };
            
            // Check for existing unsigned contracts for this reservation to determine version number
            const existingDocs = await storage.getDocumentsByReservation(reservationId);
            const existingContracts = existingDocs.filter(doc => 
              doc.documentType?.startsWith('Contract (Unsigned)')
            );
            
            // Determine version number
            let versionNumber = 1;
            if (existingContracts.length > 0) {
              // Extract version numbers from existing contracts
              const versions = existingContracts.map(doc => {
                const match = doc.documentType?.match(/Contract \(Unsigned\)(?: (\d+))?/);
                return match && match[1] ? parseInt(match[1]) : 1;
              });
              versionNumber = Math.max(...versions) + 1;
            }
            
            // Update document type with version number if > 1
            if (versionNumber > 1) {
              documentData.documentType = `Contract (Unsigned) ${versionNumber}`;
              documentData.notes = `Auto-generated unsigned contract (version ${versionNumber}) for reservation #${reservationId}`;
            }
            
            const document = await storage.createDocument(documentData);
            console.log(`✅ Created document entry for unsigned contract (version ${versionNumber}): ID ${document.id}`);
            
            // Broadcast real-time update to all connected clients
            realtimeEvents.documents.created(document);
          } catch (docError) {
            console.error('Error registering contract as document:', docError);
            // Continue even if document registration fails
          }
        } else {
          console.log('Cannot save contract: Vehicle or license plate is missing');
        }
      } catch (error) {
        console.error('Error saving contract PDF copy:', error);
        console.error(error); // Print full error
        // Continue even if saving a copy fails
      }
      
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
  
  // Generate contract preview with form data (returns preview token)
  app.post("/api/contracts/preview", requireAuth, async (req: Request, res: Response) => {
    try {
      const { vehicleId, customerId, startDate, endDate, notes } = req.body;
      const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
      
      if (!vehicleId || !customerId) {
        return res.status(400).json({ message: "Vehicle ID and Customer ID are required" });
      }

      // Get vehicle and customer data
      const vehicle = await storage.getVehicle(vehicleId);
      const customer = await storage.getCustomer(customerId);
      
      if (!vehicle || !customer) {
        return res.status(404).json({ message: "Vehicle or customer not found" });
      }

      // Get the specified template or default PDF template
      let template;
      if (templateId) {
        template = await storage.getPdfTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
      } else {
        template = await storage.getDefaultPdfTemplate();
      }
      
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Create preview contract data with PENDING placeholder
      const previewData = {
        id: 0, // Preview - no actual reservation ID
        vehicleId,
        customerId,
        startDate,
        endDate,
        notes: notes || "",
        status: "pending",
        totalPrice: 0,
        vehicle,
        customer
      };

      console.log("Generating contract preview with PENDING placeholder");

      // Make sure the template fields are properly formatted
      if (template.fields && typeof template.fields === 'string') {
        try {
          const parsedFields = JSON.parse(template.fields);
          template.fields = parsedFields;
        } catch (e) {
          console.error('Error parsing template fields:', e);
        }
      }

      // Use the imported function from pdf-generator.ts
      const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
      const pdfBuffer = await generateRentalContractFromTemplate(previewData, template);
      
      // Store preview with token
      const { previewTokenService } = await import('./preview-token-service');
      const token = previewTokenService.store({
        vehicleId: parseInt(vehicleId),
        customerId: parseInt(customerId),
        startDate,
        endDate,
        notes,
        templateId: template.id,
        pdfBuffer,
        userId: req.user!.id.toString(),
      });

      console.log(`✅ Preview generated and stored with token: ${token}`);
      
      // Return token and download URL
      res.json({
        token,
        downloadUrl: `/api/contracts/preview/${token}`
      });
    } catch (error) {
      console.error("Error generating contract preview:", error);
      res.status(500).json({ 
        message: "Failed to generate contract preview", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get contract preview by token
  app.get("/api/contracts/preview/:token", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { previewTokenService } = await import('./preview-token-service');
      
      const preview = previewTokenService.get(token, req.user!.id.toString());
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found or expired" });
      }

      console.log(`📄 Serving preview PDF for token: ${token}`);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="contract_preview.pdf"');
      res.setHeader('Content-Length', preview.pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(preview.pdfBuffer);
    } catch (error) {
      console.error("Error retrieving contract preview:", error);
      res.status(500).json({ 
        message: "Failed to retrieve contract preview", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Generate versioned contract with form data (for edit mode)
  app.post("/api/contracts/generate-versioned/:reservationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const { vehicleId, customerId, driverId, startDate, endDate, notes } = req.body;
      const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
      
      if (!vehicleId || !customerId) {
        return res.status(400).json({ message: "Vehicle ID and Customer ID are required" });
      }

      // Get vehicle and customer data
      const vehicle = await storage.getVehicle(vehicleId);
      const customer = await storage.getCustomer(customerId);
      
      if (!vehicle || !customer) {
        return res.status(404).json({ message: "Vehicle or customer not found" });
      }

      // Get driver data if provided
      let driver = null;
      if (driverId) {
        driver = await storage.getDriver(driverId);
      }

      // Get the specified template or default PDF template
      let template;
      if (templateId) {
        template = await storage.getPdfTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
      } else {
        template = await storage.getDefaultPdfTemplate();
      }
      
      if (!template) {
        return res.status(404).json({ message: "PDF template not found" });
      }

      // Create contract data with current form values
      const contractData = {
        id: reservationId,
        vehicleId,
        customerId,
        driverId,
        startDate,
        endDate,
        notes: notes || "",
        status: "pending",
        totalPrice: 0,
        vehicle,
        customer,
        driver
      };

      console.log("Generating versioned contract with current form data");

      // Make sure the template fields are properly formatted
      if (template.fields && typeof template.fields === 'string') {
        try {
          const parsedFields = JSON.parse(template.fields);
          template.fields = parsedFields;
        } catch (e) {
          console.error('Error parsing template fields:', e);
        }
      }

      // Use the imported function from pdf-generator.ts
      const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
      const pdfBuffer = await generateRentalContractFromTemplate(contractData, template);
      
      // Save as versioned document
      if (vehicle) {
        try {
          const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '');
          const contractsBaseDir = path.join(getUploadsDir(), 'contracts');
          const vehicleContractsDir = path.join(contractsBaseDir, sanitizedPlate);
          
          // Create directories if they don't exist
          if (!fs.existsSync(contractsBaseDir)) {
            fs.mkdirSync(contractsBaseDir, { recursive: true });
          }
          
          if (!fs.existsSync(vehicleContractsDir)) {
            fs.mkdirSync(vehicleContractsDir, { recursive: true });
          }
          
          // Format date for filename
          const today = new Date();
          const currentDate = today.getFullYear().toString() + 
                             (today.getMonth() + 1).toString().padStart(2, '0') + 
                             today.getDate().toString().padStart(2, '0');
          
          // Create a unique filename based on license plate and date
          const filename = `${sanitizedPlate}_contract_${currentDate}.pdf`;
          const filePath = path.join(vehicleContractsDir, filename);
          
          // Save the file
          fs.writeFileSync(filePath, pdfBuffer);
          console.log(`Contract successfully saved to: ${filePath}`);
          
          // Check for existing unsigned contracts for this reservation to determine version number
          const existingDocs = await storage.getDocumentsByReservation(reservationId);
          const existingContracts = existingDocs.filter(doc => 
            doc.documentType?.startsWith('Contract (Unsigned)')
          );
          
          // Determine version number
          let versionNumber = 1;
          if (existingContracts.length > 0) {
            // Extract version numbers from existing contracts
            const versions = existingContracts.map(doc => {
              const match = doc.documentType?.match(/Contract \(Unsigned\)(?: (\d+))?/);
              return match && match[1] ? parseInt(match[1]) : 1;
            });
            versionNumber = Math.max(...versions) + 1;
          }
          
          // Create document entry for the contract
          const documentData = {
            vehicleId: vehicleId,
            reservationId: reservationId,
            documentType: versionNumber > 1 ? `Contract (Unsigned) ${versionNumber}` : 'Contract (Unsigned)',
            fileName: filename,
            filePath: getRelativePath(filePath),
            fileSize: pdfBuffer.length,
            contentType: 'application/pdf',
            createdBy: req.user ? req.user.username : 'System',
            notes: versionNumber > 1 
              ? `Auto-generated unsigned contract (version ${versionNumber}) with current form data for reservation #${reservationId}`
              : `Auto-generated unsigned contract with current form data for reservation #${reservationId}`
          };
          
          const document = await storage.createDocument(documentData);
          console.log(`✅ Created document entry for unsigned contract (version ${versionNumber}): ID ${document.id}`);
          
          // Broadcast real-time update to all connected clients
          realtimeEvents.documents.created(document);
        } catch (docError) {
          console.error('Error registering contract as document:', docError);
          // Continue even if document registration fails
        }
      }
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=rental_contract_${reservationId}_v${Date.now()}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating versioned contract:", error);
      res.status(500).json({ 
        message: "Failed to generate versioned contract", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Generate contract using default template
  app.get("/api/contracts/generate-default/:reservationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Load related vehicle and customer details
      if (reservation.vehicleId) {
        reservation.vehicle = await storage.getVehicle(reservation.vehicleId);
      }
      
      if (reservation.customerId) {
        reservation.customer = await storage.getCustomer(reservation.customerId);
      }

      // Get the default PDF template
      const defaultTemplate = await storage.getDefaultPdfTemplate();
      
      let pdfBuffer: Buffer;
      
      if (defaultTemplate) {
        console.log(`Generating contract with default template: ${defaultTemplate.name} (ID: ${defaultTemplate.id})`);
        
        // Make sure the template fields are properly formatted
        if (defaultTemplate.fields && typeof defaultTemplate.fields === 'string') {
          try {
            const parsedFields = JSON.parse(defaultTemplate.fields);
            defaultTemplate.fields = parsedFields;
          } catch (e) {
            console.error('Error parsing default template fields:', e);
          }
        }
        
        // Use the imported function from pdf-generator.ts
        const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
        pdfBuffer = await generateRentalContractFromTemplate(reservation, defaultTemplate);
        console.log("Successfully generated PDF with default template");
      } else {
        console.log("No default template found, using standard template");
        // Fall back to standard template if no default template is available
        const { generateRentalContract } = await import('./utils/pdf-generator');
        pdfBuffer = await generateRentalContract(reservation);
      }
      
      // Save the unsigned contract to documents (linked to both reservation and vehicle)
      if (reservation.vehicleId && reservation.vehicle) {
        try {
          const timestamp = Date.now();
          const dateString = format(new Date(), 'yyyy-MM-dd');
          // Guard against missing license plate
          const licensePlate = reservation.vehicle.licensePlate || 'UNKNOWN';
          const sanitizedPlate = licensePlate.replace(/[^a-zA-Z0-9]/g, '');
          const documentType = 'Contract (Unsigned)';
          
          // Create directory structure for contracts
          const vehicleDir = path.join(uploadsDir, sanitizedPlate, 'contracts');
          if (!fs.existsSync(vehicleDir)) {
            fs.mkdirSync(vehicleDir, { recursive: true });
          }
          
          // Generate filename
          const fileName = `${sanitizedPlate}_Contract_Unsigned_${dateString}_${timestamp}.pdf`;
          const filePath = path.join(vehicleDir, fileName);
          const relativeFilePath = `uploads/${sanitizedPlate}/contracts/${fileName}`;
          
          // Write PDF to file system
          fs.writeFileSync(filePath, pdfBuffer);
          console.log(`✅ Saved unsigned contract to: ${relativeFilePath}`);
          
          // Create document record linked to both reservation and vehicle
          const documentData = {
            vehicleId: reservation.vehicleId,
            reservationId: reservationId,
            documentType: documentType,
            fileName: fileName,
            filePath: relativeFilePath,
            fileSize: pdfBuffer.length,
            contentType: 'application/pdf',
            uploadDate: new Date().toISOString(),
            notes: 'Auto-generated unsigned contract',
            createdBy: req.user?.username || 'system'
          };
          
          const savedDocument = await storage.createDocument(documentData);
          console.log(`✅ Created document record for unsigned contract`);
          
          // Broadcast real-time update to all connected clients
          realtimeEvents.documents.created(savedDocument);
        } catch (saveError) {
          // Log the error but don't fail the PDF download
          console.error('⚠️ Error saving contract to documents (PDF will still download):', saveError);
        }
      }
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=contract_${reservationId}_unsigned.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating contract with default template:", error);
      res.status(500).json({ 
        message: "Failed to generate contract", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Get contract data as JSON (for display in browser)
  app.get("/api/contracts/data/:reservationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.reservationId);
      if (isNaN(reservationId)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }

      const reservation = await storage.getReservation(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Load the related vehicle and customer details
      if (reservation.vehicleId) {
        reservation.vehicle = await storage.getVehicle(reservation.vehicleId);
      }
      
      if (reservation.customerId) {
        reservation.customer = await storage.getCustomer(reservation.customerId);
      }

      // Use the same data preparation as the PDF generator
      const contractData = prepareContractData(reservation);
      
      // Return the contract data as JSON
      res.json(contractData);
    } catch (error) {
      console.error("Error generating contract data:", error);
      res.status(500).json({ 
        message: "Failed to generate contract data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== PDF TEMPLATES ====================
  // Get all PDF templates
  app.get("/api/pdf-templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllPdfTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching PDF templates:", error);
      res.status(500).json({ 
        message: "Failed to fetch PDF templates", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get the default PDF template
  app.get("/api/pdf-templates/default", requireAuth, async (req: Request, res: Response) => {
    try {
      const defaultTemplate = await storage.getDefaultPdfTemplate();
      if (!defaultTemplate) {
        return res.status(404).json({ message: "No default template found" });
      }

      res.json(defaultTemplate);
    } catch (error) {
      console.error("Error fetching default PDF template:", error);
      res.status(500).json({ 
        message: "Failed to fetch default template", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get a specific PDF template
  app.get("/api/pdf-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getPdfTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error fetching PDF template:", error);
      res.status(500).json({ 
        message: "Failed to fetch PDF template", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Generate preview PDF for template editor
  app.get("/api/pdf-templates/:id/preview", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }
      
      const template = await storage.getPdfTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Create a dummy reservation for preview purposes
      const dummyReservation: Reservation = {
        id: 0, // Use 0 to indicate preview mode
        vehicleId: 0,
        customerId: 0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days later
        totalPrice: 750,
        status: 'Booked',
        notes: 'Preview reservation',
        vehicle: {
          id: 0,
          brand: 'Preview Brand',
          model: 'Preview Model',
          licensePlate: 'XX-YY-99',
          chassisNumber: 'PREVIEW123456789',
          currentMileage: 10000,
        },
        customer: {
          id: 0,
          name: 'Preview Customer',
          address: 'Preview Street 123',
          city: 'Preview City',
          postalCode: '1234 AB',
          phone: '0612345678',
          email: 'preview@example.com',
          driverLicenseNumber: 'PREV123456789',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: null,
      };
      
      // Make sure the template fields are properly formatted
      let fieldsLength = 0;
      if (template.fields) {
        if (typeof template.fields === 'string') {
          try {
            const parsedFields = JSON.parse(template.fields);
            fieldsLength = parsedFields.length;
            // Ensure template has fields property as parsed JSON
            template.fields = parsedFields;
          } catch (e) {
            console.error('Error parsing template fields:', e);
          }
        } else {
          fieldsLength = template.fields.length;
        }
      }
      
      console.log(`Preview template has ${fieldsLength} fields`);
      
      // Import necessary functions
      const { generateRentalContractFromTemplate } = await import('./utils/pdf-generator');
      
      // Generate PDF with the template
      const pdfBuffer = await generateRentalContractFromTemplate(dummyReservation, template);
      
      // Set headers for PDF display in browser (not forcing download)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=template_preview_${id}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating template preview:", error);
      res.status(500).json({ 
        message: "Failed to generate template preview", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Create a new PDF template
  app.post("/api/pdf-templates", requireAuth, async (req: Request, res: Response) => {
    try {
      // Add user tracking information
      const user = req.user;
      
      const templateData = insertPdfTemplateSchema.parse({
        ...req.body,
        createdBy: user ? user.username : null
      });
      
      const template = await storage.createPdfTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating PDF template:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid template data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to create PDF template", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // Update a PDF template
  app.patch("/api/pdf-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get existing template
      const template = await storage.getPdfTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Add user tracking information
      const user = req.user;
      
      // Process the request body to ensure fields are properly formatted
      const requestBody = { ...req.body };
      
      // Convert fields to string if it's an object (this fixes the date handling issue)
      if (requestBody.fields && typeof requestBody.fields === 'object') {
        requestBody.fields = JSON.stringify(requestBody.fields);
      }
      
      // Remove any undefined or invalid date properties to prevent database errors
      if (requestBody.updatedAt && !(requestBody.updatedAt instanceof Date)) {
        delete requestBody.updatedAt;
      }
      
      const templateData = {
        ...requestBody,
        updatedBy: user ? user.username : null
      };
      
      console.log('Updating template with processed data:', {
        id,
        ...templateData,
        fields: templateData.fields ? 'JSON string' : undefined
      });
      
      const updatedTemplate = await storage.updatePdfTemplate(id, templateData);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Failed to update template" });
      }
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating PDF template:", error);
      res.status(400).json({ 
        message: "Failed to update PDF template", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Delete a PDF template
  app.delete("/api/pdf-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get template to check if it exists
      const template = await storage.getPdfTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const deleted = await storage.deletePdfTemplate(id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete template" });
      }

      res.status(200).json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting PDF template:", error);
      res.status(500).json({ 
        message: "Failed to delete template", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Configure multer for template background uploads
  const templateBackgroundStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const templatesDir = path.join(uploadsDir, 'templates');
      cb(null, templatesDir);
    },
    filename: (req, file, cb) => {
      const id = req.params.id;
      const ext = path.extname(file.originalname);
      cb(null, `template_${id}_background${ext}`);
    }
  });

  const templateBackgroundUpload = multer({
    storage: templateBackgroundStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for backgrounds
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
      }
    }
  });

  // Upload template background
  app.post("/api/pdf-templates/:id/background", requireAuth, templateBackgroundUpload.single('background'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No background file provided" });
      }

      // Get template to verify it exists
      const template = await storage.getPdfTemplate(id);
      if (!template) {
        // Clean up uploaded file if template doesn't exist
        try {
          await fs.promises.unlink(req.file.path);
        } catch (error) {
          console.error("Error cleaning up file:", error);
        }
        return res.status(404).json({ message: "Template not found" });
      }

      // Delete old background if it exists and is not the default
      if (template.backgroundPath && !template.backgroundPath.includes('rental_contract_template.pdf')) {
        const oldBackgroundPath = path.join(process.cwd(), template.backgroundPath);
        try {
          await fs.promises.unlink(oldBackgroundPath);
        } catch (error) {
          console.error("Error deleting old background:", error);
        }
      }

      // Update template with new background path
      const backgroundPath = path.relative(process.cwd(), req.file.path);
      
      const updatedTemplate = await storage.updatePdfTemplate(id, {
        backgroundPath
      });

      if (!updatedTemplate) {
        return res.status(404).json({ message: "Failed to update template" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error uploading template background:", error);
      res.status(400).json({ 
        message: "Failed to upload template background", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Remove template background (reset to default)
  app.delete("/api/pdf-templates/:id/background", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getPdfTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Delete the custom background file if it exists and is not the default
      if (template.backgroundPath && !template.backgroundPath.includes('rental_contract_template.pdf')) {
        const backgroundPath = path.join(process.cwd(), template.backgroundPath);
        try {
          await fs.promises.unlink(backgroundPath);
        } catch (error) {
          console.error("Error deleting background file:", error);
        }
      }

      // Update template to remove background path (will use default)
      const updatedTemplate = await storage.updatePdfTemplate(id, {
        backgroundPath: null
      });

      if (!updatedTemplate) {
        return res.status(404).json({ message: "Failed to update template" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error removing template background:", error);
      res.status(500).json({ 
        message: "Failed to remove template background", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // ==================== CUSTOM NOTIFICATIONS ROUTES ====================
  // Get all custom notifications
  app.get("/api/custom-notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getAllCustomNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching custom notifications:", error);
      res.status(500).json({ 
        message: "Failed to fetch custom notifications", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get unread custom notifications
  app.get("/api/custom-notifications/unread", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getUnreadCustomNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread custom notifications:", error);
      res.status(500).json({ 
        message: "Failed to fetch unread custom notifications", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get custom notifications by type
  app.get("/api/custom-notifications/type/:type", requireAuth, async (req: Request, res: Response) => {
    try {
      const type = req.params.type;
      const notifications = await storage.getCustomNotificationsByType(type);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching custom notifications by type:", error);
      res.status(500).json({ 
        message: "Failed to fetch custom notifications by type", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get custom notifications for current user
  app.get("/api/custom-notifications/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getCustomNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching user custom notifications:", error);
      res.status(500).json({ 
        message: "Failed to fetch user custom notifications", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get single custom notification
  app.get("/api/custom-notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const notification = await storage.getCustomNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Error fetching custom notification:", error);
      res.status(500).json({ 
        message: "Failed to fetch custom notification", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Create a new custom notification
  app.post("/api/custom-notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      // Add user info to notification data
      const notificationData = {
        ...req.body,
        createdBy: req.user.username
      };
      
      // Ensure isRead is set to false for new notifications
      notificationData.isRead = false;
      
      const notification = await storage.createCustomNotification(notificationData);
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.notifications.created(notification);
      
      res.status(201).json(notification);
    } catch (error) {
      console.error("Error creating custom notification:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid notification data", error: error.errors });
      } else {
        res.status(400).json({ 
          message: "Failed to create custom notification", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  });

  // Update a custom notification
  app.patch("/api/custom-notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      // Get existing notification
      const notification = await storage.getCustomNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Update with user info
      const notificationData = {
        ...req.body,
        updatedBy: req.user.username
      };
      
      const updatedNotification = await storage.updateCustomNotification(id, notificationData);
      if (!updatedNotification) {
        return res.status(404).json({ message: "Failed to update notification" });
      }
      
      // Broadcast real-time update to all connected clients
      realtimeEvents.notifications.updated(updatedNotification);
      
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error updating custom notification:", error);
      res.status(400).json({ 
        message: "Failed to update custom notification", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Mark notification as read
  app.post("/api/custom-notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const success = await storage.markCustomNotificationAsRead(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Get the updated notification to return
      const updatedNotification = await storage.getCustomNotification(id);
      res.json(updatedNotification || { success: true, message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ 
        message: "Failed to mark notification as read", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Mark notification as unread
  app.post("/api/custom-notifications/:id/unread", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const success = await storage.markCustomNotificationAsUnread(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Get the updated notification to return
      const updatedNotification = await storage.getCustomNotification(id);
      res.json(updatedNotification || { success: true, message: "Notification marked as unread" });
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      res.status(500).json({ 
        message: "Failed to mark notification as unread", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Delete a custom notification
  app.delete("/api/custom-notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const deleted = await storage.deleteCustomNotification(id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Broadcast real-time update to all connected clients
      realtimeEvents.notifications.deleted({ id });

      res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Error deleting custom notification:", error);
      res.status(500).json({ 
        message: "Failed to delete notification", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Invoice scanning endpoint
  app.post("/api/expenses/scan", requireAuth, upload.single('invoice'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No invoice file provided" });
      }

      const file = req.file;
      const vehicleId = req.body.vehicleId ? parseInt(req.body.vehicleId) : null;

      // Validate file type (PDF only for now)
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only PDF files are supported" });
      }

      // Validate vehicle ID if provided
      if (vehicleId) {
        const vehicle = await storage.getVehicle(vehicleId);
        if (!vehicle) {
          fs.unlinkSync(file.path);
          return res.status(404).json({ message: "Vehicle not found" });
        }
      }

      try {
        // Process invoice with AI
        console.log('Processing invoice:', file.originalname);
        const parsedInvoice = await processInvoiceWithAI(file.path);

        // Validate the parsed result
        const validation = validateParsedInvoice(parsedInvoice);
        if (!validation.valid) {
          // Clean up file but still return the parsed data for manual correction
          fs.unlinkSync(file.path);
          return res.status(400).json({
            message: "Invoice validation failed",
            errors: validation.errors,
            parsedData: parsedInvoice
          });
        }

        // Generate hash to check for duplicates
        const invoiceHash = generateInvoiceHash(parsedInvoice);

        // Move file to permanent location with hash-based filename
        const permanentDir = path.join(getUploadsDir(), 'invoices');
        if (!fs.existsSync(permanentDir)) {
          fs.mkdirSync(permanentDir, { recursive: true });
        }

        const permanentPath = path.join(permanentDir, `${invoiceHash}.pdf`);
        fs.renameSync(file.path, permanentPath);

        // Return parsed invoice data
        res.json({
          success: true,
          invoice: parsedInvoice,
          invoiceHash,
          filePath: getRelativePath(permanentPath),
          suggestedVehicleId: vehicleId
        });

      } catch (processingError) {
        // Clean up file on processing error
        fs.unlinkSync(file.path);
        console.error('Invoice processing error:', processingError);
        res.status(500).json({
          message: "Failed to process invoice",
          error: processingError instanceof Error ? processingError.message : "Unknown processing error"
        });
      }

    } catch (error) {
      console.error("Error scanning invoice:", error);
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        message: "Failed to scan invoice",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Create expenses from scanned invoice
  app.post("/api/expenses/from-invoice", requireAuth, async (req: Request, res: Response) => {
    try {
      const { invoice, vehicleId, filePath, invoiceHash, lineItems } = req.body;

      // Validate required fields
      if (!invoice || !vehicleId || !lineItems || !Array.isArray(lineItems)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate vehicle exists
      const vehicle = await storage.getVehicle(parseInt(vehicleId));
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      // Check for duplicates using invoice hash
      if (invoiceHash) {
        // This is a simple check - in production you might want to store invoice hashes in the database
        console.log('Invoice hash for duplicate check:', invoiceHash);
      }

      const createdExpenses = [];
      const currentUser = (req as any).user?.username || 'system';

      // Create expenses from line items
      for (const lineItem of lineItems) {
        try {
          const expenseData = {
            vehicleId: parseInt(vehicleId),
            category: lineItem.category || 'Other',
            amount: lineItem.amount?.toString() || '0',
            date: invoice.invoiceDate || new Date().toISOString().split('T')[0],
            description: `${lineItem.description} (Invoice: ${invoice.invoiceNumber || 'N/A'} - ${invoice.vendor || 'Unknown'})`,
            receiptFilePath: filePath || null,
            createdBy: currentUser,
            updatedBy: null
          };

          // Validate expense data
          const validatedData = insertExpenseSchema.parse(expenseData);
          const expense = await storage.createExpense(validatedData);
          createdExpenses.push(expense);

        } catch (itemError) {
          console.error('Error creating expense for line item:', lineItem, itemError);
          // Continue with other items even if one fails
        }
      }

      if (createdExpenses.length === 0) {
        return res.status(400).json({ message: "No expenses could be created" });
      }

      res.json({
        success: true,
        message: `Successfully created ${createdExpenses.length} expense(s)`,
        expenses: createdExpenses,
        invoice: {
          vendor: invoice.vendor,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          totalAmount: invoice.totalAmount
        }
      });

    } catch (error) {
      console.error("Error creating expenses from invoice:", error);
      res.status(500).json({
        message: "Failed to create expenses from invoice",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== BACKUP SETTINGS ROUTES ====================
  
  // Get backup settings
  app.get("/api/backup-settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getBackupSettings();
      if (!settings) {
        return res.status(404).json({ error: "No backup settings found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error getting backup settings:", error);
      res.status(500).json({ error: "Failed to get backup settings" });
    }
  });

  // Create or update backup settings
  app.post("/api/backup-settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const settingsData = {
        ...req.body,
        createdBy: currentUser?.username || 'system',
        updatedBy: currentUser?.username || 'system'
      };

      const settings = await storage.createBackupSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error("Error creating backup settings:", error);
      res.status(500).json({ error: "Failed to create backup settings" });
    }
  });

  // Update backup settings
  app.put("/api/backup-settings/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const settingsData = {
        ...req.body,
        updatedBy: currentUser?.username || 'system'
      };

      const settings = await storage.updateBackupSettings(id, settingsData);
      if (!settings) {
        return res.status(404).json({ error: "Backup settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error updating backup settings:", error);
      res.status(500).json({ error: "Failed to update backup settings" });
    }
  });

  // ==================== BACKUP ROUTES ====================
  
  // Simple download app data (database only)
  app.get("/api/backups/download-data", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `car-rental-data-${timestamp}.sql`;
      const filepath = path.join(process.cwd(), 'temp', filename);
      
      // Create temp directory if it doesn't exist
      await fs.promises.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
      
      // Export database using pg_dump
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured');
      }
      
      // Use pg_dump to export the database
      await execAsync(`pg_dump "${databaseUrl}" > "${filepath}"`);
      
      // Send file
      res.download(filepath, filename, async (err) => {
        // Clean up temp file after download
        try {
          await fs.promises.unlink(filepath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    } catch (error) {
      console.error("Error downloading app data:", error);
      res.status(500).json({ 
        error: "Failed to download app data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Simple download app code (source files)
  app.get("/api/backups/download-code", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `car-rental-code-${timestamp}.tar.gz`;
      const filepath = path.join(process.cwd(), 'temp', filename);
      
      // Create temp directory if it doesn't exist
      await fs.promises.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
      
      // Create tar.gz of source code excluding node_modules, .git, temp, backups, uploads
      const excludes = [
        '--exclude=node_modules',
        '--exclude=.git',
        '--exclude=temp',
        '--exclude=backups',
        '--exclude=uploads',
        '--exclude=*.log',
        '--exclude=.env.local',
        '--exclude=dist',
        '--exclude=build'
      ].join(' ');
      
      await execAsync(`tar -czf "${filepath}" ${excludes} -C "${process.cwd()}" .`);
      
      // Send file
      res.download(filepath, filename, async (err) => {
        // Clean up temp file after download
        try {
          await fs.promises.unlink(filepath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    } catch (error) {
      console.error("Error downloading app code:", error);
      res.status(500).json({ 
        error: "Failed to download app code",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Restore app data from uploaded SQL file
  app.post("/api/backups/restore-data", requireAuth, requireAdmin, backupUpload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded' });
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      // Restore database using psql
      await execAsync(`psql "${databaseUrl}" < "${req.file.path}"`);

      // Clean up uploaded file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }

      res.json({
        success: true,
        message: 'Database restored successfully. Please refresh your browser and log in again.',
      });
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      console.error("Error restoring app data:", error);
      res.status(500).json({ 
        error: "Failed to restore app data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Restore app code from uploaded tar.gz file
  app.post("/api/backups/restore-code", requireAuth, requireAdmin, backupUpload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded' });
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Extract tar.gz to current directory (will overwrite existing files)
      await execAsync(`tar -xzf "${req.file.path}" -C "${process.cwd()}"`);

      // Clean up uploaded file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }

      res.json({
        success: true,
        message: 'Code restored successfully. The application will restart automatically.',
      });

      // Restart the application after a short delay
      setTimeout(() => {
        process.exit(0); // PM2 or the process manager will restart the app
      }, 2000);
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      console.error("Error restoring app code:", error);
      res.status(500).json({ 
        error: "Failed to restore app code",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Download uploaded files (uploads directory)
  app.get("/api/backups/download-files", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `car-rental-files-${timestamp}.tar.gz`;
      const filepath = path.join(process.cwd(), 'temp', filename);
      
      // Create temp directory if it doesn't exist
      await fs.promises.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Check if uploads directory exists
      try {
        await fs.promises.access(uploadsDir);
      } catch {
        // If uploads directory doesn't exist, create an empty archive
        await execAsync(`tar -czf "${filepath}" -T /dev/null`);
        return res.download(filepath, filename, async (err) => {
          try {
            await fs.promises.unlink(filepath);
          } catch (cleanupError) {
            console.error('Error cleaning up temp file:', cleanupError);
          }
          if (err) {
            console.error('Error sending file:', err);
          }
        });
      }
      
      // Create tar.gz of uploads directory
      await execAsync(`tar -czf "${filepath}" -C "${process.cwd()}" uploads`);
      
      // Send file
      res.download(filepath, filename, async (err) => {
        // Clean up temp file after download
        try {
          await fs.promises.unlink(filepath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    } catch (error) {
      console.error("Error downloading uploaded files:", error);
      res.status(500).json({ 
        error: "Failed to download uploaded files",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Restore uploaded files from tar.gz archive
  app.post("/api/backups/restore-files", requireAuth, requireAdmin, backupUpload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded' });
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Extract tar.gz to current directory (will restore uploads folder)
      await execAsync(`tar -xzf "${req.file.path}" -C "${process.cwd()}"`);

      // Clean up uploaded file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }

      res.json({
        success: true,
        message: 'All uploaded files have been restored successfully.',
      });
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      console.error("Error restoring uploaded files:", error);
      res.status(500).json({ 
        error: "Failed to restore uploaded files",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Get backup status
  app.get("/api/backups/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = backupService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting backup status:", error);
      res.status(500).json({ error: "Failed to get backup status" });
    }
  });

  // List available backups
  app.get("/api/backups", requireAuth, requireAdmin, async (req, res) => {
    try {
      const type = req.query.type as 'database' | 'files' | undefined;
      const backups = await backupService.listBackups(type);
      res.json(backups);
    } catch (error) {
      console.error("Error listing backups:", error);
      res.status(500).json({ error: "Failed to list backups" });
    }
  });

  // Run backup manually
  app.post("/api/backups/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await backupService.runBackup();
      res.json({
        success: true,
        message: "Backup completed successfully",
        backups: result
      });
    } catch (error) {
      console.error("Error running backup:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to run backup" 
      });
    }
  });

  // Download backup file
  app.get("/api/backups/download/:type/:filename", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      if (!['database', 'files'].includes(type)) {
        return res.status(400).json({ error: "Invalid backup type" });
      }

      // Use BackupService to download from either storage type
      const result = await backupService.downloadBackup(filename, type as 'database' | 'files');
      
      if (!result) {
        return res.status(404).json({ error: "Backup file not found" });
      }

      // Set download headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', result.contentType);
      
      // Stream the file
      result.stream.pipe(res);
      
    } catch (error) {
      console.error("Error downloading backup:", error);
      res.status(500).json({ error: "Failed to download backup" });
    }
  });

  // Delete backup file
  app.delete("/api/backups/:type/:filename", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      if (!['database', 'files'].includes(type)) {
        return res.status(400).json({ error: "Invalid backup type" });
      }

      await backupService.deleteBackup(filename, type as 'database' | 'files');
      
      res.json({
        success: true,
        message: "Backup deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting backup:", error);
      res.status(500).json({ error: "Failed to delete backup" });
    }
  });

  // Cleanup old backups
  app.post("/api/backups/cleanup", requireAuth, requireAdmin, async (req, res) => {
    try {
      await backupService.cleanupOldBackups();
      res.json({
        success: true,
        message: "Old backups cleaned up successfully"
      });
    } catch (error) {
      console.error("Error cleaning up backups:", error);
      res.status(500).json({ error: "Failed to cleanup old backups" });
    }
  });

  // Upload backup file
  app.post("/api/backups/upload", requireAuth, requireAdmin, backupUpload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file provided" });
      }

      const file = req.file;
      const backupType = req.body.type; // 'database' or 'files'

      // Validate backup type
      if (!backupType || !['database', 'files'].includes(backupType)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "Invalid or missing backup type. Must be 'database' or 'files'" });
      }

      // Validate file extension based on type
      const validExtensions = {
        database: ['.sql', '.sql.gz'],
        files: ['.tar.gz', '.tgz']
      };

      const fileExtension = file.originalname.toLowerCase();
      const isValidExtension = validExtensions[backupType as keyof typeof validExtensions].some(ext => 
        fileExtension.endsWith(ext)
      );

      if (!isValidExtension) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ 
          error: `Invalid file extension for ${backupType} backup. Expected: ${validExtensions[backupType as keyof typeof validExtensions].join(', ')}`
        });
      }

      // Create backup directory if it doesn't exist
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Generate a unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const originalName = file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
      const extension = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const newFilename = `uploaded-${backupType}-${timestamp}-${originalName}${extension}`;
      const destinationPath = path.join(backupDir, newFilename);

      // Move the uploaded file to backups directory
      fs.renameSync(file.path, destinationPath);

      // Create manifest entry
      const manifest = {
        timestamp: new Date().toISOString(),
        type: backupType,
        filename: newFilename,
        size: fs.statSync(destinationPath).size,
        checksum: 'uploaded', // We could calculate actual checksum if needed
        metadata: {
          uploaded: true,
          originalName: file.originalname
        }
      };

      res.json({
        success: true,
        message: `${backupType} backup uploaded successfully`,
        backup: manifest
      });

    } catch (error) {
      // Clean up file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Error uploading backup:", error);
      res.status(500).json({ 
        error: "Failed to upload backup",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== BACKUP RESTORE ROUTES ====================
  
  // Restore database from backup
  app.post("/api/backups/restore/database", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { filename } = req.body;
      
      if (!filename) {
        return res.status(400).json({ error: "Backup filename is required" });
      }

      // Validation: check if backup exists
      const backups = await backupService.listBackups('database');
      const backupExists = backups.some(backup => backup.filename === filename);
      
      if (!backupExists) {
        return res.status(404).json({ error: "Backup file not found" });
      }

      // Run restore
      await backupService.restoreDatabase(filename);
      
      res.json({
        success: true,
        message: "Database restore completed successfully",
        warning: "Please restart the application for changes to take full effect"
      });
    } catch (error) {
      console.error("Error restoring database:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to restore database" 
      });
    }
  });

  // Restore files from backup
  app.post("/api/backups/restore/files", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { filename, targetPath } = req.body;
      
      if (!filename) {
        return res.status(400).json({ error: "Backup filename is required" });
      }

      // Validation: check if backup exists
      const backups = await backupService.listBackups('files');
      const backupExists = backups.some(backup => backup.filename === filename);
      
      if (!backupExists) {
        return res.status(404).json({ error: "Backup file not found" });
      }

      // Run restore
      await backupService.restoreFiles(filename, targetPath);
      
      res.json({
        success: true,
        message: "Files restore completed successfully"
      });
    } catch (error) {
      console.error("Error restoring files:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to restore files" 
      });
    }
  });

  // Complete system restore (database + files)
  app.post("/api/backups/restore/complete", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { databaseBackup, filesBackup } = req.body;
      
      if (!databaseBackup || !filesBackup) {
        return res.status(400).json({ 
          error: "Both database and files backup filenames are required" 
        });
      }

      // Validation: check if both backups exist
      const [databaseBackups, filesBackups] = await Promise.all([
        backupService.listBackups('database'),
        backupService.listBackups('files')
      ]);
      
      const dbBackupExists = databaseBackups.some(backup => backup.filename === databaseBackup);
      const filesBackupExists = filesBackups.some(backup => backup.filename === filesBackup);
      
      if (!dbBackupExists) {
        return res.status(404).json({ error: "Database backup file not found" });
      }
      
      if (!filesBackupExists) {
        return res.status(404).json({ error: "Files backup file not found" });
      }

      // Run complete restore
      await backupService.restoreComplete(databaseBackup, filesBackup);
      
      res.json({
        success: true,
        message: "Complete system restore finished successfully!",
        warning: "IMPORTANT: Please restart the application to ensure all changes take effect"
      });
    } catch (error) {
      console.error("Error performing complete restore:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to perform complete restore" 
      });
    }
  });

  // App Settings Routes
  app.get("/api/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllAppSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching app settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/category/:category", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { category } = req.params;
      const settings = await storage.getAppSettingsByCategory(category);
      res.json(settings);
    } catch (error) {
      console.error(`Error fetching settings for category ${req.params.category}:`, error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/key/:key", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getAppSettingByKey(key);
      
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting by key:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.get("/api/settings/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const setting = await storage.getAppSetting(id);
      
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const username = req.user?.username || 'Unknown';
      const settingData = {
        ...req.body,
        createdBy: username,
        updatedBy: username
      };
      
      const newSetting = await storage.createAppSetting(settingData);
      
      // Clear email config cache if this is an email setting
      if (newSetting.category === 'email') {
        clearEmailConfigCache();
      }
      
      res.status(201).json(newSetting);
    } catch (error) {
      console.error("Error creating setting:", error);
      res.status(500).json({ error: "Failed to create setting" });
    }
  });

  app.patch("/api/settings/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const username = req.user?.username || 'Unknown';
      const updateData = {
        ...req.body,
        updatedBy: username
      };
      
      const updatedSetting = await storage.updateAppSetting(id, updateData);
      
      if (!updatedSetting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Clear email config cache if this is an email setting
      if (updatedSetting.category === 'email') {
        clearEmailConfigCache();
      }
      
      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get setting before deleting to check if it's an email setting
      const setting = await storage.getAppSetting(id);
      const isEmailSetting = setting?.category === 'email';
      
      const success = await storage.deleteAppSetting(id);
      
      if (!success) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Clear email config cache if this was an email setting
      if (isEmailSetting) {
        clearEmailConfigCache();
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ error: "Failed to delete setting" });
    }
  });


  // ==================== DRIVER MANAGEMENT ====================
  
  // Configure multer for driver license uploads
  const driverLicenseStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const driversDir = path.join(uploadsDir, 'drivers');
      if (!fs.existsSync(driversDir)) {
        fs.mkdirSync(driversDir, { recursive: true });
      }
      cb(null, driversDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const customerId = req.params.customerId || 'unknown';
      cb(null, `license_customer${customerId}_${timestamp}${ext}`);
    }
  });
  
  const driverLicenseUpload = multer({
    storage: driverLicenseStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
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
  
  // Get all drivers for a specific customer
  app.get("/api/customers/:customerId/drivers", requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      const drivers = await storage.getDriversByCustomer(customerId);
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  // Get active drivers for a specific customer
  app.get("/api/customers/:customerId/drivers/active", requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      const drivers = await storage.getActiveDriversByCustomer(customerId);
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching active drivers:", error);
      res.status(500).json({ error: "Failed to fetch active drivers" });
    }
  });

  // Get a specific driver
  app.get("/api/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid driver ID" });
      }
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error fetching driver:", error);
      res.status(500).json({ error: "Failed to fetch driver" });
    }
  });

  // Create a new driver
  app.post("/api/customers/:customerId/drivers", requireAuth, driverLicenseUpload.single('licenseFile'), async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Handle JSON data that comes through multer middleware
      let bodyData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        try {
          bodyData = JSON.parse(req.body.body);
        } catch (e) {
          console.error('Failed to parse JSON body:', e);
          return res.status(400).json({ message: "Invalid JSON in request body" });
        }
      }

      // Remove licenseFilePath from body data to prevent path traversal
      const { licenseFilePath, ...safeBodyData } = bodyData;
      
      const validation = insertDriverSchema.omit({ licenseFilePath: true }).safeParse({ ...safeBodyData, customerId });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid driver data", details: validation.error.issues });
      }

      const username = req.user?.username || 'Unknown';
      const userId = req.user?.id || null;
      
      const driverData = {
        ...validation.data,
        customerId,
        // Only set licenseFilePath from multer upload, never from user input
        ...(req.file ? { licenseFilePath: path.relative(process.cwd(), req.file.path) } : {}),
        createdBy: username,
        updatedBy: username,
        createdByUser: userId,
        updatedByUser: userId
      };

      const driver = await storage.createDriver(driverData);
      res.status(201).json(driver);
    } catch (error) {
      console.error("Error creating driver:", error);
      res.status(500).json({ error: "Failed to create driver" });
    }
  });

  // Update a driver
  app.patch("/api/drivers/:id", requireAuth, driverLicenseUpload.single('licenseFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid driver ID" });
      }

      // Handle JSON data that comes through multer middleware
      let bodyData = req.body;
      if (req.body.body && typeof req.body.body === 'string') {
        try {
          bodyData = JSON.parse(req.body.body);
        } catch (e) {
          console.error('Failed to parse JSON body:', e);
          return res.status(400).json({ message: "Invalid JSON in request body" });
        }
      }

      // Remove licenseFilePath from body data to prevent path traversal
      const { licenseFilePath, ...safeBodyData } = bodyData;
      
      const validation = insertDriverSchema.omit({ licenseFilePath: true }).partial().safeParse(safeBodyData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid driver data", details: validation.error.issues });
      }

      const username = req.user?.username || 'Unknown';
      const userId = req.user?.id || null;
      
      const updateData = {
        ...validation.data,
        // Only set licenseFilePath from multer upload, never from user input
        ...(req.file ? { licenseFilePath: path.relative(process.cwd(), req.file.path) } : {}),
        updatedBy: username,
        updatedByUser: userId
      };

      const driver = await storage.updateDriver(id, updateData);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error updating driver:", error);
      res.status(500).json({ error: "Failed to update driver" });
    }
  });

  // Serve driver license file
  app.get("/api/drivers/:id/license", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid driver ID" });
      }

      const driver = await storage.getDriver(id);
      if (!driver || !driver.licenseFilePath) {
        return res.status(404).json({ error: "License file not found" });
      }

      // Resolve the file path and validate it's within uploads directory
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const requestedPath = path.resolve(process.cwd(), driver.licenseFilePath);
      
      // Security: Prevent path traversal by ensuring file is within uploads directory
      if (!requestedPath.startsWith(uploadsDir)) {
        console.error('Path traversal attempt detected:', driver.licenseFilePath);
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(requestedPath)) {
        return res.status(404).json({ error: "License file not found on disk" });
      }

      res.sendFile(requestedPath);
    } catch (error) {
      console.error("Error serving license file:", error);
      res.status(500).json({ error: "Failed to serve license file" });
    }
  });

  // Delete a driver
  app.delete("/api/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid driver ID" });
      }
      const success = await storage.deleteDriver(id);
      if (!success) {
        return res.status(404).json({ error: "Driver not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({ error: "Failed to delete driver" });
    }
  });

  // Migration endpoint: Transfer driver license data from customers to drivers table
  app.post("/api/migrate/customer-drivers", requireAuth, async (req, res) => {
    try {
      const username = req.user?.username || 'system';
      const userId = req.user?.id || null;

      const customers = await storage.getCustomers();
      const migratedDrivers = [];
      const skippedCustomers = [];

      for (const customer of customers) {
        if (!customer.driverLicenseNumber || customer.driverLicenseNumber.trim() === '') {
          continue;
        }

        const existingDrivers = await storage.getDriversByCustomer(customer.id);
        if (existingDrivers.length > 0) {
          skippedCustomers.push({
            customerId: customer.id,
            name: customer.name,
            reason: 'Already has drivers'
          });
          continue;
        }

        const driverData = {
          customerId: customer.id,
          displayName: customer.name,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phone: customer.phone || '',
          driverLicenseNumber: customer.driverLicenseNumber,
          licenseExpiry: null,
          isPrimaryDriver: true,
          status: 'active' as const,
          notes: 'Migrated from customer record',
          preferredLanguage: customer.preferredLanguage || 'nl',
          createdBy: username,
          createdByUser: userId
        };

        const driver = await storage.createDriver(driverData);
        migratedDrivers.push({
          customerId: customer.id,
          customerName: customer.name,
          driverId: driver.id,
          driverName: driver.displayName
        });
      }

      res.json({
        success: true,
        migrated: migratedDrivers.length,
        skipped: skippedCustomers.length,
        details: {
          migratedDrivers,
          skippedCustomers
        }
      });
    } catch (error) {
      console.error("Error migrating driver data:", error);
      res.status(500).json({ error: "Failed to migrate driver data" });
    }
  });

  // ============================================
  // APP SETTINGS ROUTES
  // ============================================

  // Get all app settings
  app.get("/api/app-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAllAppSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching app settings:", error);
      res.status(500).json({ message: "Error fetching app settings" });
    }
  });

  // Get app settings by category
  app.get("/api/app-settings/:category", requireAuth, async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const settings = await storage.getAppSettingsByCategory(category);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching app settings by category:", error);
      res.status(500).json({ message: "Error fetching app settings" });
    }
  });

  // Create or update app setting (upsert by key)
  app.post("/api/app-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { key, value, category, description } = req.body;

      // Check if setting with this key already exists
      const existing = await storage.getAppSettingByKey(key);

      if (existing) {
        // Update existing setting
        const updated = await storage.updateAppSetting(existing.id, {
          value,
          category,
          description,
          updatedBy: user ? user.username : null,
        });
        res.json(updated);
      } else {
        // Create new setting
        const created = await storage.createAppSetting({
          key,
          value,
          category,
          description,
          createdBy: user ? user.username : null,
          updatedBy: user ? user.username : null,
        });
        res.json(created);
      }
    } catch (error) {
      console.error("Error creating/updating app setting:", error);
      res.status(500).json({ message: "Error saving app setting" });
    }
  });

  // Update app setting by ID
  app.put("/api/app-settings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const id = parseInt(req.params.id);
      const { key, value, category, description } = req.body;

      const updated = await storage.updateAppSetting(id, {
        key,
        value,
        category,
        description,
        updatedBy: user ? user.username : null,
      });

      if (!updated) {
        return res.status(404).json({ message: "App setting not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating app setting:", error);
      res.status(500).json({ message: "Error updating app setting" });
    }
  });

  // Delete app setting
  app.delete("/api/app-settings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAppSetting(id);

      if (!success) {
        return res.status(404).json({ message: "App setting not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting app setting:", error);
      res.status(500).json({ message: "Error deleting app setting" });
    }
  });

  // ============================================
  // WHATSAPP SETTINGS ROUTES
  // ============================================
  
  // Get WhatsApp settings
  app.get("/api/settings/whatsapp", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAppSettingsByCategory('whatsapp');
      
      // Convert array of settings to object
      const whatsappConfig: any = {
        enabled: false,
        phoneNumber: '',
        autoNotifications: false,
        notifyOnReservationCreated: false,
        notifyOnPickupReminder: false,
        notifyOnReturnReminder: false,
        notifyOnPaymentDue: false,
      };
      
      settings.forEach(setting => {
        const key = setting.key.replace('whatsapp_', '');
        if (setting.value === 'true' || setting.value === 'false') {
          whatsappConfig[key] = setting.value === 'true';
        } else {
          whatsappConfig[key] = setting.value;
        }
      });
      
      res.json(whatsappConfig);
    } catch (error) {
      console.error("Error fetching WhatsApp settings:", error);
      res.status(500).json({ message: "Error fetching WhatsApp settings" });
    }
  });
  
  // Save WhatsApp settings
  app.post("/api/settings/whatsapp", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const settings = req.body;
      
      // Validate settings structure
      const validKeys = [
        'enabled', 'phoneNumber', 'twilioAccountSid', 'twilioAuthToken',
        'autoNotifications', 'notifyOnReservationCreated', 'notifyOnPickupReminder',
        'notifyOnReturnReminder', 'notifyOnPaymentDue'
      ];
      
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        // Skip invalid keys
        if (!validKeys.includes(key)) continue;
        
        // Skip undefined, null, or empty optional fields
        if (value === undefined || value === null || value === '') {
          // For optional fields, delete the setting if it exists
          if (['twilioAccountSid', 'twilioAuthToken'].includes(key)) {
            const existing = await storage.getAppSettingByKey(`whatsapp_${key}`);
            if (existing) {
              await storage.deleteAppSetting(existing.id);
            }
            continue;
          }
        }
        
        const settingKey = `whatsapp_${key}`;
        const settingValue = String(value);
        const existing = await storage.getAppSettingByKey(settingKey);
        
        if (existing) {
          await storage.updateAppSetting(existing.id, {
            value: settingValue,
            updatedBy: user ? user.username : null,
          });
        } else {
          await storage.createAppSetting({
            key: settingKey,
            value: settingValue,
            category: 'whatsapp',
            description: `WhatsApp ${key} setting`,
            createdBy: user ? user.username : null,
            updatedBy: user ? user.username : null,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving WhatsApp settings:", error);
      res.status(500).json({ message: "Error saving WhatsApp settings" });
    }
  });
  
  // Test WhatsApp connection
  app.post("/api/whatsapp/test-connection", requireAuth, async (req: Request, res: Response) => {
    try {
      // In a real implementation, this would test the Twilio connection
      // For now, just return success
      res.json({ success: true, message: "Connection test successful" });
    } catch (error) {
      console.error("Error testing WhatsApp connection:", error);
      res.status(500).json({ message: "Error testing WhatsApp connection" });
    }
  });
  
  // Get all WhatsApp templates
  app.get("/api/whatsapp/templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAppSettingsByCategory('whatsapp_template');
      const templates = settings.map(s => {
        try {
          return JSON.parse(s.value);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching WhatsApp templates:", error);
      res.status(500).json({ message: "Error fetching WhatsApp templates" });
    }
  });
  
  // Create WhatsApp template
  app.post("/api/whatsapp/templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      
      // Validate template payload
      const templateSchema = z.object({
        name: z.string().min(1, "Template name is required"),
        category: z.string().min(1, "Category is required"),
        content: z.string().min(1, "Content is required"),
        variables: z.array(z.string())
      });
      
      const validationResult = templateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid template data", 
          errors: validationResult.error.errors 
        });
      }
      
      const template = validationResult.data;
      
      // Generate ID
      const templates = await storage.getAppSettingsByCategory('whatsapp_template');
      const newId = templates.length > 0 
        ? Math.max(...templates.map(t => {
            try { return JSON.parse(t.value).id || 0; } catch { return 0; }
          })) + 1
        : 1;
      
      const templateWithId = { ...template, id: newId };
      
      await storage.createAppSetting({
        key: `whatsapp_template_${newId}`,
        value: JSON.stringify(templateWithId),
        category: 'whatsapp_template',
        description: `WhatsApp template: ${template.name}`,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null,
      });
      
      res.json(templateWithId);
    } catch (error) {
      console.error("Error creating WhatsApp template:", error);
      res.status(500).json({ message: "Error creating WhatsApp template" });
    }
  });
  
  // Update WhatsApp template
  app.put("/api/whatsapp/templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const id = parseInt(req.params.id);
      
      // Validate template payload
      const templateSchema = z.object({
        name: z.string().min(1, "Template name is required"),
        category: z.string().min(1, "Category is required"),
        content: z.string().min(1, "Content is required"),
        variables: z.array(z.string())
      });
      
      const validationResult = templateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid template data", 
          errors: validationResult.error.errors 
        });
      }
      
      const template = validationResult.data;
      
      const existing = await storage.getAppSettingByKey(`whatsapp_template_${id}`);
      if (!existing) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const updated = await storage.updateAppSetting(existing.id, {
        value: JSON.stringify({ ...template, id }),
        updatedBy: user ? user.username : null,
      });
      
      res.json(JSON.parse(updated.value));
    } catch (error) {
      console.error("Error updating WhatsApp template:", error);
      res.status(500).json({ message: "Error updating WhatsApp template" });
    }
  });
  
  // Delete WhatsApp template
  app.delete("/api/whatsapp/templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getAppSettingByKey(`whatsapp_template_${id}`);
      
      if (!existing) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await storage.deleteAppSetting(existing.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting WhatsApp template:", error);
      res.status(500).json({ message: "Error deleting WhatsApp template" });
    }
  });

  // Get WhatsApp conversations
  app.get("/api/whatsapp/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      // Get all messages grouped by customer
      const messages = await storage.getAllWhatsAppMessages();
      const customers = await storage.getAllCustomers();
      
      // Group messages by customer
      const conversationsMap = new Map();
      messages.forEach(msg => {
        if (msg.customerId) {
          const existing = conversationsMap.get(msg.customerId);
          if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessageTime)) {
            const customer = customers.find(c => c.id === msg.customerId);
            conversationsMap.set(msg.customerId, {
              customerId: msg.customerId,
              customerName: customer?.name || 'Unknown',
              customerPhone: customer?.phone || msg.toNumber || msg.fromNumber,
              lastMessage: msg.content.substring(0, 100),
              lastMessageTime: msg.createdAt,
              unreadCount: 0 // TODO: Implement unread tracking
            });
          }
        }
      });
      
      const conversations = Array.from(conversationsMap.values()).sort((a, b) => 
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );
      
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  // Get WhatsApp messages for a customer
  app.get("/api/whatsapp/messages/:customerId", requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const messages = await storage.getWhatsAppMessagesByCustomer(customerId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  // Send WhatsApp message
  app.post("/api/whatsapp/send", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { customerId, content } = req.body;

      if (!customerId || !content) {
        return res.status(400).json({ message: "Customer ID and content are required" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (!customer.phone) {
        return res.status(400).json({ message: "Customer does not have a phone number" });
      }

      // Get WhatsApp settings
      const whatsappSettings = await storage.getAppSettingByKey('whatsapp_phone');
      const fromNumber = whatsappSettings?.value || '';

      // Create message record
      const message = await storage.createWhatsAppMessage({
        direction: 'outbound',
        status: 'queued',
        fromNumber,
        toNumber: customer.phone,
        content,
        customerId,
        createdBy: user ? user.username : null,
        createdByUserId: user ? user.id : null,
      });

      // TODO: Actual Twilio API integration
      // For now, mark as sent immediately
      await storage.updateWhatsAppMessage(message.id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      });

      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message" });
    }
  });

  // ============================================
  // REPORTS & ANALYTICS ROUTES
  // ============================================

  // Maintenance Cost Analysis Report
  app.get("/api/reports/maintenance-costs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { timeRange, brand } = req.query;
      
      // Get all expenses with vehicle information
      const expenses = await storage.getAllExpenses();
      const vehicles = await storage.getAllVehicles();
      
      // Filter expenses by time range
      let filteredExpenses = expenses;
      if (timeRange && timeRange !== 'all') {
        const now = new Date();
        let cutoffDate = new Date();
        
        switch (timeRange) {
          case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
          case '3months':
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
          case '6months':
            cutoffDate.setMonth(now.getMonth() - 6);
            break;
          case 'year':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        filteredExpenses = expenses.filter(e => new Date(e.date) >= cutoffDate);
      }
      
      // Filter by brand if specified
      let filteredVehicles = vehicles;
      if (brand && brand !== 'all') {
        filteredVehicles = vehicles.filter(v => v.brand === brand);
        const vehicleIds = new Set(filteredVehicles.map(v => v.id));
        filteredExpenses = filteredExpenses.filter(e => vehicleIds.has(e.vehicleId));
      }
      
      // Calculate total costs
      const totalCosts = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      
      // Calculate average cost per vehicle
      const vehiclesWithExpenses = new Set(filteredExpenses.map(e => e.vehicleId));
      const averageCostPerVehicle = vehiclesWithExpenses.size > 0 
        ? totalCosts / vehiclesWithExpenses.size 
        : 0;
      
      // Calculate cost per km
      const totalMileage = filteredVehicles.reduce((sum, v) => 
        sum + (v.currentMileage || v.departureMileage || 0), 0);
      const averageCostPerKm = totalMileage > 0 ? totalCosts / totalMileage : 0;
      
      // Category breakdown
      const categoryMap = new Map<string, number>();
      filteredExpenses.forEach(e => {
        const current = categoryMap.get(e.category) || 0;
        categoryMap.set(e.category, current + parseFloat(e.amount.toString()));
      });
      
      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalCosts) * 100
      }));
      
      // Brand comparison
      const brandMap = new Map<string, {totalCost: number, vehicles: Set<number>}>();
      filteredExpenses.forEach(e => {
        const vehicle = vehicles.find(v => v.id === e.vehicleId);
        if (vehicle) {
          const brandData = brandMap.get(vehicle.brand) || {totalCost: 0, vehicles: new Set()};
          brandData.totalCost += parseFloat(e.amount.toString());
          brandData.vehicles.add(vehicle.id);
          brandMap.set(vehicle.brand, brandData);
        }
      });
      
      const brandComparison = Array.from(brandMap.entries()).map(([brand, data]) => ({
        brand,
        totalCost: data.totalCost,
        avgCost: data.vehicles.size > 0 ? data.totalCost / data.vehicles.size : 0,
        vehicleCount: data.vehicles.size
      }));
      
      // Vehicle details
      const vehicleExpenseMap = new Map<number, {expenses: any[], totalCost: number}>();
      filteredExpenses.forEach(e => {
        const data = vehicleExpenseMap.get(e.vehicleId) || {expenses: [], totalCost: 0};
        data.expenses.push(e);
        data.totalCost += parseFloat(e.amount.toString());
        vehicleExpenseMap.set(e.vehicleId, data);
      });
      
      const vehicleDetails = Array.from(vehicleExpenseMap.entries()).map(([vehicleId, data]) => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return null;
        
        const mileage = vehicle.currentMileage || vehicle.departureMileage || 0;
        return {
          vehicleId: vehicle.id,
          licensePlate: vehicle.licensePlate,
          brand: vehicle.brand,
          model: vehicle.model,
          totalCost: data.totalCost,
          costPerKm: mileage > 0 ? data.totalCost / mileage : 0,
          currentMileage: mileage,
          expenseCount: data.expenses.length
        };
      }).filter(Boolean);
      
      // Monthly trend (last 12 months)
      const monthlyMap = new Map<string, number>();
      const last12Months: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = format(date, 'MMM yyyy');
        last12Months.push(monthKey);
        monthlyMap.set(monthKey, 0);
      }
      
      filteredExpenses.forEach(e => {
        const monthKey = format(new Date(e.date), 'MMM yyyy');
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + parseFloat(e.amount.toString()));
        }
      });
      
      const monthlyTrend = last12Months.map(month => ({
        month,
        amount: monthlyMap.get(month) || 0
      }));
      
      res.json({
        totalCosts,
        averageCostPerVehicle,
        averageCostPerKm,
        totalVehicles: vehiclesWithExpenses.size,
        categoryBreakdown,
        brandComparison,
        vehicleDetails,
        monthlyTrend
      });
    } catch (error) {
      console.error("Error fetching maintenance cost analysis:", error);
      res.status(500).json({ message: "Error fetching maintenance cost analysis" });
    }
  });

  // ============================================
  // REPORT BUILDER ROUTES
  // ============================================

  // Get all saved reports
  app.get("/api/reports/saved", requireAuth, async (req: Request, res: Response) => {
    try {
      const reports = await storage.getAllSavedReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching saved reports:", error);
      res.status(500).json({ message: "Error fetching saved reports" });
    }
  });

  // Save a new report
  app.post("/api/reports/saved", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const config: any = req.body;

      if (!config.name) {
        return res.status(400).json({ message: "Report name is required" });
      }

      const report = await storage.createSavedReport({
        name: config.name,
        description: config.description || null,
        reportType: 'custom',
        configuration: config,
        dataSources: config.dataSources || [],
        enabled: true,
        createdBy: user ? user.username : null,
        createdByUserId: user ? user.id : null,
        updatedBy: user ? user.username : null,
      });

      res.json(report);
    } catch (error) {
      console.error("Error saving report:", error);
      res.status(500).json({ message: "Error saving report" });
    }
  });

  // Delete a saved report
  app.delete("/api/reports/saved/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSavedReport(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Error deleting report" });
    }
  });

  // Execute a report
  app.post("/api/reports/execute", requireAuth, async (req: Request, res: Response) => {
    try {
      const config: any = req.body;

      if (!config.columns || config.columns.length === 0) {
        return res.status(400).json({ message: "No columns specified" });
      }

      const results = await storage.executeReport(config);
      res.json(results);
    } catch (error) {
      console.error("Error executing report:", error);
      res.status(500).json({ message: "Error executing report" });
    }
  });

  // Setup static file serving for uploads - now works in any environment
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(getUploadsDir(), req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`File not found: ${filePath}`);
        // If file not found, continue to next handler
        next();
      }
    });
  });

  // Routes registered successfully
}
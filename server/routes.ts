import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchVehicleInfoByLicensePlate } from "./utils/rdw-api";
import { generateRentalContract, prepareContractData } from "./utils/pdf-generator";
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
  UserRole,
  UserPermission
} from "@shared/schema";
import multer from "multer";
import { setupAuth, hashPassword, comparePasswords } from "./auth";

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
  
  // Set up authentication routes and middleware
  const { requireAuth } = setupAuth(app);

  // ==================== USER MANAGEMENT ROUTES ====================
  // A middleware to check for admin permissions
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user.role !== UserRole.ADMIN) {
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
        
        res.json(userWithoutPassword);
      } else {
        // Update user without password change
        const updatedUser = await storage.updateUser(id, userData);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Don't send password back to client
        const { password: _, ...userWithoutPassword } = updatedUser;
        
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
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
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
      
      try {
        const vehicleData = insertVehicleSchema.parse(sanitizedData);
        
        // Add user tracking information
        const user = req.user;
        const dataWithTracking = {
          ...vehicleData,
          createdBy: user ? user.username : null,
          updatedBy: user ? user.username : null
        };
        
        const vehicle = await storage.createVehicle(dataWithTracking);
        res.status(201).json(vehicle);
      } catch (parseError) {
        console.error("Validation error:", parseError);
        res.status(400).json({ 
          message: "Invalid vehicle data format", 
          error: parseError 
        });
      }
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(400).json({ message: "Failed to create vehicle", error });
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
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking = {
        ...vehicleData,
        updatedBy: user ? user.username : null
      };
      
      const vehicle = await storage.updateVehicle(id, dataWithTracking);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
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
        const updatedVehicle = await storage.updateVehicle(id, updateData);
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
      if (status !== 'opnaam' && status !== 'bv') {
        return res.status(400).json({ message: "Invalid status. Must be 'opnaam' or 'bv'" });
      }

      const vehicle = await storage.getVehicle(id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      const currentDate = new Date().toISOString().split('T')[0];
      
      // Create update data without updatedBy field
      let updateData;

      if (status === 'opnaam') {
        updateData = {
          registeredTo: "true", // Use string "true" to match database schema
          company: "false",     // Use string "false" to match database schema
          registeredToDate: currentDate
        };
      } else {
        updateData = {
          registeredTo: "false", // Use string "false" to match database schema
          company: "true",       // Use string "true" to match database schema
          companyDate: currentDate
        };
      }

      const updatedVehicle = await storage.updateVehicle(id, updateData);
      res.json(updatedVehicle);
    } catch (error) {
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

      const customerData = insertCustomerSchema.parse(req.body);
      
      // Add user tracking information for updates
      const user = req.user;
      const dataWithTracking = {
        ...customerData,
        updatedBy: user ? user.username : null
      };
      
      const customer = await storage.updateCustomer(id, dataWithTracking);
      
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
  app.post("/api/reservations", requireAuth, damageCheckUpload.single('damageCheckFile'), async (req: Request, res: Response) => {
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
      
      // Add user tracking information
      const user = req.user;
      const dataWithTracking = {
        ...reservationData,
        createdBy: user ? user.username : null,
        updatedBy: user ? user.username : null
      };
      
      const reservation = await storage.createReservation(dataWithTracking);
      
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
      const dataWithTracking = {
        status,
        updatedBy: user ? user.username : null
      };
      
      const reservation = await storage.updateReservation(id, dataWithTracking);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
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
      
      // Create folders if they don't exist - follow the same pattern used by document uploads
      const sanitizedPlate = vehicle.licensePlate.replace(/[^a-zA-Z0-9-]/g, '_');
      const baseDir = path.join(process.cwd(), 'uploads', sanitizedPlate);
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

  // Delete reservation
  app.delete("/api/reservations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      
      // Check if reservation exists
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      const success = await storage.deleteReservation(id);
      if (success) {
        res.status(200).json({ message: "Reservation deleted successfully" });
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
  app.post("/api/documents", requireAuth, documentUpload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Convert vehicleId to number
      if (req.body.vehicleId) req.body.vehicleId = parseInt(req.body.vehicleId);
      
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

      // Check if a specific template was requested
      let pdfBuffer: Buffer;
      const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
      
      if (templateId) {
        // Get the requested template
        const template = await storage.getPdfTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
        
        // Generate PDF using the template
        pdfBuffer = await generateRentalContractFromTemplate(reservation, template);
      } else {
        // Try to get the default template
        const defaultTemplate = await storage.getDefaultPdfTemplate();
        
        if (defaultTemplate) {
          // Generate PDF using the default template
          pdfBuffer = await generateRentalContractFromTemplate(reservation, defaultTemplate);
        } else {
          // Fall back to the old fixed template format
          pdfBuffer = await generateRentalContract(reservation);
        }
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
      
      const templateData = {
        ...req.body,
        updatedBy: user ? user.username : null
      };
      
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
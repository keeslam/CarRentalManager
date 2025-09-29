import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, UserRole, insertUserSchema } from "../shared/schema";
import { pool } from "./db";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";

// Extend Express.User interface with our User type properties
declare global {
  namespace Express {
    // Use 'interface' to extend the Express User type
    interface User extends Omit<import('../shared/schema').User, 'password'> {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  // Always hash passwords properly - no development exceptions
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  // Always use proper password comparison - no development exceptions
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords");
    return false;
  }
}

// Generate a strong random session secret
function generateSessionSecret(): string {
  return randomBytes(32).toString('hex');
}

// Create session store based on whether we're using a database or memory storage
function createSessionStore(useDatabase: boolean) {
  if (useDatabase) {
    const PostgresSessionStore = connectPg(session);
    return new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
  } else {
    const MemoryStore = createMemoryStore(session);
    return new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
}

export function setupAuth(app: Express) {
  // Determine storage type based on storage implementation
  const useDatabase = storage.constructor.name === 'DatabaseStorage';
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || generateSessionSecret(),
    resave: false,
    saveUninitialized: false,
    store: createSessionStore(useDatabase),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.SECURE_COOKIES === 'true', // Only use secure cookies when explicitly set (requires HTTPS)
      httpOnly: true, // Prevent XSS attacks
      sameSite: 'lax' // CSRF protection while allowing normal navigation
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }
        
        const passwordMatches = await comparePasswords(password, user.password);
        
        if (!passwordMatches) {
          return done(null, false, { message: "Incorrect password" });
        }
        
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        if (process.env.NODE_ENV === "development") {
          console.error(`Failed to deserialize user with ID ${id} - user not found`);
        }
        return done(null, false);
      }
      
      // Remove excessive logging - only log in debug mode
      if (process.env.DEBUG === "auth" && process.env.NODE_ENV === "development") {
        console.log(`Deserialized user: ${user.username} (${user.role})`);
      }
      
      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user with ID ${id}`);
      done(error);
    }
  });

  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Admin authentication middleware
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Not authorized. Admin access required." });
    }
    
    next();
  };

  // Register authentication routes (admin only)
  app.post("/api/register", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body using Zod schema
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Add audit trail (user is guaranteed to exist due to requireAdmin middleware)
      const currentUser = req.user!;
      const enrichedUserData = {
        ...userData,
        createdBy: currentUser.username,
        updatedBy: currentUser.username
      };

      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...enrichedUserData,
        password: hashedPassword,
      });

      // Return user without password (don't auto-login to preserve admin session)
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid input data", 
          error: error.message 
        });
      }
      next(error);
    }
  });

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: User | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Authentication failed" });
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = req.user as User;
    res.json(userWithoutPassword);
  });

  // Return the auth middleware
  return { requireAuth };
}
// Load environment variables from .env file
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

// ESM __dirname fix voor Docker
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appRoot = path.join(__dirname, '..'); // /app in Docker

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup authentication
const { requireAuth } = setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Debug logging voor Docker troubleshooting
    if (process.env.NODE_ENV === 'production') {
      console.log('=== PRODUCTION STARTUP DEBUG ===');
      console.log('process.cwd():', process.cwd());
      console.log('__dirname:', __dirname);
      console.log('App root:', appRoot);
      console.log('Public folder exists:', path.join(appRoot, 'public'));
      console.log('Dist folder exists:', path.join(appRoot, 'dist'));
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('PORT:', process.env.PORT);
      console.log('==============================');
    }

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error handler:', err.message);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // Setup Vite/Static serving
    if (process.env.NODE_ENV === "development") {
      console.log('Starting in development mode');
      await setupVite(app, server);
    } else {
      console.log('Starting in production mode - serving static files');
      
      // Fix: Explicitly set static file serving met absolute paths
      try {
        // Serve built assets from /dist/public
        const publicPath = path.join(appRoot, 'dist', 'public');
        console.log('Serving static files from:', publicPath);
        
        if (app.get('env') !== 'test') {
          app.use(express.static(publicPath, {
            index: false,
            maxAge: '1y',
            etag: false
          }));
          
          // API routes fallback
          app.use('/api/*', express.static(publicPath, {
            index: false,
            maxAge: '1y',
            etag: false
          }));
        }
        
        // Fallback voor client-side routing (SPA)
        app.use('*', (req, res) => {
          res.sendFile(path.join(publicPath, 'index.html'));
        });
        
        // Vervang de originele serveStatic call (die waarschijnlijk faalt)
        // serveStatic(app); // ← COMMENT UIT - vervangen door bovenstaande
      } catch (staticError) {
        console.error('Static file serving error:', staticError);
        // Fallback: serve een simpele error page
        app.use('*', (req, res) => {
          res.status(500).json({ 
            error: 'Static files not available', 
            message: 'Build assets not found - check your build process',
            debug: {
              publicPath,
              cwd: process.cwd(),
              root: appRoot
            }
          });
        });
      }
    }

    // Serve the app on port from env var or default to 5000
    // this serves both the API and the client.
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) || 5000 : 5000;
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(`🚀 Car Rental Manager API running on port ${port}`);
      console.log(`📱 Frontend available at http://localhost:${port}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📂 Working directory: ${process.cwd()}`);
      console.log(`✅ Server ready!`);
    });

  } catch (error) {
    console.error('❌ Fatal startup error:', error);
    process.exit(1);
  }
})();

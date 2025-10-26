import { Request, Response, NextFunction } from 'express';

/**
 * Strip HTML tags and dangerous characters from a string
 */
function stripHtml(value: string): string {
  // Remove HTML tags
  let sanitized = value.replace(/<[^>]*>/g, '');
  
  // Remove script and style content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove dangerous protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  
  // Decode HTML entities to prevent double encoding attacks
  sanitized = sanitized.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  sanitized = sanitized.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  sanitized = sanitized.replace(/&amp;/g, '&');
  
  // Remove the decoded tags again
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  return sanitized.trim();
}

/**
 * Sanitize string values to prevent XSS attacks
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return stripHtml(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Middleware to sanitize request body, query, and params
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
}

/**
 * Sanitize HTML content while preserving safe tags (for rich text editors)
 */
export function sanitizeHtml(html: string): string {
  // For now, strip all HTML to prevent XSS
  // If you need rich text, consider using a dedicated library like sanitize-html
  return stripHtml(html);
}

/**
 * Validate and sanitize file uploads
 */
export function validateFileUpload(
  file: Express.Multer.File,
  options: {
    maxSize?: number; // in bytes
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = [],
    allowedExtensions = [],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
    };
  }

  // Check MIME type
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type '${file.mimetype}' is not allowed`,
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension '.${ext}' is not allowed`,
      };
    }
  }

  // Additional validation: Check if file name contains suspicious characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/g;
  if (dangerousChars.test(file.originalname)) {
    return {
      valid: false,
      error: 'File name contains invalid characters',
    };
  }

  return { valid: true };
}

import { useState, useRef, useCallback, useEffect } from "react";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Scan, Loader2, X, RotateCcw, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

interface DocumentScannerProps {
  onScanComplete: (extractedData: VehicleData) => void;
  isLoading?: boolean;
}

interface VehicleData {
  licensePlate: string;
  brand: string;
  model: string;
  chassisNumber: string;
  vehicleType: string;
  fuel: string;
  apkDate: string;
}

export function DocumentScanner({ onScanComplete, isLoading = false }: DocumentScannerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Detect if device is mobile
  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const hasTouch = 'ontouchstart' in window;
      const smallScreen = window.innerWidth <= 768;
      
      return isMobileDevice || (hasTouch && smallScreen);
    };

    setIsMobile(checkIsMobile());
    
    // Re-check on resize
    const handleResize = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      toast({
        title: "Camera Access Required",
        description: "Please allow camera access to scan vehicle documents.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Capture image
  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image as data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  // Handle file upload (desktop)
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, or PDF file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let imageDataUrl: string;

      if (file.type === 'application/pdf') {
        // Handle PDF files
        imageDataUrl = await extractImageFromPDF(file);
      } else {
        // Handle image files
        imageDataUrl = await fileToDataURL(file);
      }

      setCapturedImage(imageDataUrl);
      setIsProcessing(false);

      // Auto-process the uploaded file
      await processImageFromDataURL(imageDataUrl);

    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "File Processing Failed",
        description: "Could not process the uploaded file. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  }, [toast]);

  // Convert file to data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Extract image from PDF
  const extractImageFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    
    if (pages.length === 0) {
      throw new Error('PDF contains no pages');
    }

    // For now, we'll create a canvas from the first page
    // This is a simplified approach - for better PDF processing,
    // we might want to use pdf.js or similar
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Create a canvas to render the PDF page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = width;
    canvas.height = height;

    // For simplicity, we'll show a message that PDFs need to be converted to images
    // In a production app, you'd want to properly render the PDF page
    throw new Error('PDF processing not fully implemented. Please convert your PDF to an image first.');
  };

  // Trigger file upload
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Process image from data URL with OCR
  const processImageFromDataURL = useCallback(async (imageDataUrl: string) => {
    setIsProcessing(true);
    
    try {
      // Initialize Tesseract worker
      const worker = await Tesseract.createWorker('eng');
      
      // Configure for better Dutch document recognition
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: '1',
      });
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(imageDataUrl);
      
      // Clean up worker
      await worker.terminate();
      
      setExtractedText(text);
      
      // Parse extracted text for vehicle information
      const vehicleData = parseVehicleDocument(text);
      
      if (vehicleData.licensePlate) {
        onScanComplete(vehicleData);
        setIsDialogOpen(false);
        toast({
          title: "Document Processed Successfully",
          description: `Found license plate: ${vehicleData.licensePlate}`,
        });
      } else {
        toast({
          title: "No License Plate Found",
          description: "Please try uploading a different image or enter the information manually.",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onScanComplete, toast]);

  // Process captured image with OCR (mobile camera)
  const processImage = useCallback(async () => {
    if (!capturedImage) return;
    await processImageFromDataURL(capturedImage);
  }, [capturedImage, processImageFromDataURL]);

  // Parse OCR text to extract vehicle information
  const parseVehicleDocument = (text: string): VehicleData => {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Dutch license plate patterns (multiple formats)
    const licensePlatePatterns = [
      /(\d{2}-\w{2}-\w{2})/g,      // 12-AB-34
      /(\d{2}-\w{3}-\d{1})/g,     // 12-ABC-1
      /(\w{2}-\d{3}-\w{1})/g,     // AB-123-C
      /(\w{3}-\d{2}-\w{1})/g,     // ABC-12-D
      /(\d{1}-\w{3}-\d{2})/g,     // 1-ABC-23
      /(\w{1}-\d{3}-\w{2})/g,     // A-123-BC
    ];
    
    let licensePlate = "";
    
    // Try each pattern to find license plate
    for (const pattern of licensePlatePatterns) {
      const matches = cleanText.match(pattern);
      if (matches) {
        licensePlate = matches[0];
        break;
      }
    }
    
    // Extract other information using keywords
    const extractField = (keywords: string[], text: string): string => {
      for (const keyword of keywords) {
        const regex = new RegExp(`${keyword}[:\\s]*([A-Za-z0-9\\s-]+?)(?:[\\n\\r]|$)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return "";
    };
    
    // Extract brand/manufacturer
    const brand = extractField([
      'Merk', 'Brand', 'Make', 'Fabrikant'
    ], cleanText);
    
    // Extract model/type
    const model = extractField([
      'Type', 'Model', 'Handelsnaam', 'Handelsbenaming'
    ], cleanText);
    
    // Extract chassis/VIN number
    const chassisNumber = extractField([
      'Chassis', 'VIN', 'Identificatienummer', 'Voertuigident'
    ], cleanText);
    
    // Extract fuel type
    const fuel = extractField([
      'Brandstof', 'Fuel', 'Brand'
    ], cleanText);
    
    // Extract APK date (format: DD-MM-YYYY or DD.MM.YYYY)
    const apkMatches = cleanText.match(/(\d{2}[-.\s]\d{2}[-.\s]\d{4})/g);
    let apkDate = "";
    if (apkMatches && apkMatches.length > 0) {
      // Convert to YYYY-MM-DD format for the form
      const dateStr = apkMatches[0].replace(/[-.\s]/g, '-');
      const [day, month, year] = dateStr.split('-');
      apkDate = `${year}-${month}-${day}`;
    }
    
    return {
      licensePlate,
      brand,
      model,
      chassisNumber,
      vehicleType: "",
      fuel,
      apkDate
    };
  };

  // Reset scanner
  const resetScanner = useCallback(() => {
    setCapturedImage(null);
    setExtractedText("");
    setIsProcessing(false);
    stopCamera();
  }, [stopCamera]);

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    resetScanner();
    setIsDialogOpen(false);
  }, [resetScanner]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => setIsDialogOpen(true)}
          data-testid="button-scan-document"
        >
          <Scan className="w-4 h-4 mr-2" />
          Scan Document
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl" data-testid="dialog-document-scanner">
        <DialogHeader>
          <DialogTitle>Scan Vehicle Registration Document</DialogTitle>
          <DialogDescription>
            {isMobile
              ? "Position your vehicle registration card (kentekenbewijs) in front of the camera and capture it to automatically extract vehicle information."
              : "Upload a photo or scan of your vehicle registration card (kentekenbewijs) to automatically extract vehicle information."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!capturedImage && (
            <div className="space-y-4">
              {isMobile && !isCameraActive && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Camera Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click the button below to start your camera and capture the vehicle document.
                    </p>
                    <Button onClick={startCamera} data-testid="button-start-camera">
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {!isMobile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Upload Document
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a photo or scan of your vehicle registration document. Supported formats: JPG, PNG.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      data-testid="input-file-upload"
                    />
                    <Button onClick={triggerFileUpload} data-testid="button-upload-file">
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {isMobile && isCameraActive && (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border"
                    style={{ maxHeight: '400px' }}
                    data-testid="video-camera-feed"
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  <div className="flex justify-center space-x-2">
                    <Button onClick={captureImage} data-testid="button-capture-image">
                      <Camera className="w-4 h-4 mr-2" />
                      Capture
                    </Button>
                    <Button variant="outline" onClick={stopCamera} data-testid="button-stop-camera">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {capturedImage && (
            <div className="space-y-4">
              <div>
                <img 
                  src={capturedImage} 
                  alt="Captured document" 
                  className="w-full rounded-lg border max-h-400px object-contain"
                  data-testid="img-captured-document"
                />
              </div>
              
              {!isProcessing && !extractedText && (
                <div className="flex justify-center space-x-2">
                  <Button onClick={processImage} data-testid="button-process-image">
                    <Scan className="w-4 h-4 mr-2" />
                    Process Document
                  </Button>
                  <Button variant="outline" onClick={resetScanner} data-testid="button-retry-scan">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              )}
              
              {isProcessing && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mr-2" />
                  <span>Processing document...</span>
                </div>
              )}
              
              {extractedText && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Extracted Text</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-4 rounded-md text-sm font-mono whitespace-pre-wrap max-h-200px overflow-y-auto">
                        {extractedText}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-center space-x-2">
                    <Button variant="outline" onClick={resetScanner} data-testid="button-scan-again">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Scan Again
                    </Button>
                    <Button variant="outline" onClick={handleDialogClose} data-testid="button-close-scanner">
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
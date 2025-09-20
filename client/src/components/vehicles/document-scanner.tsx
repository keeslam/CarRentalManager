import { useState, useRef, useCallback } from "react";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Scan, Loader2, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

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

  // Process captured image with OCR
  const processImage = useCallback(async () => {
    if (!capturedImage) return;
    
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
      const { data: { text } } = await worker.recognize(capturedImage);
      
      // Clean up worker
      await worker.terminate();
      
      setExtractedText(text);
      
      // Parse extracted text for vehicle information
      const vehicleData = parseVehicleDocument(text);
      
      if (vehicleData.licensePlate) {
        onScanComplete(vehicleData);
        setIsDialogOpen(false);
        toast({
          title: "Document Scanned Successfully",
          description: `Found license plate: ${vehicleData.licensePlate}`,
        });
      } else {
        toast({
          title: "No License Plate Found",
          description: "Please try capturing the document again or enter the information manually.",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: "Scanning Failed",
        description: "Failed to process the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImage, onScanComplete, toast]);

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
            Position your vehicle registration card (kentekenbewijs) in front of the camera and capture it to automatically extract vehicle information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!capturedImage && (
            <div className="space-y-4">
              {!isCameraActive && (
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
              
              {isCameraActive && (
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
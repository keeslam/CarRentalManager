import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Loader2, FileText, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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

    setSelectedFile(file);
    setExtractedData(null);
  }, [toast]);

  // Process document with AI
  const processDocument = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('document', selectedFile);

      // Send to backend for processing
      const response = await apiRequest('POST', '/api/vehicles/scan-document', formData);
      
      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setExtractedData(result.data);
        
        toast({
          title: "Document Processed Successfully",
          description: `Found vehicle: ${result.data.licensePlate || 'Unknown license plate'}`,
        });
      } else {
        throw new Error(result.error || 'Failed to extract vehicle information');
      }
      
    } catch (error) {
      console.error('Document processing error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, toast]);

  // Use extracted data
  const useExtractedData = useCallback(() => {
    if (extractedData) {
      onScanComplete(extractedData);
      setIsDialogOpen(false);
      setSelectedFile(null);
      setExtractedData(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [extractedData, onScanComplete]);

  // Reset scanner
  const resetScanner = useCallback(() => {
    setSelectedFile(null);
    setExtractedData(null);
    setIsProcessing(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Trigger file upload
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    if (!isProcessing) {
      resetScanner();
      setIsDialogOpen(false);
    }
  }, [isProcessing, resetScanner]);

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
          <FileText className="w-4 h-4 mr-2" />
          Scan Document
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl" data-testid="dialog-document-scanner">
        <DialogHeader>
          <DialogTitle>Scan Vehicle Registration Document</DialogTitle>
          <DialogDescription>
            Upload a photo or PDF of your vehicle registration document (kentekenbewijs) to automatically extract vehicle information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedFile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a photo or scan of your vehicle registration document. Supported formats: JPG, PNG, PDF.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileSelect}
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

          {selectedFile && !extractedData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Selected File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  
                  <div className="flex justify-center space-x-2">
                    <Button 
                      onClick={processDocument} 
                      disabled={isProcessing}
                      data-testid="button-process-document"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Process Document
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetScanner}
                      disabled={isProcessing}
                      data-testid="button-reset-scanner"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {extractedData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Extracted Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">License Plate:</span>
                      <p className="text-muted-foreground">{extractedData.licensePlate || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Brand:</span>
                      <p className="text-muted-foreground">{extractedData.brand || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Model:</span>
                      <p className="text-muted-foreground">{extractedData.model || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Fuel Type:</span>
                      <p className="text-muted-foreground">{extractedData.fuel || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Chassis Number:</span>
                      <p className="text-muted-foreground">{extractedData.chassisNumber || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="font-medium">APK Date:</span>
                      <p className="text-muted-foreground">{extractedData.apkDate || 'Not found'}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-2 pt-4">
                    <Button 
                      onClick={useExtractedData}
                      data-testid="button-use-data"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Use This Data
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetScanner}
                      data-testid="button-scan-again"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Scan Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
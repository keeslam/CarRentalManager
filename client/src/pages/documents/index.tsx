import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Document, Vehicle } from "@shared/schema";
import { formatDate, formatFileSize } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import PDFTemplateEditor from "./template-editor";
import { FileEdit, Star, Trash2, Printer } from "lucide-react";

export default function DocumentsIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [documentToPrint, setDocumentToPrint] = useState<Document | null>(null);
  const [iframeError, setIframeError] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });
  
  // Fetch vehicles for filter
  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/pdf-templates'],
  });
  
  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest('DELETE', `/api/documents/${documentId}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle delete document
  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };
  
  // Confirm delete document
  const confirmDeleteDocument = () => {
    if (documentToDelete) {
      deleteDocumentMutation.mutate(documentToDelete.id);
    }
  };
  
  // Handle print document
  const handlePrintDocument = (document: Document) => {
    setDocumentToPrint(document);
    setPrintDialogOpen(true);
    setIframeError(false);
    
    // Auto-fallback after 5 seconds if iframe doesn't work
    setTimeout(() => {
      if (printDialogOpen && !iframeError) {
        // If dialog is still open and no error detected yet, show fallback
        setIframeError(true);
      }
    }, 5000);
  };
  
  // Print the document directly without downloads
  const printDocument = () => {
    if (documentToPrint) {
      console.log('Attempting to print document:', documentToPrint.fileName);
      
      // First try to print from the visible iframe if it's working
      if (!iframeError) {
        const iframe = document.getElementById('print-preview-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          try {
            console.log('Trying to print from visible iframe...');
            iframe.contentWindow.print();
            console.log('Print from visible iframe succeeded');
            return; // Success, exit function
          } catch (error) {
            console.log('Failed to print from preview iframe:', error);
            console.log('Trying popup window approach...');
          }
        }
      }
      
      // Alternative approach: Print-specific popup window
      console.log('Using popup window for direct printing...');
      
      const printUrl = `/api/documents/view/${documentToPrint.id}`;
      
      // Create a small popup window specifically for printing
      const printWindow = window.open(
        printUrl, 
        'printWindow',
        'width=800,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
      );
      
      if (printWindow) {
        // Wait for the document to load, then print and close
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              console.log('Print window loaded, attempting to print...');
              printWindow.print();
              console.log('Print command sent successfully');
              
              // Close the popup after printing (with a delay)
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close();
                  console.log('Print window closed');
                }
              }, 2000);
              
              // Show success message
              toast({
                title: "Printing Started",
                description: "Print dialog should now be open. The popup will close automatically.",
                duration: 3000,
              });
              
            } catch (error) {
              console.error('Failed to print from popup window:', error);
              printWindow.close();
              
              // Last resort fallback message
              toast({
                title: "Print Failed",
                description: "Your browser blocked printing. Please use the Download button and print manually.",
                variant: "destructive",
                duration: 5000,
              });
            }
          }, 1500); // Give time for content to fully load
        };
        
        // Handle case where popup is blocked
        printWindow.onerror = () => {
          console.error('Print popup window failed to load');
          toast({
            title: "Popup Blocked",
            description: "Please allow popups and try again, or use the Download button.",
            variant: "destructive",
            duration: 5000,
          });
        };
      } else {
        console.error('Failed to open print popup window');
        toast({
          title: "Popup Blocked",
          description: "Please allow popups and try again, or use the Download button.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };
  
  // Handle iframe load error
  const handleIframeError = () => {
    setIframeError(true);
  };
  
  // Get unique document types
  const documentTypes = documents 
    ? ["all", ...new Set(documents.map(doc => doc.documentType))]
    : ["all"];
  
  // Filter documents based on search, vehicle and type filters
  const filteredDocuments = documents?.filter(doc => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      doc.fileName.toLowerCase().includes(searchLower) ||
      doc.documentType.toLowerCase().includes(searchLower) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchLower))
    );
    
    const matchesVehicle = vehicleFilter === "all" || doc.vehicleId.toString() === vehicleFilter;
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter;
    
    return matchesSearch && matchesVehicle && matchesType;
  });
  
  // Group documents by vehicle
  const documentsByVehicle = filteredDocuments?.reduce((acc, doc) => {
    if (!acc[doc.vehicleId]) {
      acc[doc.vehicleId] = [];
    }
    acc[doc.vehicleId].push(doc);
    return acc;
  }, {} as Record<number, Document[]>) || {};
  
  // Helper function to get document icon based on content type
  const getDocumentIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-gray-600">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    } else if (contentType === 'application/pdf') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text text-gray-600">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file text-gray-600">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    }
  };
  
  // Helper function to get vehicle details
  const getVehicleName = (vehicleId: number) => {
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    return vehicle 
      ? `${displayLicensePlate(vehicle.licensePlate)} - ${vehicle.brand} ${vehicle.model}`
      : `Vehicle #${vehicleId}`;
  };
  
  const [activeTab, setActiveTab] = useState("library");
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Document Management</h1>
        <Link href="/documents/upload">
          <Button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload mr-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Upload Document
          </Button>
        </Link>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">Document Library</TabsTrigger>
          <TabsTrigger value="template-editor">Contract Template Editor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>
                Manage all documents related to your vehicles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                
                <div className="flex gap-4">
                  <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vehicles</SelectItem>
                      {vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                          {displayLicensePlate(vehicle.licensePlate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "all" ? "All Document Types" : type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {isLoadingDocuments ? (
                <div className="flex justify-center items-center h-64">
                  <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : filteredDocuments?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No documents found matching your filters.
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(documentsByVehicle).map(([vehicleId, docs]) => (
                    <div key={vehicleId} className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">
                        {getVehicleName(parseInt(vehicleId))}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {docs.map((doc) => (
                          <Card key={doc.id} className="overflow-hidden">
                            <div className="bg-gray-100 p-8 flex items-center justify-center">
                              {getDocumentIcon(doc.contentType)}
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-medium mb-1 truncate" title={doc.fileName}>
                                {doc.fileName}
                              </h4>
                              <div className="flex items-center text-sm text-gray-500 mb-2">
                                <Badge variant="outline" className="mr-2">{doc.documentType}</Badge>
                                <span>{formatDate(doc.uploadDate?.toString() || "")}</span>
                              </div>
                              {doc.notes && (
                                <p className="text-sm text-gray-600 my-2 truncate" title={doc.notes}>
                                  {doc.notes}
                                </p>
                              )}
                              <div className="text-xs text-gray-500 mb-2">
                                {formatFileSize(doc.fileSize)}
                              </div>
                              <div className="flex justify-between items-center mt-2 gap-2">
                                <a 
                                  href={`/api/documents/download/${doc.id}`} 
                                  className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid={`link-download-document-${doc.id}`}
                                >
                                  Download
                                </a>
                                <button 
                                  onClick={() => handlePrintDocument(doc)}
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                  data-testid={`button-print-document-${doc.id}`}
                                >
                                  <Printer className="h-3 w-3" />
                                  Print
                                </button>
                                <button 
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                                  data-testid={`button-delete-document-${doc.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="template-editor">
          <Card>
            <CardHeader>
              <CardTitle>Contract Template Editor</CardTitle>
              <CardDescription>
                Manage contract templates for your reservations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <p className="mb-4">Open the dedicated template editor to create and manage contract templates.</p>
                <Link href="/documents/template-editor">
                  <Button>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Open Template Editor
                  </Button>
                </Link>
              </div>
              
              {isLoadingTemplates ? (
                <div className="flex justify-center items-center h-32">
                  <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : templates && Array.isArray(templates) && templates.length > 0 ? (
                <div>
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">Available Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {templates.map((template: any) => (
                      <Card key={template.id} className="overflow-hidden">
                        <div className="bg-gray-100 p-8 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text text-gray-600">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" x2="8" y1="13" y2="13" />
                            <line x1="16" x2="8" y1="17" y2="17" />
                            <line x1="10" x2="8" y1="9" y2="9" />
                          </svg>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium mb-1 truncate" title={template.name}>
                              {template.name}
                            </h4>
                            {template.isDefault && (
                              <Badge variant="secondary" className="ml-2">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          
                          <div className="mt-4 flex justify-between">
                            <Link href="/documents/template-editor">
                              <Button variant="outline" size="sm">
                                <FileEdit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </Link>
                            <a 
                              href={`/api/pdf-templates/${template.id}/preview`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 py-2"
                            >
                              Preview
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No templates found. Create your first template using the editor.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDocument}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Print Preview Dialog */}
      <AlertDialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <AlertDialogContent className="max-w-6xl w-[90vw] h-[85vh] flex flex-col">
          <AlertDialogHeader className="flex-shrink-0">
            <AlertDialogTitle>Print Preview - {documentToPrint?.fileName}</AlertDialogTitle>
            <AlertDialogDescription>
              Preview the document before printing
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-hidden border rounded mb-4">
            {documentToPrint && !iframeError && (
              <iframe
                id="print-preview-iframe"
                src={`/api/documents/view/${documentToPrint.id}`}
                className="w-full h-full border-0"
                title="Document Preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-top-navigation allow-downloads"
                onLoad={(e) => {
                  // Check if iframe content is accessible after a brief delay
                  setTimeout(() => {
                    try {
                      const iframe = e.target as HTMLIFrameElement;
                      // Check if we can access the iframe content
                      if (!iframe.contentDocument || iframe.contentDocument.body.children.length === 0) {
                        handleIframeError();
                      }
                    } catch (error) {
                      handleIframeError();
                    }
                  }, 2000); // Wait 2 seconds to allow content to load
                }}
                onError={handleIframeError}
              />
            )}
            {documentToPrint && iframeError && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Blocked</h3>
                <p className="text-gray-600 mb-4">
                  Your browser blocked the document preview due to security settings. 
                  You can still print the document - it will open in a new tab.
                </p>
                <Button 
                  onClick={() => window.open(`/api/documents/view/${documentToPrint.id}`, '_blank')}
                  variant="outline"
                  className="mb-2"
                >
                  Open in New Tab
                </Button>
              </div>
            )}
          </div>
          <AlertDialogFooter className="flex-shrink-0">
            <AlertDialogCancel onClick={() => setPrintDialogOpen(false)}>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={printDocument}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileEdit, Star, Trash2, Printer, Eye, ChevronDown, ChevronRight } from "lucide-react";

export default function DocumentsIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [documentToPrint, setDocumentToPrint] = useState<Document | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [documentToEmail, setDocumentToEmail] = useState<Document | null>(null);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [expandedDocumentTypes, setExpandedDocumentTypes] = useState<Set<string>>(new Set());
  const [itemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
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

  // Email document mutation
  const emailDocumentMutation = useMutation({
    mutationFn: async (emailData: { documentId: number; recipients: string; subject: string; message: string }) => {
      const response = await apiRequest('POST', `/api/documents/${emailData.documentId}/email`, emailData);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "The document has been successfully emailed.",
      });
      setEmailDialogOpen(false);
      setDocumentToEmail(null);
      setEmailRecipients('');
      setEmailSubject('');
      setEmailMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send email. Please try again.",
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

  // Handle email document
  const handleEmailDocument = (document: Document) => {
    setDocumentToEmail(document);
    setEmailSubject(`Document: ${document.fileName}`);
    setEmailMessage(`Please find the attached document: ${document.fileName}\n\nDocument Type: ${document.documentType}\nUpload Date: ${new Date(document.uploadDate || '').toLocaleDateString()}`);
    setEmailDialogOpen(true);
  };

  // Confirm send email
  const confirmSendEmail = () => {
    if (documentToEmail && emailRecipients.trim()) {
      emailDocumentMutation.mutate({
        documentId: documentToEmail.id,
        recipients: emailRecipients,
        subject: emailSubject,
        message: emailMessage,
      });
    }
  };

  // Check if document can be emailed (only damage and contract documents)
  const canEmailDocument = (documentType: string) => {
    const emailableTypes = ['damage', 'contract'];
    return emailableTypes.some(type => documentType.toLowerCase().includes(type));
  };
  
  // Handle view document
  const handleViewDocument = (document: Document) => {
    window.open(
      `/${document.filePath}`,
      'Document Preview',
      'width=900,height=700,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes'
    );
  };

  // Handle print document
  const handlePrintDocument = (document: Document) => {
    const printWindow = window.open(
      `/${document.filePath}`,
      'Print Preview',
      'width=900,height=700,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes'
    );
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
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
  
  // Helper function to normalize document types - combine all contract types
  const normalizeDocumentType = (type: string): string => {
    // Combine all contract types into a single "Contracts" category
    if (type.toLowerCase().includes('contract')) {
      return "Contracts";
    }
    return type;
  };
  
  // Get unique document types (normalized to group versioned contracts)
  const documentTypes = documents 
    ? ["all", ...new Set(documents.map(doc => normalizeDocumentType(doc.documentType)))]
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
    // Match both exact type and normalized type for versioned contracts
    const matchesType = typeFilter === "all" || 
                        doc.documentType === typeFilter || 
                        normalizeDocumentType(doc.documentType) === typeFilter;
    
    return matchesSearch && matchesVehicle && matchesType;
  });
  
  // Group documents by vehicle, then by category (using normalized types)
  const documentsByVehicle = filteredDocuments?.reduce((acc, doc) => {
    const normalizedType = normalizeDocumentType(doc.documentType);
    if (!acc[doc.vehicleId]) {
      acc[doc.vehicleId] = {};
    }
    if (!acc[doc.vehicleId][normalizedType]) {
      acc[doc.vehicleId][normalizedType] = [];
    }
    acc[doc.vehicleId][normalizedType].push(doc);
    return acc;
  }, {} as Record<number, Record<string, Document[]>>) || {};
  
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
  
  // Toggle vehicle expansion
  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
  };

  // Toggle document type expansion
  const toggleDocumentType = (vehicleId: string, documentType: string) => {
    const key = `${vehicleId}-${documentType}`;
    setExpandedDocumentTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
  
  // Pagination logic
  const vehicleIds = Object.keys(documentsByVehicle);
  const totalPages = Math.ceil(vehicleIds.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVehicleIds = vehicleIds.slice(startIndex, endIndex);
  
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library">Document Library</TabsTrigger>
          <TabsTrigger value="template-editor">Contract Templates</TabsTrigger>
          <TabsTrigger value="damage-check">Damage Check</TabsTrigger>
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
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Vehicles</p>
                            <p className="text-2xl font-bold">{vehicleIds.length}</p>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                              <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
                              <circle cx="6.5" cy="16.5" r="2.5"/>
                              <circle cx="16.5" cy="16.5" r="2.5"/>
                            </svg>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Documents</p>
                            <p className="text-2xl font-bold">{filteredDocuments?.length || 0}</p>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Document Types</p>
                            <p className="text-2xl font-bold">{documentTypes.length - 1}</p>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                              <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                            </svg>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    {paginatedVehicleIds.map((vehicleId) => {
                      const categoriesByType = documentsByVehicle[vehicleId as unknown as number];
                      const totalDocs = Object.values(categoriesByType).reduce((sum: number, docs) => sum + (docs as Document[]).length, 0);
                      const isExpanded = expandedVehicles.has(vehicleId);
                      
                      return (
                        <Card key={vehicleId} className="overflow-hidden">
                          <button
                            onClick={() => toggleVehicle(vehicleId)}
                            className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-500" />
                                )}
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {getVehicleName(parseInt(vehicleId))}
                                </h3>
                              </div>
                              <Badge variant="secondary" className="text-sm">
                                {totalDocs} document{totalDocs !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="border-t p-4 space-y-6">
                              {Object.entries(categoriesByType).map(([documentType, docs]) => {
                                const documentList = docs as Document[];
                                const typeKey = `${vehicleId}-${documentType}`;
                                const isTypeExpanded = expandedDocumentTypes.has(typeKey);
                                
                                return (
                            <div key={typeKey} className="space-y-4">
                              <button
                                onClick={() => toggleDocumentType(vehicleId, documentType)}
                                className="w-full flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  {isTypeExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-gray-500" />
                                  )}
                                  
                                  {/* Category-specific icon */}
                                  {documentType.toLowerCase().includes('contract') && (
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <path d="M9 15h6M9 11h6"/>
                                      </svg>
                                    </div>
                                  )}
                                  {documentType.toLowerCase().includes('damage') && (
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                                        <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                                      </svg>
                                    </div>
                                  )}
                                  {documentType.toLowerCase().includes('apk') && (
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                      </svg>
                                    </div>
                                  )}
                                  {documentType.toLowerCase().includes('maintenance') && (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                      </svg>
                                    </div>
                                  )}
                                  {documentType.toLowerCase().includes('insurance') && (
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                                        <path d="m9 12 2 2 4-4"/>
                                      </svg>
                                    </div>
                                  )}
                                  {!['contract', 'damage', 'apk', 'maintenance', 'insurance'].some(keyword => 
                                    documentType.toLowerCase().includes(keyword)) && (
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                    </div>
                                  )}
                                  
                                  <h4 className="text-lg font-medium text-gray-800">
                                    {documentType}
                                  </h4>
                                  <Badge variant="outline" className="ml-2">
                                    {documentList.length}
                                  </Badge>
                                </div>
                              </button>
                              
                              {isTypeExpanded && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-11">
                                {documentList.map((doc) => (
                                  <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                                      {getDocumentIcon(doc.contentType)}
                                    </div>
                                    <CardContent className="p-4">
                                      <h5 className="font-medium mb-2 truncate" title={doc.fileName}>
                                        {doc.fileName}
                                      </h5>
                                      
                                      <div className="flex items-center text-sm text-gray-500 mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                          <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
                                        </svg>
                                        <span>{formatDate(doc.uploadDate?.toString() || "")}</span>
                                      </div>
                                      
                                      {doc.notes && (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2" title={doc.notes}>
                                          {doc.notes}
                                        </p>
                                      )}
                                      
                                      <div className="flex items-center text-xs text-gray-500 mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        </svg>
                                        {formatFileSize(doc.fileSize)}
                                      </div>
                                      
                                      <div className="flex justify-between items-center gap-2">
                                        <button 
                                          onClick={() => handleViewDocument(doc)}
                                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                                          data-testid={`button-view-document-${doc.id}`}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          View
                                        </button>
                                        
                                        <a 
                                          href={`/api/documents/download/${doc.id}`} 
                                          className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1 transition-colors"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          data-testid={`link-download-document-${doc.id}`}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" x2="12" y1="15" y2="3"/>
                                          </svg>
                                          Download
                                        </a>
                                        
                                        {canEmailDocument(doc.documentType) && (
                                          <button 
                                            onClick={() => handleEmailDocument(doc)}
                                            className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1 transition-colors"
                                            data-testid={`button-email-document-${doc.id}`}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                              <polyline points="22,6 12,13 2,6"/>
                                            </svg>
                                            Email
                                          </button>
                                        )}
                                        
                                        <button 
                                          onClick={() => handlePrintDocument(doc)}
                                          className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1 transition-colors"
                                          data-testid={`button-print-document-${doc.id}`}
                                        >
                                          <Printer className="h-3.5 w-3.5" />
                                          Print
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteDocument(doc)}
                                          className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 transition-colors"
                                          data-testid={`button-delete-document-${doc.id}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                              )}
                            </div>
                                );
                              })}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-10"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
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
        
        <TabsContent value="damage-check">
          <Card>
            <CardHeader>
              <CardTitle>Damage Check Management</CardTitle>
              <CardDescription>
                Generate damage check PDFs and manage inspection templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Generate PDF Section */}
                <div className="border rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Generate Damage Check PDF
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a professional Dutch-format damage check form for any vehicle with customer data, damage matrix, and diagrams.
                  </p>
                  <Select
                    value=""
                    onValueChange={(vehicleId) => {
                      if (vehicleId) {
                        window.open(`/api/vehicles/${vehicleId}/damage-check-pdf`, '_blank');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a vehicle to generate PDF..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                          {displayLicensePlate(vehicle.licensePlate)} - {vehicle.brand} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Manage Templates Section */}
                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-2">Manage Inspection Templates</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Customize damage check templates for different vehicle types with specific inspection points and damage categories.
                  </p>
                  <Link href="/settings/damage-check-templates">
                    <Button>
                      <FileEdit className="mr-2 h-4 w-4" />
                      Open Template Editor
                    </Button>
                  </Link>
                </div>

                {/* Info Section */}
                <div className="bg-gray-50 border rounded-lg p-6">
                  <h3 className="text-sm font-semibold mb-3 text-gray-700">What's Included in the PDF:</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Contract and customer information (if reservation exists)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Complete vehicle details (brand, model, license plate, mileage)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Damage check matrix with checkboxes (Kapot, Gat, Kras, Deuk, Ster)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Vehicle diagram section for marking damage locations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Signature fields for customer and rental company</span>
                    </li>
                  </ul>
                </div>
              </div>
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
      
      {/* Email Document Dialog */}
      <AlertDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Email Document</AlertDialogTitle>
            <AlertDialogDescription>
              Send "{documentToEmail?.fileName}" via email
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email-recipients">Recipients (comma-separated)</Label>
              <Input
                id="email-recipients"
                placeholder="john@example.com, jane@example.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email-message">Message</Label>
              <textarea
                id="email-message"
                rows={4}
                className="w-full mt-1 px-3 py-2 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Enter your message..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendEmail}
              disabled={!emailRecipients.trim() || emailDocumentMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {emailDocumentMutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

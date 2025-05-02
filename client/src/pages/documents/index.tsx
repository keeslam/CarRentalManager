import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Document, Vehicle } from "@shared/schema";
import { formatDate, formatFileSize } from "@/lib/format-utils";

export default function DocumentsIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Fetch documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });
  
  // Fetch vehicles for filter
  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
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
      ? `${vehicle.licensePlate} - ${vehicle.brand} ${vehicle.model}`
      : `Vehicle #${vehicleId}`;
  };
  
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
                      {vehicle.licensePlate}
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
                          <div className="flex justify-between mt-2">
                            <a 
                              href={`/api/documents/download/${doc.id}`} 
                              className="text-primary-600 hover:text-primary-800 text-sm"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download
                            </a>
                            <button className="text-red-600 hover:text-red-800 text-sm">
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
    </div>
  );
}

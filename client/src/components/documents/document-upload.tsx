import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertDocumentSchema } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vehicle } from "@shared/schema";
import { formatFileSize, formatLicensePlate } from "@/lib/format-utils";

// Document types
const documentTypes = [
  "APK Inspection",
  "Damage Report",
  "Insurance",
  "Maintenance Record",
  "Receipt",
  "Registration",
  "Vehicle Photos", // Updated to match inline-document-upload.tsx
  "Warranty",
  "Tire Replacement",
  "Front Window Replacement",
  "Repair Report",
  "Other"
];

// Maximum file size (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
];

// Extended schema with validation
const formSchema = z.object({
  vehicleId: z.number({
    required_error: "Please select a vehicle",
    invalid_type_error: "Please select a vehicle",
  }),
  documentType: z.string().min(1, "Document type is required"),
  file: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}.`,
    })
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), {
      message: "File type not supported.",
    }),
  notes: z.string().optional(),
});

export function DocumentUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [searchParams] = useLocation();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Get preselected vehicle ID and document type from URL if available
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    const typeParam = urlParams.get("type");
    
    if (vehicleIdParam) {
      setVehicleId(Number(vehicleIdParam));
    }
    
    if (typeParam) {
      // Map the URL param to a valid document type
      const matchedType = documentTypes.find(t => 
        t.toLowerCase().includes(typeParam.toLowerCase())
      ) || null;
      
      if (matchedType) {
        setDocumentType(matchedType);
      }
    }
  }, [searchParams]);
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleId: vehicleId || 0,
      documentType: documentType || "",
      notes: "",
    },
  });
  
  // If vehicleId or documentType changes from URL, update the form
  useEffect(() => {
    if (vehicleId) {
      form.setValue("vehicleId", vehicleId);
    }
    
    if (documentType) {
      form.setValue("documentType", documentType);
    }
  }, [vehicleId, documentType, form]);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      setSelectedFile(file);
      form.setValue("file", file);
      
      // Create a preview for image files
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };
  
  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const formData = new FormData();
      formData.append("vehicleId", data.vehicleId.toString());
      formData.append("documentType", data.documentType);
      formData.append("file", data.file);
      formData.append("createdBy", localStorage.getItem("userName") || "User");
      
      if (data.notes) {
        formData.append("notes", data.notes);
      }
      
      return await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
    },
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
      // Show success message
      toast({
        title: "Document uploaded successfully",
        description: "The document has been added to the system.",
      });
      
      // Navigate back to documents list or vehicle details
      if (vehicleId) {
        navigate(`/vehicles/${vehicleId}`);
      } else {
        navigate("/documents");
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to upload document: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    uploadDocumentMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
        <CardDescription>Upload documents related to vehicles, such as APK inspections, damage reports, or receipts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vehicle Selection */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value.toString()}
                      value={field.value ? field.value.toString() : ""}
                      disabled={!!vehicleId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {formatLicensePlate(vehicle.licensePlate)} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Document Type */}
              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* File Upload */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <div className="flex flex-col space-y-2">
                          <Input 
                            type="file" 
                            accept={ACCEPTED_FILE_TYPES.join(",")}
                            onChange={handleFileChange}
                            {...field}
                          />
                          {selectedFile && (
                            <p className="text-sm text-gray-500">
                              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                            </p>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Supported file types: PDF, Word, Excel, images, and text files. Maximum size: 5MB.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Preview if it's an image */}
              {previewUrl && (
                <div className="md:col-span-2">
                  <FormLabel>Preview</FormLabel>
                  <div className="mt-2 max-w-md overflow-hidden border rounded-md">
                    <img 
                      src={previewUrl} 
                      alt="File preview" 
                      className="max-w-full h-auto object-contain"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                </div>
              )}
              
              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this document" 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => vehicleId ? navigate(`/vehicles/${vehicleId}`) : navigate("/documents")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploadDocumentMutation.isPending || !selectedFile}
              >
                {uploadDocumentMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  "Upload Document"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

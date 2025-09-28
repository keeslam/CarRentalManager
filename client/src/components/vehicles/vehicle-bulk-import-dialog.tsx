import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { FileText, Check, X, AlertCircle, Upload, UploadCloud, Download } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Form schema for license plate input
const licensePlateFormSchema = z.object({
  licensePlates: z.string().min(1, "Please enter at least one license plate"),
});

// Form schema for CSV upload
const csvUploadFormSchema = z.object({
  file: z.any().refine((file) => file?.size > 0, "Please select a file"),
});

type LicensePlateFormValues = z.infer<typeof licensePlateFormSchema>;
type CsvUploadFormValues = z.infer<typeof csvUploadFormSchema>;

interface VehicleBulkImportDialogProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function VehicleBulkImportDialog({ children, onSuccess }: VehicleBulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("manual");
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    imported: any[];
    failed: any[];
  } | null>(null);

  // Form for license plate input
  const licensePlateForm = useForm<LicensePlateFormValues>({
    resolver: zodResolver(licensePlateFormSchema),
    defaultValues: {
      licensePlates: "",
    },
  });

  // Form for CSV upload
  const csvUploadForm = useForm<CsvUploadFormValues>({
    resolver: zodResolver(csvUploadFormSchema),
    defaultValues: {},
  });

  // Reset dialog state when closing
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setImportResults(null);
      setImportProgress(0);
      licensePlateForm.reset();
      csvUploadForm.reset();
      setActiveTab("manual");
    }
  };

  // Handle license plate bulk import
  const importMutation = useMutation({
    mutationFn: async (licensePlates: string[]) => {
      const response = await apiRequest("POST", "/api/vehicles/bulk-import-plates", { licensePlates });
      return response.json();
    },
    onSuccess: (data: { imported: any[], failed: any[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setImportResults(data);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported.length} vehicles. ${data.failed.length} failed.`,
        variant: data.failed.length > 0 ? "destructive" : "default",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "An error occurred during the import process. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle license plate form submission
  const onSubmitLicensePlates = (values: LicensePlateFormValues) => {
    setImportResults(null);
    setImportProgress(0);
    
    // Parse license plates (handles both comma-separated and line-by-line)
    const licensePlatesText = values.licensePlates;
    const licensePlates = licensePlatesText
      .split(/[\n,]/)
      .map((plate) => plate.trim())
      .filter((plate) => plate !== "");
    
    if (licensePlates.length === 0) {
      toast({
        title: "No License Plates Found",
        description: "Please enter at least one valid license plate.",
        variant: "destructive",
      });
      return;
    }

    // Start the import process
    setImportProgress(5);
    importMutation.mutate(licensePlates);
  };

  // Handle CSV upload
  const onSubmitCsvUpload = (values: CsvUploadFormValues) => {
    toast({
      title: "CSV Upload",
      description: "CSV upload functionality is coming soon. Please use the manual entry tab for now.",
    });
  };

  // Custom trigger or default bulk import button
  const trigger = children || (
    <Button variant="outline" data-testid="button-bulk-import">
      <Download className="mr-2 h-4 w-4" />
      Bulk Import
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Vehicles</DialogTitle>
          <DialogDescription>
            Import multiple vehicles at once using license plates or CSV file
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2 mb-6">
              <TabsTrigger value="manual">
                <FileText className="mr-2 h-4 w-4" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="csv">
                <UploadCloud className="mr-2 h-4 w-4" />
                CSV Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              <Card>
                <CardHeader>
                  <CardTitle>Enter License Plates</CardTitle>
                  <CardDescription>
                    Enter one license plate per line, or separate them with commas.
                    Vehicle data will be automatically fetched from the RDW database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...licensePlateForm}>
                    <form onSubmit={licensePlateForm.handleSubmit(onSubmitLicensePlates)} className="space-y-4">
                      <FormField
                        control={licensePlateForm.control}
                        name="licensePlates"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Plates</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter license plates here, one per line or comma-separated. E.g.&#10;AA-BB-12&#10;XY-12-ZZ&#10;12-ABC-3"
                                rows={6}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Example formats: "AA-BB-12" or "AABB12" or "12-ABC-3"
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={importMutation.isPending}
                        data-testid="button-start-import"
                      >
                        {importMutation.isPending ? (
                          <>Processing Import...</>
                        ) : (
                          <>Start Import</>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="csv">
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV File</CardTitle>
                  <CardDescription>
                    Upload a CSV file with license plates in the first column.
                    Headers will be ignored.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...csvUploadForm}>
                    <form onSubmit={csvUploadForm.handleSubmit(onSubmitCsvUpload)} className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <h3 className="mt-2 text-sm font-semibold">Drag and drop your CSV file here</h3>
                        <p className="text-xs text-gray-500 mt-1">Or click to browse</p>
                        <input
                          type="file"
                          className="hidden"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              csvUploadForm.setValue("file", file);
                            }
                          }}
                        />
                        <Button type="button" variant="outline" className="mt-4">
                          Browse Files
                        </Button>
                      </div>
                      <Button type="submit" className="w-full">
                        Upload and Import
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {importMutation.isPending && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Import Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={importProgress} className="h-2" />
                <p className="text-center mt-2 text-sm text-gray-500">
                  Processing vehicle data...
                </p>
              </CardContent>
            </Card>
          )}

          {importResults && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Import Results</CardTitle>
                <CardDescription>
                  {importResults.imported.length} vehicles imported successfully, {importResults.failed.length} failed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {importResults.imported.length > 0 && (
                  <>
                    <h3 className="text-md font-medium flex items-center mb-2">
                      <Check className="h-5 w-5 mr-2 text-green-500" />
                      Successfully Imported ({importResults.imported.length})
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-md mb-6 max-h-32 overflow-y-auto">
                      <ul className="space-y-1">
                        {importResults.imported.map((item, index) => (
                          <li key={`success-${index}`} className="text-sm flex items-center">
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                            {item.licensePlate} - {item.vehicle.brand} {item.vehicle.model}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {importResults.failed.length > 0 && (
                  <>
                    <h3 className="text-md font-medium flex items-center mb-2">
                      <X className="h-5 w-5 mr-2 text-red-500" />
                      Failed Imports ({importResults.failed.length})
                    </h3>
                    <div className="bg-red-50 p-4 rounded-md max-h-32 overflow-y-auto">
                      <ul className="space-y-1">
                        {importResults.failed.map((item, index) => (
                          <li key={`failed-${index}`} className="text-sm flex items-baseline">
                            <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                            <div>
                              <span className="font-medium">{item.licensePlate}</span> - {item.error}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
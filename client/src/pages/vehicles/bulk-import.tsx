import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Progress } from "../../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Separator } from "../../components/ui/separator";
import { FileText, Check, X, AlertCircle, Upload, UploadCloud } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "../../components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Form schema for license plate input
const licensePlateFormSchema = z.object({
  licensePlates: z.string().min(1, "Please enter at least one license plate"),
});

// Form schema for CSV upload (future implementation)
const csvUploadFormSchema = z.object({
  file: z.any().refine((file) => file?.size > 0, "Please select a file"),
});

type LicensePlateFormValues = z.infer<typeof licensePlateFormSchema>;
type CsvUploadFormValues = z.infer<typeof csvUploadFormSchema>;

export default function BulkImportVehicles() {
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bulk Import Vehicles</h1>
          <p className="text-gray-500">
            Import multiple vehicles at once using license plates or CSV file
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
        >
          Back
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
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
                            rows={8}
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
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
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
                <div className="bg-gray-50 p-4 rounded-md mb-6 max-h-40 overflow-y-auto">
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
                <div className="bg-red-50 p-4 rounded-md max-h-40 overflow-y-auto">
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
  );
}
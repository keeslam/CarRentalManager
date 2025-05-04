import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { getQueryFn, apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Plus, Save, Trash2, FileText, MoveHorizontal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
// Import contract background image
import contractBackground from "../../assets/contract-background.jpg";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TemplateField {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  isBold: boolean;
  source: string; // The data source field
}

interface Template {
  id: number;
  name: string;
  isDefault: boolean;
  fields: TemplateField[];
}

const PDFTemplateEditor = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldSource, setNewFieldSource] = useState('');
  const [isAddFieldDialogOpen, setIsAddFieldDialogOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewReservationId, setPreviewReservationId] = useState<string>('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [draggedField, setDraggedField] = useState<TemplateField | null>(null);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: templateData, isLoading: isTemplateLoading } = useQuery({
    queryKey: ['/api/pdf-templates'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: reservationsData, isLoading: isReservationsLoading } = useQuery({
    queryKey: ['/api/reservations'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Template) => {
      const method = template.id ? 'PATCH' : 'POST';
      const url = template.id ? `/api/pdf-templates/${template.id}` : '/api/pdf-templates';
      
      // Convert fields to string if it's not already
      const dataToSend = {
        ...template,
        fields: typeof template.fields === 'string' 
          ? template.fields 
          : JSON.stringify(template.fields)
      };
      
      const res = await apiRequest(method, url, dataToSend);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pdf-templates'] });
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to save template: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest('DELETE', `/api/pdf-templates/${templateId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pdf-templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      if (currentTemplate && templates.length > 1) {
        // Select another template
        const nextTemplate = templates.find(t => t.id !== currentTemplate.id);
        if (nextTemplate) {
          setCurrentTemplate(nextTemplate);
        }
      } else {
        setCurrentTemplate(null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete template: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async ({ reservationId, templateId }: { reservationId: string, templateId: number }) => {
      const res = await apiRequest('GET', `/api/contracts/generate/${reservationId}?templateId=${templateId}`);
      return await res.blob();
    },
    onSuccess: (data) => {
      const url = URL.createObjectURL(data);
      setPreviewPdfUrl(url);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate preview: ${error.message}`,
        variant: "destructive",
      });
      setPreviewPdfUrl(null);
    }
  });

  useEffect(() => {
    if (templateData) {
      // Process templates - parse fields if they're stored as a string
      const processedTemplates = templateData.map((template: any) => {
        if (template.fields && typeof template.fields === 'string') {
          try {
            return {
              ...template,
              fields: JSON.parse(template.fields)
            };
          } catch (e) {
            console.error('Error parsing template fields:', e);
            return template;
          }
        }
        return template;
      });
      
      setTemplates(processedTemplates);
      if (processedTemplates.length > 0 && !currentTemplate) {
        const defaultTemplate = processedTemplates.find((t: Template) => t.isDefault) || processedTemplates[0];
        setCurrentTemplate(defaultTemplate);
      }
    }
  }, [templateData]);

  useEffect(() => {
    if (reservationsData) {
      setReservations(reservationsData);
      if (reservationsData.length > 0 && !previewReservationId) {
        setPreviewReservationId(reservationsData[0].id.toString());
      }
    }
  }, [reservationsData]);

  const handleCreateTemplate = () => {
    if (!newTemplateName) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    const newTemplate: Template = {
      id: 0, // Server will assign real ID
      name: newTemplateName,
      isDefault: templates.length === 0, // First template is default
      fields: []
    };

    saveTemplateMutation.mutate(newTemplate);
    setNewTemplateName('');
    setIsCreateDialogOpen(false);
  };

  const handleAddField = () => {
    if (!currentTemplate) return;
    if (!newFieldName || !newFieldSource) {
      toast({
        title: "Error",
        description: "Please enter field name and source",
        variant: "destructive",
      });
      return;
    }

    // Default position in the middle of the container
    const containerRect = pdfContainerRef.current?.getBoundingClientRect();
    const x = containerRect ? containerRect.width / 2 : 300;
    const y = containerRect ? containerRect.height / 2 : 400;

    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      name: newFieldName,
      x,
      y,
      fontSize: 10,
      isBold: false,
      source: newFieldSource
    };

    const updatedTemplate = {
      ...currentTemplate,
      fields: [...currentTemplate.fields, newField]
    };

    setCurrentTemplate(updatedTemplate);
    setNewFieldName('');
    setNewFieldSource('');
    setIsAddFieldDialogOpen(false);
  };

  const handleMouseDown = (e: React.MouseEvent, field: TemplateField) => {
    if (!isMoving || !currentTemplate) return;
    e.preventDefault();
    setDraggedField(field);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMoving || !draggedField || !currentTemplate || !pdfContainerRef.current) return;
    
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    
    // Calculate new position relative to the container
    const x = Math.max(0, Math.min(e.clientX - containerRect.left, containerRect.width));
    const y = Math.max(0, Math.min(e.clientY - containerRect.top, containerRect.height));

    // Update the field position
    const updatedFields = currentTemplate.fields.map(f => 
      f.id === draggedField.id ? { ...f, x, y } : f
    );

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });
  };

  const handleMouseUp = () => {
    setDraggedField(null);
  };

  const handleFieldClick = (field: TemplateField) => {
    if (!isMoving) {
      setSelectedField(field);
    }
  };

  const handleFontSizeChange = (size: number) => {
    if (!selectedField || !currentTemplate) return;

    const updatedFields = currentTemplate.fields.map(f => 
      f.id === selectedField.id ? { ...f, fontSize: size } : f
    );

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });
    setSelectedField({ ...selectedField, fontSize: size });
  };

  const handleBoldToggle = (isBold: boolean) => {
    if (!selectedField || !currentTemplate) return;

    const updatedFields = currentTemplate.fields.map(f => 
      f.id === selectedField.id ? { ...f, isBold } : f
    );

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });
    setSelectedField({ ...selectedField, isBold });
  };

  const handleDeleteField = () => {
    if (!selectedField || !currentTemplate) return;

    const updatedFields = currentTemplate.fields.filter(f => f.id !== selectedField.id);

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });
    setSelectedField(null);
  };

  const handleSaveTemplate = () => {
    if (!currentTemplate) return;
    saveTemplateMutation.mutate(currentTemplate);
  };

  const handleDeleteTemplate = () => {
    if (!currentTemplate || !currentTemplate.id) return;
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate(currentTemplate.id);
    }
  };

  const handleSetDefaultTemplate = () => {
    if (!currentTemplate) return;
    
    const updatedTemplate = {
      ...currentTemplate,
      isDefault: true
    };
    
    saveTemplateMutation.mutate(updatedTemplate);
  };

  const handlePreviewGenerate = () => {
    if (!currentTemplate || !previewReservationId) return;
    generatePreviewMutation.mutate({ 
      reservationId: previewReservationId, 
      templateId: currentTemplate.id 
    });
  };

  if (isTemplateLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contract Template Editor</h1>
        <div className="flex space-x-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Enter a name for your new contract template.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Standard Contract"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate}>
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No Templates Available</CardTitle>
            <CardDescription>
              Create your first contract template to get started.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card className="w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Template Selection</CardTitle>
                  <CardDescription>
                    Choose a template to edit or preview.
                  </CardDescription>
                </div>
                {currentTemplate && (
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={handleDeleteTemplate}
                      disabled={saveTemplateMutation.isPending || deleteTemplateMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Button 
                      onClick={handleSaveTemplate}
                      disabled={saveTemplateMutation.isPending}
                    >
                      {saveTemplateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-4">
                  <Label>Select Template</Label>
                  <Select
                    value={currentTemplate?.id.toString() || ''}
                    onValueChange={(value) => {
                      const template = templates.find(t => t.id.toString() === value);
                      if (template) setCurrentTemplate(template);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem 
                          key={template.id} 
                          value={template.id.toString()}
                        >
                          {template.name} {template.isDefault ? ' (Default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentTemplate && !currentTemplate.isDefault && (
                  <div className="space-y-4">
                    <Label>Set as Default</Label>
                    <Button 
                      variant="outline" 
                      onClick={handleSetDefaultTemplate}
                      className="w-full"
                    >
                      Make Default Template
                    </Button>
                  </div>
                )}
                <div className="space-y-4">
                  <Label>Toggle Move Mode</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={isMoving}
                      onCheckedChange={setIsMoving}
                      id="move-mode"
                    />
                    <Label htmlFor="move-mode">
                      {isMoving ? 'Moving Mode Active' : 'Drag & Drop Inactive'}
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {currentTemplate && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Card className="w-full">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle>Template Editor</CardTitle>
                          <CardDescription>
                            Drag fields to position them on the template
                          </CardDescription>
                        </div>
                        <Dialog open={isAddFieldDialogOpen} onOpenChange={setIsAddFieldDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Field
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New Field</DialogTitle>
                              <DialogDescription>
                                Specify the field details to add to the template.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <div>
                                <Label htmlFor="field-name">Field Name</Label>
                                <Input
                                  id="field-name"
                                  value={newFieldName}
                                  onChange={(e) => setNewFieldName(e.target.value)}
                                  placeholder="e.g., Customer Name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="field-source">Data Source</Label>
                                <Select
                                  value={newFieldSource}
                                  onValueChange={setNewFieldSource}
                                >
                                  <SelectTrigger id="field-source">
                                    <SelectValue placeholder="Select data source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="contractNumber">Contract Number</SelectItem>
                                    <SelectItem value="contractDate">Contract Date</SelectItem>
                                    <SelectItem value="licensePlate">License Plate</SelectItem>
                                    <SelectItem value="brand">Vehicle Brand</SelectItem>
                                    <SelectItem value="model">Vehicle Model</SelectItem>
                                    <SelectItem value="chassisNumber">Chassis Number</SelectItem>
                                    <SelectItem value="customerName">Customer Name</SelectItem>
                                    <SelectItem value="customerAddress">Customer Address</SelectItem>
                                    <SelectItem value="customerCity">Customer City</SelectItem>
                                    <SelectItem value="customerPostalCode">Customer Postal Code</SelectItem>
                                    <SelectItem value="customerPhone">Customer Phone</SelectItem>
                                    <SelectItem value="driverLicense">Driver License</SelectItem>
                                    <SelectItem value="startDate">Start Date</SelectItem>
                                    <SelectItem value="endDate">End Date</SelectItem>
                                    <SelectItem value="duration">Duration</SelectItem>
                                    <SelectItem value="totalPrice">Total Price</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsAddFieldDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleAddField}>
                                Add Field
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div 
                        ref={pdfContainerRef}
                        className="relative w-full h-[842px] bg-white border border-gray-300 shadow-sm overflow-hidden"
                        style={{ 
                          width: '595px', 
                          height: '842px',
                          margin: '0 auto',
                          backgroundImage: `url(${contractBackground})`,
                          backgroundSize: '100% 100%',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat'
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {currentTemplate.fields.map(field => (
                          <div
                            key={field.id}
                            className={`absolute cursor-pointer p-1 ${
                              selectedField?.id === field.id ? 'border-2 border-blue-500' : ''
                            } ${isMoving ? 'cursor-move' : ''}`}
                            style={{
                              left: `${field.x}px`,
                              top: `${field.y}px`,
                              fontSize: `${field.fontSize}px`,
                              fontWeight: field.isBold ? 'bold' : 'normal',
                              transform: 'translate(-50%, -50%)',
                              backgroundColor: 'rgba(255, 255, 255, 0.8)',
                              padding: '4px 8px',
                              borderRadius: '4px'
                            }}
                            onClick={() => handleFieldClick(field)}
                            onMouseDown={(e) => handleMouseDown(e, field)}
                          >
                            {field.name}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Field Properties</CardTitle>
                      <CardDescription>
                        Edit the selected field properties
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedField ? (
                        <div className="space-y-4">
                          <div>
                            <Label>Field Name</Label>
                            <Input
                              value={selectedField.name}
                              onChange={(e) => {
                                if (!currentTemplate) return;
                                const updatedFields = currentTemplate.fields.map(f => 
                                  f.id === selectedField.id ? { ...f, name: e.target.value } : f
                                );
                                setCurrentTemplate({
                                  ...currentTemplate,
                                  fields: updatedFields
                                });
                                setSelectedField({ ...selectedField, name: e.target.value });
                              }}
                            />
                          </div>
                          <div>
                            <Label>Data Source</Label>
                            <Select
                              value={selectedField.source}
                              onValueChange={(value) => {
                                if (!currentTemplate) return;
                                const updatedFields = currentTemplate.fields.map(f => 
                                  f.id === selectedField.id ? { ...f, source: value } : f
                                );
                                setCurrentTemplate({
                                  ...currentTemplate,
                                  fields: updatedFields
                                });
                                setSelectedField({ ...selectedField, source: value });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select data source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contractNumber">Contract Number</SelectItem>
                                <SelectItem value="contractDate">Contract Date</SelectItem>
                                <SelectItem value="licensePlate">License Plate</SelectItem>
                                <SelectItem value="brand">Vehicle Brand</SelectItem>
                                <SelectItem value="model">Vehicle Model</SelectItem>
                                <SelectItem value="chassisNumber">Chassis Number</SelectItem>
                                <SelectItem value="customerName">Customer Name</SelectItem>
                                <SelectItem value="customerAddress">Customer Address</SelectItem>
                                <SelectItem value="customerCity">Customer City</SelectItem>
                                <SelectItem value="customerPostalCode">Customer Postal Code</SelectItem>
                                <SelectItem value="customerPhone">Customer Phone</SelectItem>
                                <SelectItem value="driverLicense">Driver License</SelectItem>
                                <SelectItem value="startDate">Start Date</SelectItem>
                                <SelectItem value="endDate">End Date</SelectItem>
                                <SelectItem value="duration">Duration</SelectItem>
                                <SelectItem value="totalPrice">Total Price</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Position</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">X Position</Label>
                                <Input 
                                  type="number"
                                  value={selectedField.x}
                                  onChange={(e) => {
                                    if (!currentTemplate) return;
                                    const x = Number(e.target.value);
                                    const updatedFields = currentTemplate.fields.map(f => 
                                      f.id === selectedField.id ? { ...f, x } : f
                                    );
                                    setCurrentTemplate({
                                      ...currentTemplate,
                                      fields: updatedFields
                                    });
                                    setSelectedField({ ...selectedField, x });
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Y Position</Label>
                                <Input 
                                  type="number"
                                  value={selectedField.y}
                                  onChange={(e) => {
                                    if (!currentTemplate) return;
                                    const y = Number(e.target.value);
                                    const updatedFields = currentTemplate.fields.map(f => 
                                      f.id === selectedField.id ? { ...f, y } : f
                                    );
                                    setCurrentTemplate({
                                      ...currentTemplate,
                                      fields: updatedFields
                                    });
                                    setSelectedField({ ...selectedField, y });
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <Label>Font Size</Label>
                            <Input 
                              type="number"
                              value={selectedField.fontSize}
                              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={selectedField.isBold}
                              onCheckedChange={handleBoldToggle}
                              id="bold-text"
                            />
                            <Label htmlFor="bold-text">Bold Text</Label>
                          </div>
                          <Button 
                            variant="destructive" 
                            onClick={handleDeleteField}
                            className="w-full"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Field
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Select a field to edit its properties
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="w-full mt-6">
                    <CardHeader>
                      <CardTitle>Preview Template</CardTitle>
                      <CardDescription>
                        Generate a preview with real data
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label>Select Reservation</Label>
                          <Select
                            value={previewReservationId}
                            onValueChange={setPreviewReservationId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a reservation" />
                            </SelectTrigger>
                            <SelectContent>
                              {reservations.map(reservation => (
                                <SelectItem 
                                  key={reservation.id} 
                                  value={reservation.id.toString()}
                                >
                                  {reservation.vehicle?.brand} {reservation.vehicle?.model} - {new Date(reservation.startDate).toLocaleDateString()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={handlePreviewGenerate}
                          disabled={generatePreviewMutation.isPending}
                          className="w-full"
                        >
                          {generatePreviewMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Generate Preview
                        </Button>
                        {previewPdfUrl && (
                          <div className="mt-4">
                            <a 
                              href={previewPdfUrl} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:underline"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Preview PDF
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PDFTemplateEditor;
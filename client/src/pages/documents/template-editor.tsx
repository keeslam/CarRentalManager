import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { getQueryFn, apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Plus, Save, Trash2, FileText, MoveHorizontal, ZoomIn, ZoomOut, MaximizeIcon, Grid, AlignCenterHorizontal, AlignCenter, AlignLeft, AlignRight } from "lucide-react";
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
  textAlign: 'left' | 'center' | 'right';
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
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  
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
    mutationFn: async ({ templateId }: { reservationId?: string, templateId: number }) => {
      // Use the dedicated template preview endpoint with our test data
      // This endpoint uses field labels as values for better visibility in preview
      console.log(`Generating preview for template ID: ${templateId}`);
      const res = await apiRequest('GET', `/api/pdf-templates/${templateId}/preview`);
      return await res.blob();
    },
    onSuccess: (data) => {
      // Revoke any previous URLs to avoid memory leaks
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
      const url = URL.createObjectURL(data);
      setPreviewPdfUrl(url);
      toast({
        title: "Preview Generated",
        description: "Preview shows field labels for better visibility of positions and alignment",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate preview: ${error.message}`,
        variant: "destructive",
      });
      console.error('Preview generation error:', error);
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
    console.log("Adding field", { currentTemplate, newFieldName, newFieldSource });
    
    if (!currentTemplate) {
      console.error("No current template");
      return;
    }
    
    if (!newFieldName || !newFieldSource) {
      console.error("Missing field name or source", { newFieldName, newFieldSource });
      toast({
        title: "Error",
        description: "Please enter field name and source",
        variant: "destructive",
      });
      return;
    }

    // Default position in the middle of the container
    // Use standard A4 dimensions (595 x 842) as reference
    const x = 595 / 2; // Center X position (half of A4 width)
    const y = 842 / 2; // Center Y position (half of A4 height)

    console.log(`Creating new field at position (${x}, ${y})`);

    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      name: newFieldName,
      x,
      y,
      fontSize: 12,
      isBold: false,
      source: newFieldSource,
      textAlign: 'left'
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
    
    // Get mouse position relative to the container
    const rawX = e.clientX - containerRect.left;
    const rawY = e.clientY - containerRect.top;
    
    // Convert to PDF coordinates (divide by zoom level)
    const x = Math.max(0, Math.min(rawX / zoomLevel, 595));
    const y = Math.max(0, Math.min(rawY / zoomLevel, 842));

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
  
  const handleTextAlignChange = (textAlign: 'left' | 'center' | 'right') => {
    if (!selectedField || !currentTemplate) return;

    const updatedFields = currentTemplate.fields.map(f => 
      f.id === selectedField.id ? { ...f, textAlign } : f
    );

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });
    setSelectedField({ ...selectedField, textAlign });
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
    
    // Create a clean template object without any potentially problematic properties
    const templateToSave = {
      id: currentTemplate.id,
      name: currentTemplate.name,
      isDefault: currentTemplate.isDefault,
      // The fields need to be explicitly processed to make sure we're sending just
      // the data we need and not any unexpected properties
      fields: currentTemplate.fields.map(field => ({
        id: field.id,
        name: field.name,
        x: field.x,
        y: field.y,
        fontSize: field.fontSize,
        isBold: field.isBold,
        source: field.source,
        textAlign: field.textAlign
      }))
    };
    
    console.log('Saving template with processed data:', templateToSave);
    saveTemplateMutation.mutate(templateToSave);
  };

  const handleDeleteTemplate = () => {
    if (!currentTemplate || !currentTemplate.id) return;
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate(currentTemplate.id);
    }
  };

  const handleSetDefaultTemplate = () => {
    if (!currentTemplate) return;
    
    // Create a clean template object with only what we need to avoid date/field issues
    const templateToSave = {
      id: currentTemplate.id,
      name: currentTemplate.name,
      isDefault: true,
      fields: currentTemplate.fields.map(field => ({
        id: field.id,
        name: field.name,
        x: field.x,
        y: field.y,
        fontSize: field.fontSize, 
        isBold: field.isBold,
        source: field.source,
        textAlign: field.textAlign
      }))
    };
    
    console.log('Setting template as default:', templateToSave);
    saveTemplateMutation.mutate(templateToSave);
  };

  const handlePreviewGenerate = () => {
    if (!currentTemplate) return;
    
    // Save the template first if there are unsaved changes
    if (saveTemplateMutation.isPending) {
      toast({
        title: "Template is saving",
        description: "Please wait until the template is saved before generating preview",
      });
      return;
    }
    
    // Use our new preview endpoint that shows field labels as values
    generatePreviewMutation.mutate({ 
      templateId: currentTemplate.id 
    });
  };
  
  const handleZoomIn = () => {
    if (!pdfContainerRef.current) return;
    
    const parentContainer = pdfContainerRef.current.parentElement;
    if (!parentContainer) return;
    
    // Save the center point of the visible area
    const containerRect = parentContainer.getBoundingClientRect();
    const scrollLeft = parentContainer.scrollLeft;
    const scrollTop = parentContainer.scrollTop;
    
    // Center point in the visible area
    const centerX = (containerRect.width / 2) + scrollLeft;
    const centerY = (containerRect.height / 2) + scrollTop;
    
    // Calculate relative position within the PDF
    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const relativeX = centerX / pdfRect.width;
    const relativeY = centerY / pdfRect.height;
    
    // Update zoom
    const newZoom = Math.min(zoomLevel + 0.1, 2);
    setZoomLevel(newZoom);
    
    // Adjust scroll position after zoom
    setTimeout(() => {
      if (!pdfContainerRef.current || !parentContainer) return;
      
      const newPdfRect = pdfContainerRef.current.getBoundingClientRect();
      const newCenterX = relativeX * newPdfRect.width;
      const newCenterY = relativeY * newPdfRect.height;
      
      // Center the view on the same relative position
      parentContainer.scrollLeft = newCenterX - (containerRect.width / 2);
      parentContainer.scrollTop = newCenterY - (containerRect.height / 2);
    }, 0);
  };

  const handleZoomOut = () => {
    if (!pdfContainerRef.current) return;
    
    const parentContainer = pdfContainerRef.current.parentElement;
    if (!parentContainer) return;
    
    // Save the center point of the visible area
    const containerRect = parentContainer.getBoundingClientRect();
    const scrollLeft = parentContainer.scrollLeft;
    const scrollTop = parentContainer.scrollTop;
    
    // Center point in the visible area
    const centerX = (containerRect.width / 2) + scrollLeft;
    const centerY = (containerRect.height / 2) + scrollTop;
    
    // Calculate relative position within the PDF
    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const relativeX = centerX / pdfRect.width;
    const relativeY = centerY / pdfRect.height;
    
    // Update zoom
    const newZoom = Math.max(zoomLevel - 0.1, 0.5);
    setZoomLevel(newZoom);
    
    // Adjust scroll position after zoom
    setTimeout(() => {
      if (!pdfContainerRef.current || !parentContainer) return;
      
      const newPdfRect = pdfContainerRef.current.getBoundingClientRect();
      const newCenterX = relativeX * newPdfRect.width;
      const newCenterY = relativeY * newPdfRect.height;
      
      // Center the view on the same relative position
      parentContainer.scrollLeft = newCenterX - (containerRect.width / 2);
      parentContainer.scrollTop = newCenterY - (containerRect.height / 2);
    }, 0);
  };

  const handleResetZoom = () => {
    // Store the current center position relative to the document
    if (!pdfContainerRef.current) {
      setZoomLevel(1);
      return;
    }
    
    const parentContainer = pdfContainerRef.current.parentElement;
    if (!parentContainer) {
      setZoomLevel(1);
      return;
    }
    
    // Calculate the center of the current view
    const containerRect = parentContainer.getBoundingClientRect();
    const scrollLeft = parentContainer.scrollLeft;
    const scrollTop = parentContainer.scrollTop;
    
    const centerX = (containerRect.width / 2) + scrollLeft;
    const centerY = (containerRect.height / 2) + scrollTop;
    
    // Calculate relative position (0 to 1)
    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const relativeX = centerX / pdfRect.width;
    const relativeY = centerY / pdfRect.height;
    
    // Reset zoom
    setZoomLevel(1);
    
    // Adjust scroll position after zoom reset
    setTimeout(() => {
      if (!pdfContainerRef.current || !parentContainer) return;
      
      const newPdfRect = pdfContainerRef.current.getBoundingClientRect();
      const newCenterX = relativeX * newPdfRect.width;
      const newCenterY = relativeY * newPdfRect.height;
      
      // Center the view on the same relative position
      parentContainer.scrollLeft = newCenterX - (containerRect.width / 2);
      parentContainer.scrollTop = newCenterY - (containerRect.height / 2);
    }, 0);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    // Only zoom if Shift key is pressed to not interfere with normal scrolling or browser zooming
    if (e.shiftKey && pdfContainerRef.current) {
      e.preventDefault();
      
      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      
      // Get mouse position relative to the container
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;
      
      // Calculate relative position (0 to 1)
      const relativeX = mouseX / containerRect.width;
      const relativeY = mouseY / containerRect.height;
      
      const zoomSpeed = 0.05; // adjust this value to change zoom sensitivity
      const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
      const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 2);
      
      // Update the zoom level with focus point at mouse position
      setZoomLevel(newZoom);
      
      // Get the element that contains the PDF container
      const parentContainer = pdfContainerRef.current.parentElement;
      if (parentContainer) {
        // After the zoom level changes, adjust the scroll position to keep the mouse point stationary
        setTimeout(() => {
          const newContainerRect = pdfContainerRef.current?.getBoundingClientRect();
          if (newContainerRect) {
            const newWidth = newContainerRect.width;
            const newHeight = newContainerRect.height;
            
            // Calculate the new position where the mouse should be
            const newMouseX = relativeX * newWidth;
            const newMouseY = relativeY * newHeight;
            
            // Adjust scroll to keep the mouse point at the same relative position
            parentContainer.scrollLeft += (newMouseX - mouseX);
            parentContainer.scrollTop += (newMouseY - mouseY);
          }
        }, 0);
      }
    }
  };
  
  const handleToggleGrid = () => {
    setShowGrid(prev => !prev);
  };
  
  const handleAutoAlign = () => {
    if (!currentTemplate || !selectedField) return;
    
    // Find fields that are horizontally or vertically aligned 
    // (within a small threshold) with the selected field
    const threshold = 10; // pixels
    const fields = currentTemplate.fields;
    
    // Find fields that are horizontally aligned (similar Y position)
    const horizontallyAlignedFields = fields.filter(f => 
      f.id !== selectedField.id && 
      Math.abs(f.y - selectedField.y) < threshold
    );
    
    // Find fields that are vertically aligned (similar X position)
    const verticallyAlignedFields = fields.filter(f => 
      f.id !== selectedField.id && 
      Math.abs(f.x - selectedField.x) < threshold
    );
    
    if (horizontallyAlignedFields.length > 0) {
      // Align the selected field with the average Y position of horizontally aligned fields
      const avgY = horizontallyAlignedFields.reduce((sum, f) => sum + f.y, 0) / horizontallyAlignedFields.length;
      
      const updatedFields = currentTemplate.fields.map(f => 
        f.id === selectedField.id ? { ...f, y: avgY } : f
      );
      
      setCurrentTemplate({
        ...currentTemplate,
        fields: updatedFields
      });
      
      setSelectedField({ ...selectedField, y: avgY });
      
      toast({
        title: "Auto-Aligned",
        description: "Field aligned horizontally with similar fields",
      });
    } else if (verticallyAlignedFields.length > 0) {
      // Align the selected field with the average X position of vertically aligned fields
      const avgX = verticallyAlignedFields.reduce((sum, f) => sum + f.x, 0) / verticallyAlignedFields.length;
      
      const updatedFields = currentTemplate.fields.map(f => 
        f.id === selectedField.id ? { ...f, x: avgX } : f
      );
      
      setCurrentTemplate({
        ...currentTemplate,
        fields: updatedFields
      });
      
      setSelectedField({ ...selectedField, x: avgX });
      
      toast({
        title: "Auto-Aligned",
        description: "Field aligned vertically with similar fields",
      });
    } else {
      toast({
        title: "Auto-Align",
        description: "No fields found for auto-alignment",
        variant: "destructive",
      });
    }
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
                        <div className="flex gap-2">
                          <div className="flex gap-1 rounded-md border border-input p-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleZoomOut}
                              title="Zoom Out"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleResetZoom}
                              title="Reset Zoom"
                            >
                              <span className="text-xs font-mono">{Math.round(zoomLevel * 100)}%</span>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleZoomIn}
                              title="Zoom In"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={handleToggleGrid}
                            className={showGrid ? "bg-slate-100" : ""}
                            title="Toggle Grid"
                          >
                            <Grid className="h-4 w-4" />
                          </Button>
                          {selectedField && (
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={handleAutoAlign}
                              title="Auto-align with nearby fields"
                            >
                              <AlignCenter className="h-4 w-4" />
                            </Button>
                          )}
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
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div 
                        className="relative overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200" 
                        style={{
                          height: '842px',
                          maxHeight: '842px',
                          overflowX: 'auto',
                          overflowY: 'auto',
                          padding: '1rem'
                        }}
                        onWheel={handleWheel}>
                        <div 
                          ref={pdfContainerRef}
                          className={`relative bg-white border border-gray-300 shadow-sm ${showGrid ? 'bg-grid' : ''}`}
                          style={{ 
                            width: `${595 * zoomLevel}px`, 
                            height: `${842 * zoomLevel}px`,
                            margin: '0 auto',
                            backgroundImage: `url(${contractBackground})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            minWidth: '100%'
                          }}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                        >
                          {currentTemplate.fields.map(field => (
                            <div
                              key={field.id}
                              className={`absolute cursor-pointer p-1 rounded ${
                                selectedField?.id === field.id ? 'border-2 border-blue-500 bg-white bg-opacity-80' : ''
                              } ${isMoving ? 'cursor-move' : ''}`}
                              style={{
                                left: `${field.x * zoomLevel}px`,
                                top: `${field.y * zoomLevel}px`,
                                fontSize: `${field.fontSize * zoomLevel}px`,
                                fontWeight: field.isBold ? 'bold' : 'normal',
                                transform: 'translate(-50%, -50%)',
                                backgroundColor: selectedField?.id === field.id ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                color: '#000000',
                                padding: '4px 8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                borderRadius: '4px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                textAlign: field.textAlign,
                                minWidth: '100px', // Ensure enough width to display alignment
                                display: 'flex',
                                justifyContent: field.textAlign === 'left' 
                                  ? 'flex-start' 
                                  : field.textAlign === 'right' 
                                    ? 'flex-end' 
                                    : 'center'
                              }}
                              onClick={() => handleFieldClick(field)}
                              onMouseDown={(e) => handleMouseDown(e, field)}
                            >
                              {field.name}
                            </div>
                          ))}
                        </div>
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
                          <div>
                            <Label>Text Alignment</Label>
                            <div className="flex items-center space-x-2 mt-2">
                              <Button
                                variant={selectedField.textAlign === 'left' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleTextAlignChange('left')}
                                title="Align Left"
                              >
                                <AlignLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={selectedField.textAlign === 'center' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleTextAlignChange('center')}
                                title="Align Center"
                              >
                                <AlignCenter className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={selectedField.textAlign === 'right' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleTextAlignChange('right')}
                                title="Align Right"
                              >
                                <AlignRight className="h-4 w-4" />
                              </Button>
                            </div>
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
                          <div className="mt-4 space-y-2">
                            <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-md">
                              <iframe 
                                src={previewPdfUrl} 
                                className="w-full h-[500px]"
                                title="PDF Preview"
                              />
                            </div>
                            <a 
                              href={previewPdfUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary underline block"
                            >
                              Open PDF Preview in New Tab
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
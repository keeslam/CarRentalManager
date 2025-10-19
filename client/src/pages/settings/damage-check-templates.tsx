import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Car, CheckCircle2, Circle } from "lucide-react";

interface InspectionPoint {
  id: string;
  name: string;
  category: string;
  description?: string;
  required: boolean;
  position?: { x: number; y: number };
}

interface DamageCheckTemplate {
  id: number;
  name: string;
  description: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  inspectionPoints: InspectionPoint[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

const INSPECTION_CATEGORIES = [
  { value: 'exterior', label: 'Exterior', color: 'bg-blue-100 text-blue-800' },
  { value: 'interior', label: 'Interior', color: 'bg-green-100 text-green-800' },
  { value: 'mechanical', label: 'Mechanical', color: 'bg-orange-100 text-orange-800' },
  { value: 'tires', label: 'Tires & Wheels', color: 'bg-purple-100 text-purple-800' },
  { value: 'documents', label: 'Documents', color: 'bg-gray-100 text-gray-800' },
];

export default function DamageCheckTemplates() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DamageCheckTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<DamageCheckTemplate | null>(null);

  // Fetch all templates
  const { data: templates = [], isLoading } = useQuery<DamageCheckTemplate[]>({
    queryKey: ['/api/damage-check-templates'],
  });

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: DamageCheckTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDeleteClick = (template: DamageCheckTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/damage-check-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const getCategoryBadge = (category: string) => {
    const cat = INSPECTION_CATEGORIES.find(c => c.value === category);
    return cat ? cat.color : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Car className="h-8 w-8" />
            Damage Check Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create custom vehicle inspection templates for different makes and models
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2" data-testid="button-create-template">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading templates...
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Created</h3>
            <p className="text-muted-foreground mb-4">
              Create your first damage check template to standardize vehicle inspections
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {template.name}
                      {template.isDefault && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Vehicle targeting */}
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-1">Vehicle Target</div>
                    {template.vehicleMake || template.vehicleModel || template.vehicleType ? (
                      <div className="flex flex-wrap gap-1">
                        {template.vehicleMake && (
                          <Badge variant="outline" className="text-xs">{template.vehicleMake}</Badge>
                        )}
                        {template.vehicleModel && (
                          <Badge variant="outline" className="text-xs">{template.vehicleModel}</Badge>
                        )}
                        {template.vehicleType && (
                          <Badge variant="outline" className="text-xs capitalize">{template.vehicleType}</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Generic (all vehicles)</span>
                    )}
                  </div>

                  {/* Inspection points summary */}
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-1">Inspection Points</div>
                    <div className="text-gray-600">
                      {template.inspectionPoints?.length || 0} check points
                      {template.inspectionPoints?.filter(p => p.required).length > 0 && (
                        <span className="text-xs text-orange-600 ml-2">
                          ({template.inspectionPoints.filter(p => p.required).length} required)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Categories */}
                  {template.inspectionPoints && template.inspectionPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(template.inspectionPoints.map(p => p.category))].map(category => (
                        <Badge key={category} className={`text-xs ${getCategoryBadge(category)}`}>
                          {INSPECTION_CATEGORIES.find(c => c.value === category)?.label || category}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      className="flex-1"
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(template)}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Dialog */}
      {editorOpen && (
        <TemplateEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editingTemplate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => templateToDelete && deleteMutation.mutate(templateToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Editor Component
function TemplateEditor({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: DamageCheckTemplate | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [vehicleMake, setVehicleMake] = useState(template?.vehicleMake || "");
  const [vehicleModel, setVehicleModel] = useState(template?.vehicleModel || "");
  const [vehicleType, setVehicleType] = useState(template?.vehicleType || "");
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);
  const [inspectionPoints, setInspectionPoints] = useState<InspectionPoint[]>(
    template?.inspectionPoints || []
  );
  const [editingPoint, setEditingPoint] = useState<InspectionPoint | null>(null);
  const [pointEditorOpen, setPointEditorOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = template
        ? `/api/damage-check-templates/${template.id}`
        : '/api/damage-check-templates';
      const method = template ? 'PUT' : 'POST';

      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-templates'] });
      toast({
        title: "Success",
        description: template ? "Template updated successfully" : "Template created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      vehicleMake: vehicleMake.trim() || null,
      vehicleModel: vehicleModel.trim() || null,
      vehicleType: vehicleType || null,
      isDefault,
      inspectionPoints,
    };

    saveMutation.mutate(data);
  };

  const handleAddPoint = () => {
    setEditingPoint(null);
    setPointEditorOpen(true);
  };

  const handleEditPoint = (point: InspectionPoint) => {
    setEditingPoint(point);
    setPointEditorOpen(true);
  };

  const handleSavePoint = (point: InspectionPoint) => {
    if (editingPoint) {
      // Update existing point
      setInspectionPoints(points =>
        points.map(p => p.id === point.id ? point : p)
      );
    } else {
      // Add new point
      setInspectionPoints(points => [...points, point]);
    }
    setPointEditorOpen(false);
  };

  const handleDeletePoint = (id: string) => {
    setInspectionPoints(points => points.filter(p => p.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update template details and inspection points"
              : "Create a custom damage check template for vehicle inspections"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Sedan Check"
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Targeting */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Vehicle Targeting (Optional)</h3>
            <p className="text-xs text-gray-600">
              Leave blank to create a generic template for all vehicles
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  placeholder="e.g., Toyota"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g., Camry"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="coupe">Coupe</SelectItem>
                    <SelectItem value="wagon">Wagon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Inspection Points */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Inspection Points</h3>
              <Button onClick={handleAddPoint} size="sm" data-testid="button-add-inspection-point">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Point
              </Button>
            </div>

            {inspectionPoints.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                <Circle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No inspection points yet</p>
                <p className="text-xs mt-1">Click "Add Point" to create your first check point</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inspectionPoints.map((point) => {
                  const category = INSPECTION_CATEGORIES.find(c => c.value === point.category);
                  return (
                    <div
                      key={point.id}
                      className="border rounded-lg p-3 flex items-start justify-between hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {point.required ? (
                            <CheckCircle2 className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium">{point.name}</span>
                          <Badge className={`text-xs ${category?.color || 'bg-gray-100 text-gray-800'}`}>
                            {category?.label || point.category}
                          </Badge>
                          {point.required && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Required
                            </Badge>
                          )}
                        </div>
                        {point.description && (
                          <p className="text-xs text-gray-600 mt-1 ml-6">{point.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPoint(point)}
                          data-testid={`button-edit-point-${point.id}`}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePoint(point.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-point-${point.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-template">
            {saveMutation.isPending ? "Saving..." : template ? "Update Template" : "Create Template"}
          </Button>
        </div>

        {/* Point Editor Sub-Dialog */}
        {pointEditorOpen && (
          <InspectionPointEditor
            open={pointEditorOpen}
            onOpenChange={setPointEditorOpen}
            point={editingPoint}
            onSave={handleSavePoint}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Inspection Point Editor Component
function InspectionPointEditor({
  open,
  onOpenChange,
  point,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: InspectionPoint | null;
  onSave: (point: InspectionPoint) => void;
}) {
  const [name, setName] = useState(point?.name || "");
  const [category, setCategory] = useState(point?.category || "exterior");
  const [description, setDescription] = useState(point?.description || "");
  const [required, setRequired] = useState(point?.required || false);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    const newPoint: InspectionPoint = {
      id: point?.id || `point-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      required,
      position: point?.position,
    };

    onSave(newPoint);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{point ? "Edit Inspection Point" : "Add Inspection Point"}</DialogTitle>
          <DialogDescription>
            Define a specific area or item to check during vehicle inspection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="point-name">Point Name *</Label>
            <Input
              id="point-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Front Bumper, Left Door, Engine Oil"
              data-testid="input-point-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="point-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="point-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSPECTION_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="point-description">Description (Optional)</Label>
            <Textarea
              id="point-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What to check for this point..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="point-required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="checkbox-point-required"
            />
            <Label htmlFor="point-required" className="cursor-pointer">
              Required check point
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()} data-testid="button-save-point">
            {point ? "Update" : "Add"} Point
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

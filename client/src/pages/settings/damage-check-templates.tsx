import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateByPrefix } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Car,
  CheckCircle2,
  Circle,
  Download,
  Upload,
  Star,
  Copy,
  ClipboardList,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InspectionPoint {
  id: string;
  name: string;
  category: string;
  damageTypes: string[]; // e.g., ["Kapot", "Gat", "Kras", "Deuk"]
  description?: string;
  required: boolean;
  position?: { x: number; y: number };
  // Phase 1 additions
  notes?: string;
  photoPaths?: string[];
  inputType?: "checkbox" | "text" | "dropdown";
  dropdownOptions?: string[];
  order?: number;
}

interface TemplateCategory {
  id: string;
  label: string;
  order: number;
}

interface HandoverChecklistItem {
  id: string;
  label: string;
  type: "checkbox" | "text";
  order: number;
}

interface DamageCheckTemplate {
  id: number;
  name: string;
  description: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  buildYearFrom: string | null;
  buildYearTo: string | null;
  diagramTopView: string | null;
  diagramFrontView: string | null;
  diagramRearView: string | null;
  diagramSideView: string | null;
  inspectionPoints: InspectionPoint[];
  categories: TemplateCategory[];
  handoverChecklist: HandoverChecklistItem[];
  headerText: string | null;
  footerText: string | null;
  isDefault: boolean;
  language: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: TemplateCategory[] = [
  { id: "interieur", label: "Interieur", order: 0 },
  { id: "exterieur", label: "Exterieur", order: 1 },
  { id: "afweez_check", label: "Afweez Check", order: 2 },
  { id: "documents", label: "Documents", order: 3 },
];

const CATEGORY_COLORS = [
  "bg-green-100 text-green-800",
  "bg-blue-100 text-blue-800",
  "bg-orange-100 text-orange-800",
  "bg-gray-100 text-gray-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-yellow-100 text-yellow-800",
  "bg-cyan-100 text-cyan-800",
];

function getCategoryColor(categoryId: string, categories: TemplateCategory[]): string {
  const idx = categories.findIndex((c) => c.id === categoryId);
  if (idx < 0) return "bg-gray-100 text-gray-800";
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

function getCategoryLabel(categoryId: string, categories: TemplateCategory[]): string {
  return categories.find((c) => c.id === categoryId)?.label || categoryId;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `cat_${Date.now()}`
  );
}

const DAMAGE_TYPES = [
  { value: "kapot", label: "Kapot" },
  { value: "gat", label: "Gat" },
  { value: "kras", label: "Kras" },
  { value: "deuk", label: "Deuk" },
  { value: "ster", label: "Ster" },
  { value: "beschadigd", label: "Beschadigd" },
  { value: "vuil", label: "Vuil" },
  { value: "ontbreekt", label: "Ontbreekt" },
];

// ---------------------------------------------------------------------------
// Templates list page
// ---------------------------------------------------------------------------

export default function DamageCheckTemplates() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DamageCheckTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<DamageCheckTemplate | null>(null);
  const [clonePickerOpen, setClonePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates = [], isLoading } = useQuery<DamageCheckTemplate[]>({
    queryKey: ["/api/damage-check-templates"],
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
      return await apiRequest("DELETE", `/api/damage-check-templates/${id}`);
    },
    onSuccess: () => {
      invalidateByPrefix("/api/damage-check-templates");
      toast({ title: "Success", description: "Template deleted successfully" });
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

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/damage-check-templates/${id}/set-default`);
    },
    onSuccess: () => {
      invalidateByPrefix("/api/damage-check-templates");
      toast({ title: "Default updated", description: "Template marked as default" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default",
        variant: "destructive",
      });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (payload: { id: number; name?: string }) => {
      return await apiRequest(
        "POST",
        `/api/damage-check-templates/${payload.id}/clone`,
        payload.name ? { name: payload.name } : {},
      );
    },
    onSuccess: () => {
      invalidateByPrefix("/api/damage-check-templates");
      toast({ title: "Cloned", description: "Template cloned successfully" });
      setClonePickerOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clone template",
        variant: "destructive",
      });
    },
  });

  const handleExportTemplate = async (template: DamageCheckTemplate) => {
    try {
      const response = await fetch(`/api/damage-check-templates/${template.id}/export`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to export template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitizedName = template.name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
      a.download = `damage_check_${sanitizedName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Template exported successfully" });
    } catch (error) {
      console.error("Error exporting template:", error);
      toast({ title: "Error", description: "Failed to export template", variant: "destructive" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const templateData = JSON.parse(text);
      await apiRequest("POST", "/api/damage-check-templates/import", templateData);
      invalidateByPrefix("/api/damage-check-templates");
      toast({ title: "Success", description: "Template imported successfully" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error("Error importing template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to import template",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        <div className="flex gap-2 flex-wrap justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            onClick={() => setClonePickerOpen(true)}
            variant="outline"
            className="gap-2"
            disabled={templates.length === 0}
            data-testid="button-open-clone-picker"
          >
            <Copy className="h-4 w-4" />
            Clone from existing…
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2"
            data-testid="button-import-template"
          >
            <Upload className="h-4 w-4" />
            Import Template
          </Button>
          <Button onClick={handleCreateNew} className="gap-2" data-testid="button-create-template">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
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
          {templates.map((template) => {
            const categories =
              template.categories && template.categories.length > 0
                ? template.categories
                : DEFAULT_CATEGORIES;
            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        {template.isDefault && (
                          <Badge variant="default" className="text-xs">
                            Default
                          </Badge>
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
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">Vehicle Target</div>
                      {template.vehicleMake || template.vehicleModel || template.vehicleType ? (
                        <div className="flex flex-wrap gap-1">
                          {template.vehicleMake && (
                            <Badge variant="outline" className="text-xs">
                              {template.vehicleMake}
                            </Badge>
                          )}
                          {template.vehicleModel && (
                            <Badge variant="outline" className="text-xs">
                              {template.vehicleModel}
                            </Badge>
                          )}
                          {template.vehicleType && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {template.vehicleType}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Generic (all vehicles)</span>
                      )}
                    </div>

                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">Inspection Points</div>
                      <div className="text-gray-600">
                        {template.inspectionPoints?.length || 0} check points
                        {template.inspectionPoints?.filter((p) => p.required).length > 0 && (
                          <span className="text-xs text-orange-600 ml-2">
                            ({template.inspectionPoints.filter((p) => p.required).length} required)
                          </span>
                        )}
                      </div>
                    </div>

                    {template.inspectionPoints && template.inspectionPoints.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(template.inspectionPoints.map((p) => p.category))).map(
                          (category) => (
                            <Badge
                              key={category}
                              className={`text-xs ${getCategoryColor(category, categories)}`}
                            >
                              {getCategoryLabel(category, categories)}
                            </Badge>
                          ),
                        )}
                      </div>
                    )}

                    {template.handoverChecklist && template.handoverChecklist.length > 0 && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {template.handoverChecklist.length} handover item
                        {template.handoverChecklist.length === 1 ? "" : "s"}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="flex-1 min-w-[80px]"
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      {!template.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(template.id)}
                          disabled={setDefaultMutation.isPending}
                          data-testid={`button-set-default-${template.id}`}
                          title="Set as default"
                        >
                          <Star className="h-3.5 w-3.5 mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportTemplate(template)}
                        data-testid={`button-export-template-${template.id}`}
                        title="Export to JSON"
                      >
                        <Download className="h-3.5 w-3.5" />
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
            );
          })}
        </div>
      )}

      {editorOpen && (
        <TemplateEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editingTemplate}
        />
      )}

      <ClonePickerDialog
        open={clonePickerOpen}
        onOpenChange={setClonePickerOpen}
        templates={templates}
        onConfirm={(id, name) => cloneMutation.mutate({ id, name })}
        isPending={cloneMutation.isPending}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be
              undone.
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

// ---------------------------------------------------------------------------
// Clone-from-existing picker (single button at top of list)
// ---------------------------------------------------------------------------

function ClonePickerDialog({
  open,
  onOpenChange,
  templates,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DamageCheckTemplate[];
  onConfirm: (id: number, name?: string) => void;
  isPending: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedId("");
      setNewName("");
    }
  }, [open]);

  const selected = templates.find((t) => String(t.id) === selectedId);

  useEffect(() => {
    if (selected && !newName.trim()) {
      setNewName(`${selected.name} (Copy)`);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clone from existing template</DialogTitle>
          <DialogDescription>
            Pick a template to copy. The clone will be created as a new (non-default) template that
            you can edit independently.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Source template</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger data-testid="select-clone-source">
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.isDefault ? "  (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>New template name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Standard Sedan (Copy)"
              data-testid="input-clone-name"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => selected && onConfirm(selected.id, newName.trim() || undefined)}
            disabled={!selected || isPending}
            data-testid="button-confirm-clone"
          >
            {isPending ? "Cloning…" : "Clone"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Template Editor
// ---------------------------------------------------------------------------

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
  const [buildYearFrom, setBuildYearFrom] = useState(template?.buildYearFrom || "");
  const [buildYearTo, setBuildYearTo] = useState(template?.buildYearTo || "");
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);
  const [headerText, setHeaderText] = useState(template?.headerText || "");
  const [footerText, setFooterText] = useState(template?.footerText || "");
  const [categories, setCategories] = useState<TemplateCategory[]>(
    template?.categories && template.categories.length > 0
      ? template.categories
      : DEFAULT_CATEGORIES,
  );
  const [handoverChecklist, setHandoverChecklist] = useState<HandoverChecklistItem[]>(
    template?.handoverChecklist || [],
  );
  const [inspectionPoints, setInspectionPoints] = useState<InspectionPoint[]>(
    template?.inspectionPoints || [],
  );
  const [editingPoint, setEditingPoint] = useState<InspectionPoint | null>(null);
  const [pointEditorOpen, setPointEditorOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Diagram files
  const [topViewFile, setTopViewFile] = useState<File | null>(null);
  const [frontViewFile, setFrontViewFile] = useState<File | null>(null);
  const [rearViewFile, setRearViewFile] = useState<File | null>(null);
  const [sideViewFile, setSideViewFile] = useState<File | null>(null);
  const [uploadingDiagrams, setUploadingDiagrams] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setVehicleMake(template.vehicleMake || "");
      setVehicleModel(template.vehicleModel || "");
      setVehicleType(template.vehicleType || "");
      setBuildYearFrom(template.buildYearFrom || "");
      setBuildYearTo(template.buildYearTo || "");
      setIsDefault(template.isDefault);
      setHeaderText(template.headerText || "");
      setFooterText(template.footerText || "");
      setCategories(
        template.categories && template.categories.length > 0
          ? template.categories
          : DEFAULT_CATEGORIES,
      );
      setHandoverChecklist(template.handoverChecklist || []);
      setInspectionPoints(template.inspectionPoints || []);
    } else {
      setName("");
      setDescription("");
      setVehicleMake("");
      setVehicleModel("");
      setVehicleType("");
      setBuildYearFrom("");
      setBuildYearTo("");
      setIsDefault(false);
      setHeaderText("");
      setFooterText("");
      setCategories(DEFAULT_CATEGORIES);
      setHandoverChecklist([]);
      setInspectionPoints([]);
    }
    setTopViewFile(null);
    setFrontViewFile(null);
    setRearViewFile(null);
    setSideViewFile(null);
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = template
        ? `/api/damage-check-templates/${template.id}`
        : "/api/damage-check-templates";
      const method = template ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      invalidateByPrefix("/api/damage-check-templates");
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }

    if (categories.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one category is required",
        variant: "destructive",
      });
      return;
    }

    const validCategoryIds = new Set(categories.map((c) => c.id));
    const orphanPoints = inspectionPoints.filter((p) => !validCategoryIds.has(p.category));
    if (orphanPoints.length > 0) {
      toast({
        title: "Validation Error",
        description: `${orphanPoints.length} inspection point(s) reference a removed category. Reassign them before saving.`,
        variant: "destructive",
      });
      return;
    }

    let diagramPaths = {
      diagramTopView: template?.diagramTopView || null,
      diagramFrontView: template?.diagramFrontView || null,
      diagramRearView: template?.diagramRearView || null,
      diagramSideView: template?.diagramSideView || null,
    };

    try {
      if (topViewFile || frontViewFile || rearViewFile || sideViewFile) {
        setUploadingDiagrams(true);
        const formData = new FormData();
        if (topViewFile) formData.append("topView", topViewFile);
        if (frontViewFile) formData.append("frontView", frontViewFile);
        if (rearViewFile) formData.append("rearView", rearViewFile);
        if (sideViewFile) formData.append("sideView", sideViewFile);
        const response = await fetch("/api/damage-check-templates/upload-diagrams", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Failed to upload diagrams");
        const uploadedPaths = await response.json();
        diagramPaths = { ...diagramPaths, ...uploadedPaths };
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload diagram images",
        variant: "destructive",
      });
      setUploadingDiagrams(false);
      return;
    } finally {
      setUploadingDiagrams(false);
    }

    // Normalise per-category order so the backend gets a stable ordering hint.
    const orderedPoints = (() => {
      const grouped = new Map<string, InspectionPoint[]>();
      inspectionPoints.forEach((p) => {
        if (!grouped.has(p.category)) grouped.set(p.category, []);
        grouped.get(p.category)!.push(p);
      });
      const out: InspectionPoint[] = [];
      grouped.forEach((arr) => {
        arr
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((p, idx) => out.push({ ...p, order: idx }));
      });
      return out;
    })();

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      vehicleMake: vehicleMake.trim() || null,
      vehicleModel: vehicleModel.trim() || null,
      vehicleType: vehicleType || null,
      buildYearFrom: buildYearFrom.trim() || null,
      buildYearTo: buildYearTo.trim() || null,
      language: "nl",
      isDefault,
      headerText: headerText.trim() || null,
      footerText: footerText.trim() || null,
      categories: categories.map((c, idx) => ({ ...c, order: idx })),
      handoverChecklist: handoverChecklist.map((h, idx) => ({ ...h, order: idx })),
      inspectionPoints: orderedPoints,
      ...diagramPaths,
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
      setInspectionPoints((points) => points.map((p) => (p.id === point.id ? point : p)));
    } else {
      setInspectionPoints((points) => [...points, point]);
    }
    setPointEditorOpen(false);
  };

  const handleDeletePoint = (id: string) => {
    setInspectionPoints((points) => points.filter((p) => p.id !== id));
  };

  // Category management ------------------------------------------------------
  const addCategory = () => {
    const label = `New Category ${categories.length + 1}`;
    setCategories((cs) => [...cs, { id: `cat_${Date.now()}`, label, order: cs.length }]);
  };
  const updateCategoryLabel = (id: string, label: string) => {
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)));
  };
  const removeCategory = (id: string) => {
    const inUse = inspectionPoints.some((p) => p.category === id);
    if (inUse) {
      toast({
        title: "Cannot remove",
        description: "This category is in use by inspection points. Reassign them first.",
        variant: "destructive",
      });
      return;
    }
    setCategories((cs) => cs.filter((c) => c.id !== id));
  };

  // Handover checklist management -------------------------------------------
  const addHandoverItem = () => {
    setHandoverChecklist((items) => [
      ...items,
      {
        id: `hand_${Date.now()}`,
        label: "New item",
        type: "checkbox",
        order: items.length,
      },
    ]);
  };
  const updateHandoverItem = (id: string, patch: Partial<HandoverChecklistItem>) => {
    setHandoverChecklist((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const removeHandoverItem = (id: string) => {
    setHandoverChecklist((items) => items.filter((it) => it.id !== id));
  };

  // Bulk paste --------------------------------------------------------------
  const handleBulkAdd = (
    parsed: Array<{ name: string; category: string; damageTypes: string[] }>,
  ) => {
    const newPoints: InspectionPoint[] = parsed.map((p, idx) => ({
      id: `point-${Date.now()}-${idx}`,
      name: p.name,
      category: p.category,
      damageTypes: p.damageTypes,
      required: false,
      inputType: "checkbox",
    }));
    setInspectionPoints((points) => [...points, ...newPoints]);
    setBulkOpen(false);
    toast({
      title: "Added",
      description: `${newPoints.length} inspection point${newPoints.length === 1 ? "" : "s"} added`,
    });
  };

  // Group + sort points by category for display
  const pointsByCategory = useMemo(() => {
    const map = new Map<string, InspectionPoint[]>();
    categories.forEach((c) => map.set(c.id, []));
    inspectionPoints.forEach((p) => {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return map;
  }, [inspectionPoints, categories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create New Template"}</DialogTitle>
          <DialogDescription>
            {template
              ? "Update template details and inspection points"
              : "Create a custom damage check template for vehicle inspections"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <section className="space-y-4">
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-is-default"
              />
              <Label htmlFor="is-default" className="cursor-pointer">
                Set as default template (will replace any current default)
              </Label>
            </div>
          </section>

          {/* Vehicle Targeting */}
          <section className="space-y-4">
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
                  placeholder="e.g., Audi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g., A3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={vehicleType || "all"}
                  onValueChange={(val) => setVehicleType(val === "all" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="buildYearFrom">Build Year From</Label>
                <Input
                  id="buildYearFrom"
                  value={buildYearFrom}
                  onChange={(e) => setBuildYearFrom(e.target.value)}
                  placeholder="e.g., 2015"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildYearTo">Build Year To</Label>
                <Input
                  id="buildYearTo"
                  value={buildYearTo}
                  onChange={(e) => setBuildYearTo(e.target.value)}
                  placeholder="e.g., 2020"
                  type="number"
                />
              </div>
            </div>
          </section>

          {/* Header / Footer */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">PDF Header &amp; Footer</h3>
            <p className="text-xs text-gray-600">
              Optional text rendered at the top / bottom of every page of the generated damage
              check PDF.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="header-text">Header Text</Label>
                <Textarea
                  id="header-text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  rows={2}
                  placeholder="e.g., Company name, address, phone"
                  data-testid="input-header-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="footer-text">Footer Text</Label>
                <Textarea
                  id="footer-text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  rows={2}
                  placeholder="e.g., Terms &amp; conditions notice"
                  data-testid="input-footer-text"
                />
              </div>
            </div>
          </section>

          {/* Categories */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Categories</h3>
                <p className="text-xs text-gray-600">
                  Group inspection points. Rename, add, or remove categories as needed.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={addCategory} data-testid="button-add-category">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Category
              </Button>
            </div>
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="flex items-center gap-2">
                  <Badge className={`text-xs ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`}>
                    {cat.id}
                  </Badge>
                  <Input
                    value={cat.label}
                    onChange={(e) => updateCategoryLabel(cat.id, e.target.value)}
                    className="flex-1"
                    data-testid={`input-category-label-${cat.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCategory(cat.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-remove-category-${cat.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-red-600">
                  No categories defined — at least one category is required.
                </p>
              )}
            </div>
          </section>

          {/* Handover checklist */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Handover Checklist
                </h3>
                <p className="text-xs text-gray-600">
                  Items handed over with the vehicle (keys, fuel card, jack, registration…).
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addHandoverItem}
                data-testid="button-add-handover"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>
            {handoverChecklist.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-gray-500">
                No handover items yet.
              </div>
            ) : (
              <div className="space-y-2">
                {handoverChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      onChange={(e) => updateHandoverItem(item.id, { label: e.target.value })}
                      className="flex-1"
                      placeholder="e.g., Vehicle keys"
                      data-testid={`input-handover-label-${item.id}`}
                    />
                    <Select
                      value={item.type}
                      onValueChange={(val) =>
                        updateHandoverItem(item.id, { type: val as "checkbox" | "text" })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="text">Text field</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHandoverItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-remove-handover-${item.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vehicle Diagrams */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Vehicle Diagrams</h3>
            <p className="text-xs text-gray-600">
              Upload vehicle diagram images that will appear on the damage check PDF
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="topView">Top View</Label>
                <Input
                  id="topView"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setTopViewFile(e.target.files?.[0] || null)}
                  data-testid="input-top-view"
                />
                {template?.diagramTopView && !topViewFile && (
                  <p className="text-xs text-green-600">Current: {template.diagramTopView}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sideView">Side View</Label>
                <Input
                  id="sideView"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setSideViewFile(e.target.files?.[0] || null)}
                  data-testid="input-side-view"
                />
                {template?.diagramSideView && !sideViewFile && (
                  <p className="text-xs text-green-600">Current: {template.diagramSideView}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="frontView">Front View</Label>
                <Input
                  id="frontView"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setFrontViewFile(e.target.files?.[0] || null)}
                  data-testid="input-front-view"
                />
                {template?.diagramFrontView && !frontViewFile && (
                  <p className="text-xs text-green-600">Current: {template.diagramFrontView}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rearView">Rear View</Label>
                <Input
                  id="rearView"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setRearViewFile(e.target.files?.[0] || null)}
                  data-testid="input-rear-view"
                />
                {template?.diagramRearView && !rearViewFile && (
                  <p className="text-xs text-green-600">Current: {template.diagramRearView}</p>
                )}
              </div>
            </div>
          </section>

          {/* Inspection Points */}
          <section className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Inspection Points</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setBulkOpen(true)}
                  size="sm"
                  variant="outline"
                  data-testid="button-bulk-add"
                >
                  <ClipboardList className="h-3.5 w-3.5 mr-1" />
                  Bulk Add / Paste
                </Button>
                <Button onClick={handleAddPoint} size="sm" data-testid="button-add-inspection-point">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Point
                </Button>
              </div>
            </div>

            {inspectionPoints.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                <Circle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No inspection points yet</p>
                <p className="text-xs mt-1">
                  Click "Add Point" or use Bulk Add to paste a list of points
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => {
                  const pts = pointsByCategory.get(cat.id) || [];
                  if (pts.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs ${getCategoryColor(cat.id, categories)}`}
                        >
                          {cat.label}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {pts.length} point{pts.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {pts.map((point) => (
                        <div
                          key={point.id}
                          className="border rounded-lg p-3 flex items-start justify-between hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {point.required ? (
                                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="font-medium">{point.name}</span>
                              {point.required && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-orange-600 border-orange-300"
                                >
                                  Required
                                </Badge>
                              )}
                              {point.inputType && point.inputType !== "checkbox" && (
                                <Badge variant="outline" className="text-xs">
                                  {point.inputType}
                                </Badge>
                              )}
                            </div>
                            {point.description && (
                              <p className="text-xs text-gray-600 mt-1 ml-6">{point.description}</p>
                            )}
                            {point.notes && (
                              <p className="text-xs text-blue-600 mt-1 ml-6 italic">
                                Note: {point.notes}
                              </p>
                            )}
                            {point.inputType === "dropdown" &&
                              (point.dropdownOptions?.length ?? 0) > 0 && (
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                  Options: {point.dropdownOptions!.join(", ")}
                                </p>
                              )}
                            {(point.photoPaths?.length ?? 0) > 0 && (
                              <p className="text-xs text-gray-500 mt-1 ml-6">
                                {point.photoPaths!.length} reference photo
                                {point.photoPaths!.length === 1 ? "" : "s"}
                              </p>
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
                      ))}
                    </div>
                  );
                })}
                {/* Orphan points (category was deleted) */}
                {(() => {
                  const validIds = new Set(categories.map((c) => c.id));
                  const orphans = inspectionPoints.filter((p) => !validIds.has(p.category));
                  if (orphans.length === 0) return null;
                  return (
                    <div className="border border-red-300 bg-red-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-red-700 font-medium">
                        Points without a valid category — please edit and reassign:
                      </p>
                      {orphans.map((point) => (
                        <div
                          key={point.id}
                          className="flex items-center justify-between bg-white rounded p-2"
                        >
                          <span className="text-sm">
                            {point.name}{" "}
                            <span className="text-xs text-red-600">({point.category})</span>
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPoint(point)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePoint(point.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || uploadingDiagrams}
            data-testid="button-save-template"
          >
            {uploadingDiagrams
              ? "Uploading Diagrams..."
              : saveMutation.isPending
              ? "Saving..."
              : template
              ? "Update Template"
              : "Create Template"}
          </Button>
        </div>

        {pointEditorOpen && (
          <InspectionPointEditor
            open={pointEditorOpen}
            onOpenChange={setPointEditorOpen}
            point={editingPoint}
            categories={categories}
            onSave={handleSavePoint}
          />
        )}

        {bulkOpen && (
          <BulkAddDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            categories={categories}
            onAdd={handleBulkAdd}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Inspection Point Editor
// ---------------------------------------------------------------------------

function InspectionPointEditor({
  open,
  onOpenChange,
  point,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: InspectionPoint | null;
  categories: TemplateCategory[];
  onSave: (point: InspectionPoint) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(point?.name || "");
  const [category, setCategory] = useState(point?.category || categories[0]?.id || "");
  const [description, setDescription] = useState(point?.description || "");
  const [notes, setNotes] = useState(point?.notes || "");
  const [required, setRequired] = useState(point?.required || false);
  const [inputType, setInputType] = useState<"checkbox" | "text" | "dropdown">(
    point?.inputType || "checkbox",
  );
  const [dropdownOptionsText, setDropdownOptionsText] = useState(
    (point?.dropdownOptions || []).join("\n"),
  );
  const [selectedDamageTypes, setSelectedDamageTypes] = useState<string[]>(
    point?.damageTypes || [],
  );
  const [photoPaths, setPhotoPaths] = useState<string[]>(point?.photoPaths || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const toggleDamageType = (type: string) => {
    setSelectedDamageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch("/api/damage-check-templates/upload-photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      const stored: string | undefined = data?.path || data?.url;
      if (!stored) throw new Error("Upload response missing path");
      setPhotoPaths((paths) => [...paths, stored]);
      toast({ title: "Uploaded", description: "Reference photo added" });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Could not upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (!category) {
      toast({
        title: "Validation Error",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }
    const dropdownOptions =
      inputType === "dropdown"
        ? dropdownOptionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (inputType === "dropdown" && (!dropdownOptions || dropdownOptions.length === 0)) {
      toast({
        title: "Validation Error",
        description: "Dropdown input requires at least one option (one per line)",
        variant: "destructive",
      });
      return;
    }

    const newPoint: InspectionPoint = {
      id: point?.id || `point-${Date.now()}`,
      name: name.trim(),
      category,
      damageTypes: inputType === "checkbox" ? selectedDamageTypes : [],
      description: description.trim() || undefined,
      required,
      position: point?.position,
      notes: notes.trim() || undefined,
      photoPaths: photoPaths.length > 0 ? photoPaths : undefined,
      inputType,
      dropdownOptions,
      order: point?.order,
    };
    onSave(newPoint);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="point-category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="point-category">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="point-input-type">Input Type</Label>
              <Select
                value={inputType}
                onValueChange={(val) => setInputType(val as "checkbox" | "text" | "dropdown")}
              >
                <SelectTrigger id="point-input-type" data-testid="select-input-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkbox">Checkbox (damage types)</SelectItem>
                  <SelectItem value="text">Free-text field</SelectItem>
                  <SelectItem value="dropdown">Dropdown (single choice)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="point-description">Description (Optional)</Label>
            <Textarea
              id="point-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What to check for this point..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="point-notes">Internal Notes (Optional)</Label>
            <Textarea
              id="point-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions for the inspector (printed on PDF)…"
              rows={2}
              data-testid="input-point-notes"
            />
          </div>

          {inputType === "checkbox" && (
            <div className="space-y-2">
              <Label>Damage Types</Label>
              <p className="text-xs text-gray-600 mb-2">
                Select which types of damage can be recorded for this inspection point
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_TYPES.map((damageType) => (
                  <div key={damageType.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`damage-${damageType.value}`}
                      checked={selectedDamageTypes.includes(damageType.value)}
                      onChange={() => toggleDamageType(damageType.value)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label
                      htmlFor={`damage-${damageType.value}`}
                      className="cursor-pointer text-sm"
                    >
                      {damageType.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inputType === "dropdown" && (
            <div className="space-y-2">
              <Label htmlFor="dropdown-options">Dropdown Options (one per line) *</Label>
              <Textarea
                id="dropdown-options"
                value={dropdownOptionsText}
                onChange={(e) => setDropdownOptionsText(e.target.value)}
                rows={4}
                placeholder={"Full\n3/4\n1/2\n1/4\nEmpty"}
                data-testid="input-dropdown-options"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Reference Photos (Optional)</Label>
            <div className="space-y-2">
              {photoPaths.length > 0 && (
                <ul className="space-y-1">
                  {photoPaths.map((p, idx) => (
                    <li
                      key={`${p}-${idx}`}
                      className="flex items-center justify-between text-xs bg-gray-50 rounded p-2"
                    >
                      <span className="truncate">{p}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPhotoPaths((paths) => paths.filter((_, i) => i !== idx))
                        }
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                data-testid="input-point-photo"
              />
              {uploadingPhoto && <p className="text-xs text-gray-500">Uploading…</p>}
            </div>
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

// ---------------------------------------------------------------------------
// Bulk add / paste dialog
// ---------------------------------------------------------------------------

function BulkAddDialog({
  open,
  onOpenChange,
  categories,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TemplateCategory[];
  onAdd: (
    parsed: Array<{ name: string; category: string; damageTypes: string[] }>,
  ) => void;
}) {
  const { toast } = useToast();
  const [defaultCategory, setDefaultCategory] = useState(categories[0]?.id || "");
  const [text, setText] = useState("");
  const [defaultDamageTypes, setDefaultDamageTypes] = useState<string[]>([]);

  const toggleDamageType = (type: string) => {
    setDefaultDamageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleAdd = () => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast({
        title: "Nothing to add",
        description: "Paste at least one inspection point",
        variant: "destructive",
      });
      return;
    }
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const categoryByLabelLower = new Map(
      categories.map((c) => [c.label.toLowerCase(), c]),
    );

    const parsed = lines.map((line) => {
      // Format: "Name" or "Name | Category" or "Name | Category | dmg1,dmg2"
      const parts = line.split("|").map((p) => p.trim());
      const name = parts[0] || "";
      let categoryId = defaultCategory;
      if (parts[1]) {
        const lookup =
          categoryById.get(parts[1]) ||
          categoryByLabelLower.get(parts[1].toLowerCase());
        if (lookup) {
          categoryId = lookup.id;
        }
      }
      let damageTypes = defaultDamageTypes;
      if (parts[2]) {
        damageTypes = parts[2]
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
      }
      return { name, category: categoryId, damageTypes };
    });

    const invalid = parsed.filter((p) => !p.name || !p.category);
    if (invalid.length > 0) {
      toast({
        title: "Invalid lines",
        description: `${invalid.length} line(s) missing name or category`,
        variant: "destructive",
      });
      return;
    }
    onAdd(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Inspection Points</DialogTitle>
          <DialogDescription>
            Paste one inspection point per line. Optional format:{" "}
            <code>Name | Category | damage1,damage2</code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Default Category</Label>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger data-testid="select-bulk-default-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Damage Types</Label>
              <div className="grid grid-cols-2 gap-1 border rounded p-2 max-h-32 overflow-y-auto">
                {DAMAGE_TYPES.map((dt) => (
                  <div key={dt.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`bulk-dmg-${dt.value}`}
                      checked={defaultDamageTypes.includes(dt.value)}
                      onChange={() => toggleDamageType(dt.value)}
                      className="h-3 w-3 rounded"
                    />
                    <Label
                      htmlFor={`bulk-dmg-${dt.value}`}
                      className="text-xs cursor-pointer"
                    >
                      {dt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-text">Inspection points (one per line)</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={
                "Front Bumper\nLeft Door | Exterieur\nFuel Level | Afweez Check | full,empty"
              }
              data-testid="input-bulk-text"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} data-testid="button-confirm-bulk-add">
            Add Points
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

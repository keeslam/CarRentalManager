import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ZoomIn, ZoomOut, Grid, Move, Save, Plus, Trash2, Edit, ChevronDown, ChevronUp,
  Lock, Unlock, Eye, EyeOff, Settings2, AlignLeft, AlignCenter, AlignRight, FileDown, Check, Upload, Download
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DamageCheckTemplate } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Section type definition
interface TemplateSection {
  id: string;
  type: 'header' | 'contractInfo' | 'vehicleData' | 'checklist' | 'diagram' | 'remarks' | 'signatures' | 'customField';
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked?: boolean;
  settings: {
    fontSize?: number;
    checkboxSize?: number;
    companyName?: string;
    headerColor?: string;
    headerFontSize?: number;
    showLogo?: boolean;
    customLabel?: string;
    textAlign?: 'left' | 'center' | 'right';
    customItems?: Array<{
      id: string;
      text: string;
      hasCheckbox: boolean;
      fieldKey?: string;
    }>;
    [key: string]: any;
  };
}

interface PdfTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  sections: TemplateSection[];
  pageMargins: number;
}

// Default section layouts
const createDefaultSections = (): TemplateSection[] => [
  {
    id: 'header',
    type: 'header',
    x: 15,
    y: 15,
    width: 565,
    height: 40,
    visible: true,
    settings: {
      companyName: 'LAM GROUP',
      headerColor: '#334d99',
      headerFontSize: 14,
      showLogo: true,
    }
  },
  {
    id: 'contractInfo',
    type: 'contractInfo',
    x: 15,
    y: 65,
    width: 565,
    height: 60,
    visible: true,
    settings: {
      fontSize: 9,
      customItems: [
        { id: 'contract-nr', text: 'Contract Nr:', hasCheckbox: false, fieldKey: 'contractNumber' },
        { id: 'datum', text: 'Datum:', hasCheckbox: false, fieldKey: 'date' },
        { id: 'klant', text: 'Klant:', hasCheckbox: false, fieldKey: 'customerName' },
        { id: 'periode', text: 'Periode:', hasCheckbox: false, fieldKey: 'rentalPeriod' },
      ]
    }
  },
  {
    id: 'vehicleData',
    type: 'vehicleData',
    x: 15,
    y: 135,
    width: 565,
    height: 80,
    visible: true,
    settings: {
      fontSize: 9,
      customItems: [
        { id: 'kenteken', text: 'Kenteken:', hasCheckbox: false, fieldKey: 'licensePlate' },
        { id: 'merk', text: 'Merk:', hasCheckbox: false, fieldKey: 'brand' },
        { id: 'model', text: 'Model:', hasCheckbox: false, fieldKey: 'model' },
        { id: 'bouwjaar', text: 'Bouwjaar:', hasCheckbox: false, fieldKey: 'buildYear' },
        { id: 'km-stand', text: 'Km Stand:', hasCheckbox: false, fieldKey: 'mileage' },
        { id: 'brandstof', text: 'Brandstof:', hasCheckbox: false, fieldKey: 'fuel' },
      ]
    }
  },
  {
    id: 'checklist',
    type: 'checklist',
    x: 15,
    y: 225,
    width: 565,
    height: 340,
    visible: true,
    settings: {
      fontSize: 9,
      checkboxSize: 10,
    }
  },
  {
    id: 'diagram',
    type: 'diagram',
    x: 15,
    y: 575,
    width: 565,
    height: 120,
    visible: true,
    settings: {}
  },
  {
    id: 'remarks',
    type: 'remarks',
    x: 15,
    y: 705,
    width: 565,
    height: 60,
    visible: true,
    settings: {
      fontSize: 9,
      customItems: []
    }
  },
  {
    id: 'signatures',
    type: 'signatures',
    x: 15,
    y: 775,
    width: 565,
    height: 52,
    visible: true,
    settings: {
      fontSize: 9,
      customItems: [
        { id: 'klant-sig', text: 'Handtekening Klant', hasCheckbox: false },
        { id: 'medewerker-sig', text: 'Handtekening Medewerker', hasCheckbox: false },
      ]
    }
  },
];

const SECTION_LABELS: Record<string, string> = {
  header: 'Header',
  contractInfo: 'Contract Info',
  vehicleData: 'Vehicle Data',
  checklist: 'Checklist',
  diagram: 'Vehicle Diagram',
  remarks: 'Remarks',
  signatures: 'Signatures',
  customField: 'Custom Field',
};

export default function DamageCheckTemplateEditor() {
  const { toast } = useToast();
  const [currentTemplate, setCurrentTemplate] = useState<PdfTemplate | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [draggedSection, setDraggedSection] = useState<TemplateSection | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  const [showGrid, setShowGrid] = useState(false);
  const [isMoving, setIsMoving] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [resizingSection, setResizingSection] = useState<{section: TemplateSection, handle: string} | null>(null);
  const [resizeStart, setResizeStart] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);

  // Checklist template editing state
  const [currentChecklistTemplate, setCurrentChecklistTemplate] = useState<DamageCheckTemplate | null>(null);
  const [editingPoint, setEditingPoint] = useState<any | null>(null);
  const [pointEditorOpen, setPointEditorOpen] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  const { data: templates = [] } = useQuery<PdfTemplate[]>({
    queryKey: ['/api/damage-check-pdf-templates'],
  });

  // Fetch damage check templates (for checklist content)
  const { data: damageCheckTemplates = [] } = useQuery<DamageCheckTemplate[]>({
    queryKey: ['/api/damage-check-templates'],
  });

  // Update current template when templates refetch (to get latest saved data)
  useEffect(() => {
    if (currentTemplate && templates.length > 0) {
      const updatedTemplate = templates.find(t => t.id === currentTemplate.id);
      if (updatedTemplate) {
        setCurrentTemplate(updatedTemplate);
      }
    } else if (!currentTemplate && templates.length > 0) {
      // Auto-select first template if none selected
      setCurrentTemplate(templates[0]);
    }
  }, [templates]);

  // Auto-select first checklist template
  useEffect(() => {
    if (damageCheckTemplates.length > 0 && !currentChecklistTemplate) {
      setCurrentChecklistTemplate(damageCheckTemplates[0]);
    }
  }, [damageCheckTemplates]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<PdfTemplate>) => {
      if (template.id) {
        return await apiRequest('PUT', `/api/damage-check-pdf-templates/${template.id}`, template);
      } else {
        return await apiRequest('POST', '/api/damage-check-pdf-templates', template);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      toast({ title: "Success", description: "Template saved" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/damage-check-pdf-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      toast({ title: "Success", description: "Template deleted" });
      setCurrentTemplate(null);
    },
  });

  const saveChecklistTemplateMutation = useMutation({
    mutationFn: async (template: Partial<DamageCheckTemplate>) => {
      if (template.id) {
        return await apiRequest('PUT', `/api/damage-check-templates/${template.id}`, template);
      } else {
        return await apiRequest('POST', '/api/damage-check-templates', template);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-templates'] });
      toast({ title: "Success", description: "Checklist template saved" });
    },
  });

  const handleCreateTemplate = () => {
    if (!newTemplateName) {
      toast({ title: "Error", description: "Please enter a template name", variant: "destructive" });
      return;
    }

    const newTemplate: Partial<PdfTemplate> = {
      name: newTemplateName,
      isDefault: templates.length === 0,
      sections: createDefaultSections(),
      pageMargins: 15,
    };

    saveTemplateMutation.mutate(newTemplate);
    setNewTemplateName('');
    setIsCreateDialogOpen(false);
  };

  const handleExportTemplate = async () => {
    if (!currentTemplate?.id) {
      toast({
        title: "Error",
        description: "Please save the template first",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/damage-check-pdf-templates/${currentTemplate.id}/export`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${currentTemplate.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Template exported successfully"
      });
    } catch (error) {
      console.error('Error exporting template:', error);
      toast({
        title: "Error",
        description: "Failed to export template",
        variant: "destructive"
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const templateData = JSON.parse(text);

      const response = await apiRequest('POST', '/api/damage-check-pdf-templates/import', templateData);

      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      
      toast({
        title: "Success",
        description: "PDF template layout imported successfully"
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error importing template:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import template",
        variant: "destructive"
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportChecklistTemplate = async () => {
    if (damageCheckTemplates.length === 0) {
      toast({
        title: "No Template",
        description: "No checklist template found to export",
        variant: "destructive"
      });
      return;
    }

    const template = damageCheckTemplates[0]; // Export first template

    try {
      const response = await fetch(`/api/damage-check-templates/${template.id}/export`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export checklist template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedName = template.name
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .substring(0, 50);
      a.download = `damage_check_${sanitizedName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Checklist template exported successfully"
      });
    } catch (error) {
      console.error('Error exporting checklist template:', error);
      toast({
        title: "Error",
        description: "Failed to export checklist template",
        variant: "destructive"
      });
    }
  };

  const handleImportChecklistFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const templateData = JSON.parse(text);

      const response = await apiRequest('POST', '/api/damage-check-templates/import', templateData);

      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-templates'] });
      
      toast({
        title: "Success",
        description: "Checklist template imported successfully"
      });

      // Reset file input
      if (checklistInputRef.current) {
        checklistInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error importing checklist template:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import checklist template",
        variant: "destructive"
      });

      // Reset file input
      if (checklistInputRef.current) {
        checklistInputRef.current.value = '';
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, section: TemplateSection) => {
    if (section.locked || !isMoving || !currentTemplate || !canvasRef.current) return;
    e.preventDefault();
    
    setSelectedSection(section.id);
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - canvasRect.left) / zoomLevel;
    const clickY = (e.clientY - canvasRect.top) / zoomLevel;
    
    setDragOffset({
      x: clickX - section.x,
      y: clickY - section.y
    });
    
    setDraggedSection(section);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedSection || !dragOffset || !currentTemplate || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left) / zoomLevel - dragOffset.x;
    const y = (e.clientY - canvasRect.top) / zoomLevel - dragOffset.y;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(0, Math.min(x, 595 - draggedSection.width));
    const constrainedY = Math.max(0, Math.min(y, 842 - draggedSection.height));
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === draggedSection.id ? { ...s, x: constrainedX, y: constrainedY } : s
    );
    
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    setDraggedSection({ ...draggedSection, x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    if (draggedSection && currentTemplate) {
      saveTemplateMutation.mutate(currentTemplate);
    }
    if (resizingSection && currentTemplate) {
      saveTemplateMutation.mutate(currentTemplate);
    }
    setDraggedSection(null);
    setDragOffset(null);
    setResizingSection(null);
    setResizeStart(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, section: TemplateSection, handle: string) => {
    if (section.locked || !canvasRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    
    setSelectedSection(section.id);
    setResizingSection({ section, handle });
    setResizeStart({
      x: section.x,
      y: section.y,
      width: section.width,
      height: section.height
    });
  };

  const handleResizeMouseMove = (e: React.MouseEvent) => {
    if (!resizingSection || !resizeStart || !currentTemplate || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - canvasRect.left) / zoomLevel;
    const mouseY = (e.clientY - canvasRect.top) / zoomLevel;
    
    const { section, handle } = resizingSection;
    let newX = resizeStart.x;
    let newY = resizeStart.y;
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    
    // Calculate new dimensions based on handle
    if (handle.includes('e')) {
      newWidth = Math.max(50, mouseX - section.x);
    }
    if (handle.includes('s')) {
      newHeight = Math.max(30, mouseY - section.y);
    }
    if (handle.includes('w')) {
      const delta = mouseX - section.x;
      newWidth = Math.max(50, resizeStart.width - delta);
      newX = resizeStart.x + (resizeStart.width - newWidth);
    }
    if (handle.includes('n')) {
      const delta = mouseY - section.y;
      newHeight = Math.max(30, resizeStart.height - delta);
      newY = resizeStart.y + (resizeStart.height - newHeight);
    }
    
    // Constrain to canvas bounds
    newX = Math.max(0, Math.min(newX, 595 - newWidth));
    newY = Math.max(0, Math.min(newY, 842 - newHeight));
    newWidth = Math.min(newWidth, 595 - newX);
    newHeight = Math.min(newHeight, 842 - newY);
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === section.id ? { ...s, x: newX, y: newY, width: newWidth, height: newHeight } : s
    );
    
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
  };

  const toggleSectionVisibility = (sectionId: string) => {
    if (!currentTemplate) return;
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === sectionId ? { ...s, visible: !s.visible } : s
    );
    
    const updated = { ...currentTemplate, sections: updatedSections };
    setCurrentTemplate(updated);
    saveTemplateMutation.mutate(updated);
  };

  const toggleSectionLock = (sectionId: string) => {
    if (!currentTemplate) return;
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === sectionId ? { ...s, locked: !s.locked } : s
    );
    
    const updated = { ...currentTemplate, sections: updatedSections };
    setCurrentTemplate(updated);
    saveTemplateMutation.mutate(updated);
  };

  const openSectionSettings = (section: TemplateSection) => {
    setEditingSection(section);
    setIsSettingsDialogOpen(true);
  };

  const updateSectionSettings = (settings: any) => {
    if (!currentTemplate || !editingSection) return;
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === editingSection.id ? { ...s, settings: { ...s.settings, ...settings } } : s
    );
    
    const updated = { ...currentTemplate, sections: updatedSections };
    setCurrentTemplate(updated);
    saveTemplateMutation.mutate(updated);
    setIsSettingsDialogOpen(false);
    setEditingSection(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSection) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'logo');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      updateSectionSettings({ logoPath: data.filePath });
      toast({ title: "Success", description: "Logo uploaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload logo", variant: "destructive" });
    }
  };

  const getSectionColor = (type: string) => {
    const colors: Record<string, string> = {
      header: '#334d99',
      contractInfo: '#10b981',
      vehicleData: '#f59e0b',
      checklist: '#3b82f6',
      diagram: '#8b5cf6',
      remarks: '#ec4899',
      signatures: '#06b6d4',
      customField: '#14b8a6',
    };
    return colors[type] || '#6b7280';
  };

  const addCustomField = () => {
    if (!currentTemplate) return;
    
    const newSection: TemplateSection = {
      id: `custom-${Date.now()}`,
      type: 'customField',
      x: 30,
      y: 400,
      width: 200,
      height: 30,
      visible: true,
      locked: false,
      settings: {
        customLabel: 'New Field',
        fieldText: 'Field Label',
        hasCheckbox: true,
        hasText: true,
        fontSize: 9,
      }
    };
    
    setCurrentTemplate({
      ...currentTemplate,
      sections: [...currentTemplate.sections, newSection]
    });
    setSelectedSection(newSection.id);
    toast({
      title: "Field Added",
      description: "Custom field added to template"
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Damage Check PDF Template Editor</CardTitle>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <input
              type="file"
              ref={checklistInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportChecklistFile}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              size="sm"
              variant="outline"
              data-testid="button-import-pdf-template"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import PDF Layout
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[250px_1fr] gap-4">
          {/* Left Sidebar - Template List & Controls */}
          <div className="space-y-4">
            {/* Template List */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Templates</Label>
              <div className="space-y-2">
                {templates.map(template => (
                  <Button
                    key={template.id}
                    variant={currentTemplate?.id === template.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setCurrentTemplate(template)}
                    data-testid={`template-${template.id}`}
                  >
                    {template.name}
                    {template.isDefault && <span className="ml-2 text-xs">(Default)</span>}
                  </Button>
                ))}
              </div>
            </div>

            {currentTemplate && (
              <>
                {/* Editor Controls */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label>Move Mode</Label>
                    <Switch checked={isMoving} onCheckedChange={setIsMoving} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Grid</Label>
                    <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Zoom: {Math.round(zoomLevel * 100)}%</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomLevel(Math.max(0.3, zoomLevel - 0.1))}
                      disabled={zoomLevel <= 0.3}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomLevel(1)}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))}
                      disabled={zoomLevel >= 1.5}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Sections List */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Sections</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCustomField}
                      className="h-7"
                      data-testid="button-add-custom-field"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Field
                    </Button>
                  </div>
                  {currentTemplate.sections.map(section => (
                    <div
                      key={section.id}
                      className={`p-2 rounded border ${selectedSection === section.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                      style={{ borderLeftWidth: 4, borderLeftColor: getSectionColor(section.type) }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{section.settings.customLabel || SECTION_LABELS[section.type]}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openSectionSettings(section)}
                            title="Settings"
                          >
                            <Settings2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleSectionVisibility(section.id)}
                          >
                            {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleSectionLock(section.id)}
                          >
                            {section.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </Button>
                          {section.type === 'customField' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600"
                              onClick={() => {
                                setCurrentTemplate({
                                  ...currentTemplate,
                                  sections: currentTemplate.sections.filter(s => s.id !== section.id)
                                });
                                toast({ title: "Field Deleted", description: "Custom field removed from template" });
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t">
                  <Button
                    className="w-full"
                    onClick={() => saveTemplateMutation.mutate(currentTemplate)}
                    disabled={saveTemplateMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      if (!currentTemplate.id) {
                        toast({
                          title: "Save Required",
                          description: "Please save the template before previewing",
                          variant: "destructive"
                        });
                        return;
                      }
                      try {
                        const response = await fetch(`/api/damage-check-pdf-templates/${currentTemplate.id}/preview`, {
                          credentials: 'include',
                        });
                        
                        if (!response.ok) {
                          throw new Error('Failed to generate preview PDF');
                        }
                        
                        // Get the PDF blob
                        const blob = await response.blob();
                        
                        // Create a download link
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `preview_${currentTemplate.name.replace(/\s+/g, '_')}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Preview Generated",
                          description: "Template preview PDF downloaded successfully"
                        });
                      } catch (error) {
                        console.error('Error generating preview PDF:', error);
                        toast({
                          title: "Error",
                          description: "Failed to generate preview PDF",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={!currentTemplate.id}
                    data-testid="button-preview-pdf"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Preview PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      if (!currentTemplate.id) {
                        toast({
                          title: "Save Required",
                          description: "Please save the template first",
                          variant: "destructive"
                        });
                        return;
                      }
                      try {
                        const updatedTemplate = { ...currentTemplate, isDefault: true };
                        await apiRequest('PATCH', `/api/damage-check-pdf-templates/${currentTemplate.id}`, updatedTemplate);
                        queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
                        toast({
                          title: "Success",
                          description: "Template set as default"
                        });
                      } catch (error) {
                        console.error('Error setting default template:', error);
                        toast({
                          title: "Error",
                          description: "Failed to set template as default",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={!currentTemplate.id || currentTemplate.isDefault}
                    data-testid="button-set-default"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {currentTemplate.isDefault ? 'Default Template' : 'Set as Default'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleExportTemplate}
                    disabled={!currentTemplate.id}
                    data-testid="button-export-pdf-template"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF Layout
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full text-red-600"
                    onClick={() => currentTemplate.id && deleteTemplateMutation.mutate(currentTemplate.id)}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Template
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Right Side - Canvas */}
          <div className="flex flex-col items-center">
            {currentTemplate ? (
              <div className="relative bg-gray-100 p-8 rounded-lg overflow-auto max-h-[800px]">
                <div
                  ref={canvasRef}
                  className="relative bg-white shadow-lg mx-auto"
                  style={{
                    width: 595 * zoomLevel,
                    height: 842 * zoomLevel,
                    cursor: isMoving ? 'move' : 'default',
                  }}
                  onMouseMove={(e) => {
                    handleMouseMove(e);
                    handleResizeMouseMove(e);
                  }}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Grid */}
                  {showGrid && (
                    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                      <defs>
                        <pattern id="grid" width={10 * zoomLevel} height={10 * zoomLevel} patternUnits="userSpaceOnUse">
                          <path d={`M ${10 * zoomLevel} 0 L 0 0 0 ${10 * zoomLevel}`} fill="none" stroke="gray" strokeWidth="0.5" opacity="0.3"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                  )}

                  {/* Sections */}
                  {currentTemplate.sections.filter(s => s.visible).map(section => (
                    <div
                      key={section.id}
                      className={`absolute border-2 ${
                        selectedSection === section.id ? 'border-blue-500' : 'border-gray-300'
                      } ${section.locked ? 'cursor-not-allowed' : 'cursor-move'} rounded overflow-hidden`}
                      style={{
                        left: section.x * zoomLevel,
                        top: section.y * zoomLevel,
                        width: section.width * zoomLevel,
                        height: section.height * zoomLevel,
                        backgroundColor: selectedSection === section.id ? `${getSectionColor(section.type)}15` : `${getSectionColor(section.type)}05`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, section)}
                    >
                      {/* Section Label */}
                      <div
                        className="absolute top-0 left-0 right-0 text-white px-2 py-1 text-xs font-semibold flex items-center justify-between"
                        style={{ backgroundColor: getSectionColor(section.type) }}
                      >
                        <span>{section.settings.customLabel || SECTION_LABELS[section.type]}</span>
                        {isMoving && !section.locked && <Move className="w-3 h-3" />}
                      </div>
                      
                      {/* Section Content Preview */}
                      <div className="p-2 pt-8 text-[8px] text-gray-700 leading-tight" style={{ textAlign: section.settings.textAlign || 'left' }}>
                        {section.type === 'header' && (
                          <div className="font-bold" style={{ fontSize: `${section.settings.headerFontSize || 14}px`, color: section.settings.headerColor || '#334d99', textAlign: section.settings.textAlign || 'center' }}>
                            {section.settings.companyName || 'LAM GROUP'}
                            {section.settings.logoPath && <div className="text-[6px] text-gray-400 mt-1">[Logo]</div>}
                          </div>
                        )}
                        {section.type === 'contractInfo' && (
                          <div 
                            className="w-full"
                            style={{
                              columnCount: section.settings.columnCount || 1,
                              columnGap: '8px'
                            }}
                          >
                            {section.settings.customItems && section.settings.customItems.length > 0 ? (
                              section.settings.customItems.map(item => {
                                const sampleValues: Record<string, string> = {
                                  contractNumber: 'REN-2025-001',
                                  date: new Date().toLocaleDateString('nl-NL'),
                                  customerName: 'Jan de Vries',
                                  rentalPeriod: '22-10-2025 - 29-10-2025'
                                };
                                const value = item.fieldKey ? sampleValues[item.fieldKey] || '[Data]' : '';
                                return (
                                  <div key={item.id} className="flex items-center gap-1 text-[7px] mb-1" style={{ breakInside: 'avoid-column' }}>
                                    {item.hasCheckbox && <span>☐</span>}
                                    <span>{item.text} {value}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-[6px] text-gray-400">No fields. Add fields in settings.</div>
                            )}
                          </div>
                        )}
                        {section.type === 'vehicleData' && (
                          <div 
                            className="w-full"
                            style={{
                              columnCount: section.settings.columnCount || 1,
                              columnGap: '8px'
                            }}
                          >
                            {section.settings.customItems && section.settings.customItems.length > 0 ? (
                              section.settings.customItems.map(item => {
                                const sampleValues: Record<string, string> = {
                                  licensePlate: 'AB-123-CD',
                                  brand: 'Mercedes',
                                  model: 'E-Klasse',
                                  buildYear: '2020',
                                  mileage: '45.320 km',
                                  fuel: '3/4 tank'
                                };
                                const value = item.fieldKey ? sampleValues[item.fieldKey] || '[Data]' : '';
                                return (
                                  <div key={item.id} className="flex items-center gap-1 text-[7px] mb-1" style={{ breakInside: 'avoid-column' }}>
                                    {item.hasCheckbox && <span>☐</span>}
                                    <span>{item.text} {value}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-[6px] text-gray-400">No fields. Add fields in settings.</div>
                            )}
                          </div>
                        )}
                        {section.type === 'checklist' && (
                          <div 
                            className="w-full h-full overflow-auto text-[8px] leading-tight p-1"
                            style={{ 
                              columnCount: section.settings.columnCount || 3,
                              columnGap: '8px'
                            }}
                          >
                            {damageCheckTemplates.length > 0 && damageCheckTemplates[0].inspectionPoints ? (
                              <>
                                {/* Group by category */}
                                {['interieur', 'exterieur', 'afweez_check'].map(category => {
                                  const categoryItems = (damageCheckTemplates[0].inspectionPoints as any[])
                                    .filter((item: any) => item.category === category);
                                  
                                  if (categoryItems.length === 0) return null;
                                  
                                  const categoryTitle = category === 'interieur' ? 'Interieur' : 
                                                       category === 'exterieur' ? 'Exterieur' : 
                                                       'Aflever Check';
                                  
                                  return (
                                    <div key={category} className="mb-1" style={{ breakInside: 'avoid-column' }}>
                                      <div className="font-bold">{categoryTitle}</div>
                                      {categoryItems.map((item: any, idx: number) => (
                                        <div key={idx} className="ml-1 flex items-start gap-1">
                                          <span>☐</span>
                                          <span>{item.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <>
                                <div>☐ Interieur: Binnenzijde auto schoon</div>
                                <div>☐ Exterieur: Buitenzijde auto schoon</div>
                                <div>☐ Aflever Check: Olie - water</div>
                              </>
                            )}
                          </div>
                        )}
                        {section.type === 'diagram' && (
                          <div className="flex items-center justify-center h-full p-2">
                            {damageCheckTemplates.length > 0 && (
                              damageCheckTemplates[0].diagramTopView || 
                              damageCheckTemplates[0].diagramFrontView || 
                              damageCheckTemplates[0].diagramSideView || 
                              damageCheckTemplates[0].diagramRearView
                            ) ? (
                              <div className="grid grid-cols-2 gap-1 w-full h-full">
                                {damageCheckTemplates[0].diagramTopView && (
                                  <div className="flex items-center justify-center border border-gray-200">
                                    <img 
                                      src={damageCheckTemplates[0].diagramTopView} 
                                      alt="Top View" 
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                )}
                                {damageCheckTemplates[0].diagramFrontView && (
                                  <div className="flex items-center justify-center border border-gray-200">
                                    <img 
                                      src={damageCheckTemplates[0].diagramFrontView} 
                                      alt="Front View" 
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                )}
                                {damageCheckTemplates[0].diagramSideView && (
                                  <div className="flex items-center justify-center border border-gray-200">
                                    <img 
                                      src={damageCheckTemplates[0].diagramSideView} 
                                      alt="Side View" 
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                )}
                                {damageCheckTemplates[0].diagramRearView && (
                                  <div className="flex items-center justify-center border border-gray-200">
                                    <img 
                                      src={damageCheckTemplates[0].diagramRearView} 
                                      alt="Rear View" 
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-[7px] text-gray-400 border border-dashed border-gray-300 p-2 w-full h-full flex items-center justify-center">
                                <div>
                                  <div>Voertuig Diagram</div>
                                  <div className="text-[6px]">(Schade markering)</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {section.type === 'remarks' && (
                          <div className="text-[7px]">
                            <div className="border border-gray-300 p-1 bg-gray-50 mb-2" style={{ minHeight: '40px' }}>
                              [Ruimte voor opmerkingen]
                            </div>
                            {section.settings.customItems && section.settings.customItems.length > 0 && (
                              <div 
                                className="w-full"
                                style={{
                                  columnCount: section.settings.columnCount || 1,
                                  columnGap: '8px'
                                }}
                              >
                                {section.settings.customItems.map(item => (
                                  <div key={item.id} className="flex items-center gap-1 text-[7px] mb-1" style={{ breakInside: 'avoid-column' }}>
                                    {item.hasCheckbox && <span>☐</span>}
                                    <span>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.type === 'signatures' && (
                          <div 
                            className="w-full"
                            style={{
                              columnCount: section.settings.columnCount || 2,
                              columnGap: '8px'
                            }}
                          >
                            {section.settings.customItems && section.settings.customItems.length > 0 ? (
                              section.settings.customItems.map(item => (
                                <div key={item.id} className="text-center mb-2" style={{ breakInside: 'avoid-column' }}>
                                  <div className="border-b border-gray-400 mb-1 h-8"></div>
                                  <div className="flex items-center justify-center gap-1 text-[7px]">
                                    {item.hasCheckbox && <span>☐</span>}
                                    <span className="font-bold">{item.text}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-[6px] text-gray-400">No signature fields. Add fields in settings.</div>
                            )}
                          </div>
                        )}
                        {section.type === 'customField' && (
                          <div className="flex items-center gap-2 text-[8px]" style={{ fontSize: `${section.settings.fontSize || 9}px` }}>
                            {section.settings.hasCheckbox && (
                              <div className="border border-gray-400" style={{ width: `${section.settings.checkboxSize || 10}px`, height: `${section.settings.checkboxSize || 10}px`, flexShrink: 0 }}></div>
                            )}
                            {section.settings.hasText && (
                              <div>{section.settings.fieldText || 'Field Label'}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Resize Handles - only show when section is selected */}
                      {selectedSection === section.id && !section.locked && (
                        <>
                          {/* Corner handles */}
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-nw-resize"
                            style={{ top: -2, left: -2 }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'nw')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-ne-resize"
                            style={{ top: -2, right: -2 }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'ne')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-sw-resize"
                            style={{ bottom: -2, left: -2 }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'sw')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-se-resize"
                            style={{ bottom: -2, right: -2 }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'se')}
                          />
                          
                          {/* Edge handles */}
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-n-resize"
                            style={{ top: -2, left: '50%', transform: 'translateX(-50%)' }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'n')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-s-resize"
                            style={{ bottom: -2, left: '50%', transform: 'translateX(-50%)' }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 's')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-w-resize"
                            style={{ top: '50%', left: -2, transform: 'translateY(-50%)' }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'w')}
                          />
                          <div
                            className="absolute w-3 h-3 bg-blue-500 border border-white cursor-e-resize"
                            style={{ top: '50%', right: -2, transform: 'translateY(-50%)' }}
                            onMouseDown={(e) => handleResizeMouseDown(e, section, 'e')}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                Select a template or create a new one to start editing
              </div>
            )}
          </div>
        </div>

        {/* Create Template Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Create a new damage check PDF template with default section layout
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Default Layout"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate}>Create Template</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Section Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSection ? `${SECTION_LABELS[editingSection.type]} Settings` : 'Section Settings'}
              </DialogTitle>
              <DialogDescription>
                Customize the appearance and content of this section
              </DialogDescription>
            </DialogHeader>
            {editingSection && (
              <div className="space-y-4 py-4">
                {/* Custom Label - Available for all sections */}
                <div>
                  <Label htmlFor="customLabel">Section Header</Label>
                  <Input
                    id="customLabel"
                    value={editingSection.settings.customLabel || ''}
                    onChange={(e) => setEditingSection({
                      ...editingSection,
                      settings: { ...editingSection.settings, customLabel: e.target.value }
                    })}
                    placeholder={SECTION_LABELS[editingSection.type]}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use default: "{SECTION_LABELS[editingSection.type]}"</p>
                </div>

                {/* Text Alignment - Available for most sections */}
                {editingSection.type !== 'diagram' && (
                  <div>
                    <Label>Text Alignment</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant={editingSection.settings.textAlign === 'left' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, textAlign: 'left' }
                        })}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editingSection.settings.textAlign === 'center' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, textAlign: 'center' }
                        })}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editingSection.settings.textAlign === 'right' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, textAlign: 'right' }
                        })}
                      >
                        <AlignRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Custom Items - Available for all sections */}
                {editingSection.type !== 'diagram' && editingSection.type !== 'customField' && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Custom Items</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const customItems = editingSection.settings.customItems || [];
                          setEditingSection({
                            ...editingSection,
                            settings: {
                              ...editingSection.settings,
                              customItems: [
                                ...customItems,
                                {
                                  id: `item-${Date.now()}`,
                                  text: 'New item',
                                  hasCheckbox: true
                                }
                              ]
                            }
                          });
                        }}
                        data-testid="button-add-custom-item"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Add custom text and checkboxes to this section</p>
                    
                    {(editingSection.settings.customItems || []).length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4 border border-dashed rounded">
                        No custom items. Click "Add Item" to add text or checkboxes.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(editingSection.settings.customItems || []).map((item, index) => (
                          <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                            <div className="flex items-center gap-2 flex-1">
                              <Switch
                                checked={item.hasCheckbox}
                                onCheckedChange={(checked) => {
                                  const customItems = [...(editingSection.settings.customItems || [])];
                                  customItems[index] = { ...item, hasCheckbox: checked };
                                  setEditingSection({
                                    ...editingSection,
                                    settings: { ...editingSection.settings, customItems }
                                  });
                                }}
                                title="Show checkbox"
                              />
                              <Input
                                value={item.text}
                                onChange={(e) => {
                                  const customItems = [...(editingSection.settings.customItems || [])];
                                  customItems[index] = { ...item, text: e.target.value };
                                  setEditingSection({
                                    ...editingSection,
                                    settings: { ...editingSection.settings, customItems }
                                  });
                                }}
                                placeholder="Item text"
                                className="flex-1"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600"
                              onClick={() => {
                                const customItems = (editingSection.settings.customItems || []).filter((_, i) => i !== index);
                                setEditingSection({
                                  ...editingSection,
                                  settings: { ...editingSection.settings, customItems }
                                });
                              }}
                              title="Delete item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Header Section Settings */}
                {editingSection.type === 'header' && (
                  <>
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={editingSection.settings.companyName || ''}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, companyName: e.target.value }
                        })}
                        placeholder="LAM GROUP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="headerFontSize">Font Size</Label>
                      <Input
                        id="headerFontSize"
                        type="number"
                        value={editingSection.settings.headerFontSize || 14}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, headerFontSize: parseInt(e.target.value) }
                        })}
                        min="8"
                        max="24"
                      />
                    </div>
                    <div>
                      <Label htmlFor="headerColor">Header Color</Label>
                      <Input
                        id="headerColor"
                        type="color"
                        value={editingSection.settings.headerColor || '#334d99'}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, headerColor: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Logo</Label>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                          type="button"
                        >
                          Upload Logo
                        </Button>
                        {editingSection.settings.logoPath && (
                          <span className="text-sm text-gray-600">Logo uploaded</span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Text Sections (contractInfo, vehicleData, remarks) */}
                {(editingSection.type === 'contractInfo' || 
                  editingSection.type === 'vehicleData' || 
                  editingSection.type === 'remarks' ||
                  editingSection.type === 'signatures') && (
                  <>
                    <div>
                      <Label htmlFor="fontSize">Font Size</Label>
                      <Input
                        id="fontSize"
                        type="number"
                        value={editingSection.settings.fontSize || 9}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, fontSize: parseInt(e.target.value) }
                        })}
                        min="6"
                        max="18"
                      />
                    </div>
                    <div>
                      <Label htmlFor="columnCount">Number of Columns</Label>
                      <Input
                        id="columnCount"
                        type="number"
                        value={editingSection.settings.columnCount || 1}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, columnCount: parseInt(e.target.value) }
                        })}
                        min="1"
                        max="4"
                      />
                      <p className="text-xs text-gray-500 mt-1">Arrange items in columns (1-4)</p>
                    </div>
                  </>
                )}

                {/* Checklist Section */}
                {editingSection.type === 'checklist' && (
                  <>
                    <div>
                      <Label htmlFor="checklistFontSize">Font Size</Label>
                      <Input
                        id="checklistFontSize"
                        type="number"
                        value={editingSection.settings.fontSize || 9}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, fontSize: parseInt(e.target.value) }
                        })}
                        min="6"
                        max="18"
                      />
                    </div>
                    <div>
                      <Label htmlFor="checkboxSize">Checkbox Size</Label>
                      <Input
                        id="checkboxSize"
                        type="number"
                        value={editingSection.settings.checkboxSize || 10}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, checkboxSize: parseInt(e.target.value) }
                        })}
                        min="6"
                        max="16"
                      />
                    </div>
                    <div>
                      <Label htmlFor="columnCount">Number of Columns</Label>
                      <Input
                        id="columnCount"
                        type="number"
                        value={editingSection.settings.columnCount || 3}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, columnCount: parseInt(e.target.value) }
                        })}
                        min="1"
                        max="4"
                      />
                      <p className="text-xs text-gray-500 mt-1">Arrange checklist items in columns (1-4)</p>
                    </div>
                  </>
                )}

                {/* Custom Field Section */}
                {editingSection.type === 'customField' && (
                  <>
                    <div>
                      <Label htmlFor="fieldText">Field Text</Label>
                      <Input
                        id="fieldText"
                        value={editingSection.settings.fieldText || ''}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, fieldText: e.target.value }
                        })}
                        placeholder="Field Label"
                      />
                      <p className="text-xs text-gray-500 mt-1">Text to display in the field</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hasCheckbox">Show Checkbox</Label>
                      <Switch
                        id="hasCheckbox"
                        checked={editingSection.settings.hasCheckbox !== false}
                        onCheckedChange={(checked) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, hasCheckbox: checked }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hasText">Show Text</Label>
                      <Switch
                        id="hasText"
                        checked={editingSection.settings.hasText !== false}
                        onCheckedChange={(checked) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, hasText: checked }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="customFieldFontSize">Font Size</Label>
                      <Input
                        id="customFieldFontSize"
                        type="number"
                        value={editingSection.settings.fontSize || 9}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, fontSize: parseInt(e.target.value) }
                        })}
                        min="6"
                        max="18"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customFieldCheckboxSize">Checkbox Size</Label>
                      <Input
                        id="customFieldCheckboxSize"
                        type="number"
                        value={editingSection.settings.checkboxSize || 10}
                        onChange={(e) => setEditingSection({
                          ...editingSection,
                          settings: { ...editingSection.settings, checkboxSize: parseInt(e.target.value) }
                        })}
                        min="6"
                        max="16"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsSettingsDialogOpen(false);
                setEditingSection(null);
              }}>
                Cancel
              </Button>
              <Button onClick={() => editingSection && updateSectionSettings(editingSection.settings)}>
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Checklist Content Template Editor Section - Collapsible */}
        <div className="mt-8 pt-6 border-t">
          <div 
            className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
            onClick={() => setChecklistExpanded(!checklistExpanded)}
          >
            <div className="flex items-center gap-3">
              {checklistExpanded ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Damage Check Checklist Content</h3>
                {!checklistExpanded && currentChecklistTemplate && (
                  <p className="text-sm text-gray-600">
                    {currentChecklistTemplate.name} • {currentChecklistTemplate.inspectionPoints?.length || 0} items
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportChecklistTemplate}
                disabled={!currentChecklistTemplate}
                data-testid="button-export-checklist-template"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checklistInputRef.current?.click()}
                data-testid="button-import-checklist-template"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!currentChecklistTemplate) return;
                  saveChecklistTemplateMutation.mutate(currentChecklistTemplate);
                }}
                disabled={!currentChecklistTemplate || saveChecklistTemplateMutation.isPending}
                data-testid="button-save-checklist"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveChecklistTemplateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {checklistExpanded && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              {currentChecklistTemplate ? (
                <>
                  {/* Template info */}
                  <div className="bg-gray-50 p-3 rounded-md flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{currentChecklistTemplate.name}</div>
                      <div className="text-sm text-gray-600">
                        {currentChecklistTemplate.inspectionPoints?.length || 0} inspection points
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingPoint(null);
                        setPointEditorOpen(true);
                      }}
                      data-testid="button-add-inspection-point"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Point
                    </Button>
                  </div>

                  {/* Inspection points grid */}
                  {currentChecklistTemplate.inspectionPoints && currentChecklistTemplate.inspectionPoints.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
                      {currentChecklistTemplate.inspectionPoints.map((point: any, index: number) => (
                        <div
                          key={point.id || index}
                          className="border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer bg-white relative group"
                          onClick={() => {
                            setEditingPoint(point);
                            setPointEditorOpen(true);
                          }}
                          data-testid={`card-inspection-point-${index}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <span className="font-medium text-sm line-clamp-2 pr-2">{point.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentChecklistTemplate({
                                    ...currentChecklistTemplate,
                                    inspectionPoints: currentChecklistTemplate.inspectionPoints.filter((p: any) => p.id !== point.id)
                                  });
                                }}
                                data-testid={`button-delete-point-${index}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 capitalize">
                                {point.category}
                              </span>
                              {point.required && (
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                                  Required
                                </span>
                              )}
                            </div>
                            {point.damageTypes && point.damageTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {point.damageTypes.slice(0, 4).map((type: string) => (
                                  <span key={type} className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                                    {type}
                                  </span>
                                ))}
                                {point.damageTypes.length > 4 && (
                                  <span className="text-xs px-1.5 py-0.5 text-gray-500">
                                    +{point.damageTypes.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                            {point.description && (
                              <p className="text-xs text-gray-500 line-clamp-2">{point.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                      <p>No inspection points yet</p>
                      <p className="text-xs mt-1">Click "Add Point" to create your first check point</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                  <p>No checklist template available</p>
                  <p className="text-xs mt-1">Import a checklist template to get started</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inspection Point Editor Dialog */}
        <InspectionPointEditor
          open={pointEditorOpen}
          onOpenChange={setPointEditorOpen}
          point={editingPoint}
          onSave={(point: any) => {
            if (!currentChecklistTemplate) return;
            
            if (editingPoint) {
              // Update existing point
              setCurrentChecklistTemplate({
                ...currentChecklistTemplate,
                inspectionPoints: currentChecklistTemplate.inspectionPoints.map((p: any) => 
                  p.id === point.id ? point : p
                )
              });
            } else {
              // Add new point
              setCurrentChecklistTemplate({
                ...currentChecklistTemplate,
                inspectionPoints: [...(currentChecklistTemplate.inspectionPoints || []), point]
              });
            }
            setPointEditorOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}

// Inspection Point Editor Component
const INSPECTION_CATEGORIES = [
  { value: 'interieur', label: 'Interieur' },
  { value: 'exterieur', label: 'Exterieur' },
  { value: 'afweez_check', label: 'Afweez Check' },
  { value: 'documents', label: 'Documents' },
];

const DAMAGE_TYPES = [
  { value: 'kapot', label: 'Kapot' },
  { value: 'gat', label: 'Gat' },
  { value: 'kras', label: 'Kras' },
  { value: 'deuk', label: 'Deuk' },
  { value: 'ster', label: 'Ster' },
  { value: 'beschadigd', label: 'Beschadigd' },
  { value: 'vuil', label: 'Vuil' },
  { value: 'ontbreekt', label: 'Ontbreekt' },
];

function InspectionPointEditor({
  open,
  onOpenChange,
  point,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: any | null;
  onSave: (point: any) => void;
}) {
  const [name, setName] = useState(point?.name || "");
  const [category, setCategory] = useState(point?.category || "exterieur");
  const [description, setDescription] = useState(point?.description || "");
  const [required, setRequired] = useState(point?.required || false);
  const [selectedDamageTypes, setSelectedDamageTypes] = useState<string[]>(
    point?.damageTypes || ["kras", "deuk"]
  );

  useEffect(() => {
    if (point) {
      setName(point.name);
      setCategory(point.category);
      setDescription(point.description || "");
      setRequired(point.required);
      setSelectedDamageTypes(point.damageTypes || ["kras", "deuk"]);
    } else {
      setName("");
      setCategory("exterieur");
      setDescription("");
      setRequired(false);
      setSelectedDamageTypes(["kras", "deuk"]);
    }
  }, [point]);

  const handleSave = () => {
    if (!name.trim()) return;

    const newPoint = {
      id: point?.id || `point-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim(),
      required,
      damageTypes: selectedDamageTypes,
    };

    onSave(newPoint);
    onOpenChange(false);
  };

  const toggleDamageType = (type: string) => {
    setSelectedDamageTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{point ? "Edit Inspection Point" : "Add Inspection Point"}</DialogTitle>
          <DialogDescription>
            Define a new item to check during vehicle inspection
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="pointName">Point Name *</Label>
            <Input
              id="pointName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Voorruit"
            />
          </div>
          <div>
            <Label htmlFor="pointCategory">Category *</Label>
            <select
              id="pointCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2"
            >
              {INSPECTION_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pointDescription">Description (Optional)</Label>
            <Input
              id="pointDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} id="pointRequired" />
            <Label htmlFor="pointRequired">Required field</Label>
          </div>
          <div>
            <Label>Damage Types</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DAMAGE_TYPES.map(type => (
                <div key={type.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`damage-${type.value}`}
                    checked={selectedDamageTypes.includes(type.value)}
                    onChange={() => toggleDamageType(type.value)}
                    className="rounded"
                  />
                  <Label htmlFor={`damage-${type.value}`} className="cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {point ? "Update" : "Add"} Point
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

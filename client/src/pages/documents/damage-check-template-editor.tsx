import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ZoomIn, ZoomOut, Grid, Move, Save, Plus, Trash2,
  Lock, Unlock, Eye, EyeOff, Settings2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  type: 'header' | 'contractInfo' | 'vehicleData' | 'checklist' | 'diagram' | 'remarks' | 'signatures';
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
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: templates = [] } = useQuery<PdfTemplate[]>({
    queryKey: ['/api/damage-check-pdf-templates'],
  });

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
    setDraggedSection(null);
    setDragOffset(null);
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

  const getSectionColor = (type: string) => {
    const colors: Record<string, string> = {
      header: '#334d99',
      contractInfo: '#10b981',
      vehicleData: '#f59e0b',
      checklist: '#3b82f6',
      diagram: '#8b5cf6',
      remarks: '#ec4899',
      signatures: '#06b6d4',
    };
    return colors[type] || '#6b7280';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Damage Check PDF Template Editor</CardTitle>
          <div className="flex gap-2">
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
                  <Label className="text-sm font-semibold">Sections</Label>
                  {currentTemplate.sections.map(section => (
                    <div
                      key={section.id}
                      className={`p-2 rounded border ${selectedSection === section.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                      style={{ borderLeftWidth: 4, borderLeftColor: getSectionColor(section.type) }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{SECTION_LABELS[section.type]}</span>
                        <div className="flex gap-1">
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
                  onMouseMove={handleMouseMove}
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
                        <span>{SECTION_LABELS[section.type]}</span>
                        {isMoving && !section.locked && <Move className="w-3 h-3" />}
                      </div>
                      
                      {/* Section Content Preview */}
                      <div className="p-2 pt-8 text-xs text-gray-600">
                        {section.type === 'header' && (
                          <div className="font-bold">{section.settings.companyName || 'Company Name'}</div>
                        )}
                        {section.type === 'contractInfo' && (
                          <div>Contract #12345 | Date: 21-10-2025 | Customer: Jan de Vries</div>
                        )}
                        {section.type === 'vehicleData' && (
                          <div>Kenteken: AB-123-CD | Merk: Mercedes | Model: E-Klasse</div>
                        )}
                        {section.type === 'checklist' && (
                          <div>
                            <div>☐ Interieur: Binnenzijde auto schoon</div>
                            <div>☐ Exterieur: Buitenzijde auto schoon</div>
                            <div>☐ Aflever Check: Olie - water</div>
                          </div>
                        )}
                        {section.type === 'diagram' && (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            [Vehicle Diagram]
                          </div>
                        )}
                        {section.type === 'remarks' && (
                          <div className="italic">Remarks and notes...</div>
                        )}
                        {section.type === 'signatures' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>Customer Signature: _______</div>
                            <div>Staff Signature: _______</div>
                          </div>
                        )}
                      </div>
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
      </CardContent>
    </Card>
  );
}

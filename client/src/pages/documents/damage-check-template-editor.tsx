import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ZoomIn, ZoomOut, Grid, Move, Save, Plus, Trash2, Edit, ChevronDown, ChevronUp,
  Lock, Unlock, Eye, EyeOff, Settings2, AlignLeft, AlignCenter, AlignRight, FileDown, Check, Upload, Download,
  Undo2, Redo2, Copy, Clipboard, ClipboardPaste, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Magnet, Ruler, LayoutGrid, Table2, Image, QrCode, Barcode, Tag, History, Palette, LayoutTemplate,
  GripVertical, RotateCcw, FileText, BookOpen, Layers, ChevronRight, Car, RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DamageCheckTemplate, TemplateSection, TemplateSectionStyle } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PdfTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  sections: TemplateSection[];
  pageMargins: number;
  pageOrientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'A5' | 'custom';
  customPageWidth?: number;
  customPageHeight?: number;
  pageCount?: number;
  tags?: string[];
  category?: string;
  themeId?: number;
  backgroundImage?: string;
  usageCount?: number;
  lastUsedAt?: string;
}

interface TemplateVersion {
  id: number;
  templateId: number;
  version: number;
  name: string;
  sections: TemplateSection[];
  settings: Record<string, any>;
  createdAt: string;
  createdBy: string;
}

interface TemplateTheme {
  id: number;
  name: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    border: string;
  };
  isDefault: boolean;
}

interface SectionPreset {
  id: number;
  name: string;
  description: string;
  type: string;
  config: TemplateSection;
  category: string;
  isBuiltIn: boolean;
}

interface HistoryEntry {
  sections: TemplateSection[];
  timestamp: number;
  action: string;
}

const DEFAULT_SECTION_STYLE: TemplateSectionStyle = {
  fontSize: 9,
  fontFamily: 'Helvetica',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textColor: '#000000',
  backgroundColor: 'transparent',
  textAlign: 'left',
  borderWidth: 1,
  borderColor: '#cccccc',
  borderStyle: 'solid',
  padding: 4,
  rotation: 0,
  opacity: 1,
};

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  Letter: { width: 612, height: 792 },
  A5: { width: 420, height: 595 },
};

const TEXT_VARIABLES = [
  { key: '{{today}}', label: 'Today\'s Date', sample: new Date().toLocaleDateString('nl-NL') },
  { key: '{{vehicleName}}', label: 'Vehicle Name', sample: 'Mercedes E-Klasse' },
  { key: '{{licensePlate}}', label: 'License Plate', sample: 'AB-123-CD' },
  { key: '{{customerName}}', label: 'Customer Name', sample: 'Jan de Vries' },
  { key: '{{customerPhone}}', label: 'Customer Phone', sample: '+31 6 12345678' },
  { key: '{{contractNumber}}', label: 'Contract Number', sample: 'REN-2025-001' },
  { key: '{{pickupDate}}', label: 'Pickup Date', sample: '22-10-2025' },
  { key: '{{returnDate}}', label: 'Return Date', sample: '29-10-2025' },
  { key: '{{mileage}}', label: 'Mileage', sample: '45.320 km' },
  { key: '{{fuelLevel}}', label: 'Fuel Level', sample: '3/4 tank' },
];

const createDefaultSections = (): TemplateSection[] => [
  {
    id: 'header',
    type: 'header',
    x: 15,
    y: 15,
    width: 565,
    height: 40,
    visible: true,
    page: 1,
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
    page: 1,
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
    page: 1,
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
    page: 1,
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
    page: 1,
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
    page: 1,
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
    page: 1,
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
  table: 'Table',
  image: 'Image',
  qrCode: 'QR Code',
  barcode: 'Barcode',
};

const SECTION_ICONS: Record<string, any> = {
  header: FileText,
  contractInfo: BookOpen,
  vehicleData: FileText,
  checklist: Check,
  diagram: Image,
  remarks: FileText,
  signatures: Edit,
  customField: FileText,
  table: Table2,
  image: Image,
  qrCode: QrCode,
  barcode: Barcode,
};

export default function DamageCheckTemplateEditor() {
  const { toast } = useToast();
  const [currentTemplate, setCurrentTemplate] = useState<PdfTemplate | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [draggedSection, setDraggedSection] = useState<TemplateSection | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showPrintMargins, setShowPrintMargins] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToEdges, setSnapToEdges] = useState(true);
  const [isMoving, setIsMoving] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [resizingSection, setResizingSection] = useState<{section: TemplateSection, handle: string} | null>(null);
  const [resizeStart, setResizeStart] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedSection, setCopiedSection] = useState<TemplateSection | null>(null);
  
  // Undo/Redo state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);
  
  // Version dialog state
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  
  // Theme dialog state
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  
  // Page settings dialog
  const [isPageSettingsDialogOpen, setIsPageSettingsDialogOpen] = useState(false);
  
  // Tags dialog
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  // Section presets panel
  const [showPresetsPanel, setShowPresetsPanel] = useState(false);
  
  // Conditional section dialog
  const [isConditionDialogOpen, setIsConditionDialogOpen] = useState(false);
  
  // Advanced styling panel
  const [showAdvancedStyling, setShowAdvancedStyling] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Checklist template editing state
  const [currentChecklistTemplate, setCurrentChecklistTemplate] = useState<DamageCheckTemplate | null>(null);
  const [editingPoint, setEditingPoint] = useState<any | null>(null);
  const [pointEditorOpen, setPointEditorOpen] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  // Query for templates
  const { data: templates = [] } = useQuery<PdfTemplate[]>({
    queryKey: ['/api/damage-check-pdf-templates'],
  });

  // Query for damage check templates (for checklist content)
  const { data: damageCheckTemplates = [] } = useQuery<DamageCheckTemplate[]>({
    queryKey: ['/api/damage-check-templates'],
  });
  
  // Query for themes
  const { data: themes = [] } = useQuery<TemplateTheme[]>({
    queryKey: ['/api/damage-check-pdf-template-themes'],
  });
  
  // Query for section presets
  const { data: sectionPresets = [] } = useQuery<SectionPreset[]>({
    queryKey: ['/api/damage-check-pdf-section-presets'],
  });
  
  // Query for versions (only when template is selected)
  const { data: versions = [] } = useQuery<TemplateVersion[]>({
    queryKey: ['/api/damage-check-pdf-templates', currentTemplate?.id, 'versions'],
    enabled: !!currentTemplate?.id,
  });

  // Update current template when templates refetch
  useEffect(() => {
    if (currentTemplate && templates.length > 0) {
      const updatedTemplate = templates.find(t => t.id === currentTemplate.id);
      if (updatedTemplate) {
        setCurrentTemplate(updatedTemplate);
      }
    } else if (!currentTemplate && templates.length > 0) {
      setCurrentTemplate(templates[0]);
    }
  }, [templates]);

  // Auto-select first checklist template
  useEffect(() => {
    if (damageCheckTemplates.length > 0 && !currentChecklistTemplate) {
      setCurrentChecklistTemplate(damageCheckTemplates[0]);
    }
  }, [damageCheckTemplates]);

  // Initialize history when template changes
  useEffect(() => {
    if (currentTemplate && !isUndoRedo) {
      setHistory([{ sections: currentTemplate.sections, timestamp: Date.now(), action: 'Initial' }]);
      setHistoryIndex(0);
    }
  }, [currentTemplate?.id]);
  
  // Add to history when sections change (but not during undo/redo)
  const addToHistory = useCallback((sections: TemplateSection[], action: string) => {
    if (isUndoRedo) return;
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ sections: JSON.parse(JSON.stringify(sections)), timestamp: Date.now(), action });
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, isUndoRedo]);
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !currentTemplate) return;
    
    setIsUndoRedo(true);
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setCurrentTemplate({
      ...currentTemplate,
      sections: JSON.parse(JSON.stringify(history[newIndex].sections))
    });
    setTimeout(() => setIsUndoRedo(false), 100);
  }, [historyIndex, history, currentTemplate]);
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !currentTemplate) return;
    
    setIsUndoRedo(true);
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setCurrentTemplate({
      ...currentTemplate,
      sections: JSON.parse(JSON.stringify(history[newIndex].sections))
    });
    setTimeout(() => setIsUndoRedo(false), 100);
  }, [historyIndex, history, currentTemplate]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'c' && selectedSection) {
          e.preventDefault();
          handleCopySection();
        } else if (e.key === 'v' && copiedSection) {
          e.preventDefault();
          handlePasteSection();
        } else if (e.key === 's') {
          e.preventDefault();
          if (currentTemplate) {
            saveTemplateMutation.mutate(currentTemplate);
          }
        }
      }
      
      if (e.key === 'Delete' && selectedSection && currentTemplate) {
        const section = currentTemplate.sections.find(s => s.id === selectedSection);
        if (section?.type === 'customField' || section?.type === 'table' || section?.type === 'image' || section?.type === 'qrCode' || section?.type === 'barcode') {
          e.preventDefault();
          handleDeleteSection(selectedSection);
        }
      }
      
      // Arrow keys for nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedSection && currentTemplate) {
        e.preventDefault();
        const section = currentTemplate.sections.find(s => s.id === selectedSection);
        if (section && !section.locked) {
          const delta = e.shiftKey ? 10 : 1;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = -delta;
          if (e.key === 'ArrowDown') dy = delta;
          if (e.key === 'ArrowLeft') dx = -delta;
          if (e.key === 'ArrowRight') dx = delta;
          
          const newX = Math.max(0, Math.min(section.x + dx, getPageWidth() - section.width));
          const newY = Math.max(0, Math.min(section.y + dy, getPageHeight() - section.height));
          
          const updatedSections = currentTemplate.sections.map(s =>
            s.id === selectedSection ? { ...s, x: newX, y: newY } : s
          );
          setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedSection, copiedSection, currentTemplate]);
  
  const getPageWidth = useCallback(() => {
    if (!currentTemplate) return 595;
    if (currentTemplate.pageSize === 'custom' && currentTemplate.customPageWidth) {
      return currentTemplate.customPageWidth;
    }
    const size = PAGE_SIZES[currentTemplate.pageSize || 'A4'];
    return currentTemplate.pageOrientation === 'landscape' ? size.height : size.width;
  }, [currentTemplate]);
  
  const getPageHeight = useCallback(() => {
    if (!currentTemplate) return 842;
    if (currentTemplate.pageSize === 'custom' && currentTemplate.customPageHeight) {
      return currentTemplate.customPageHeight;
    }
    const size = PAGE_SIZES[currentTemplate.pageSize || 'A4'];
    return currentTemplate.pageOrientation === 'landscape' ? size.width : size.height;
  }, [currentTemplate]);

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
  
  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return await apiRequest('POST', `/api/damage-check-pdf-templates/${id}/duplicate`, { name });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      toast({ title: "Success", description: "Template duplicated" });
      setIsDuplicateDialogOpen(false);
      setDuplicateName('');
    },
  });
  
  const createVersionMutation = useMutation({
    mutationFn: async ({ templateId, name, sections, settings }: { templateId: number; name: string; sections: TemplateSection[]; settings: Record<string, any> }) => {
      return await apiRequest('POST', `/api/damage-check-pdf-templates/${templateId}/versions`, { name, sections, settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates', currentTemplate?.id, 'versions'] });
      toast({ title: "Success", description: "Version saved" });
    },
  });
  
  const restoreVersionMutation = useMutation({
    mutationFn: async ({ templateId, versionId }: { templateId: number; versionId: number }) => {
      return await apiRequest('POST', `/api/damage-check-pdf-templates/${templateId}/restore/${versionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      toast({ title: "Success", description: "Template restored from version" });
      setIsVersionDialogOpen(false);
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
      pageOrientation: 'portrait',
      pageSize: 'A4',
      pageCount: 1,
    };

    saveTemplateMutation.mutate(newTemplate);
    setNewTemplateName('');
    setIsCreateDialogOpen(false);
  };
  
  const handleDuplicateTemplate = () => {
    if (!currentTemplate?.id || !duplicateName) return;
    duplicateTemplateMutation.mutate({ id: currentTemplate.id, name: duplicateName });
  };
  
  const handleSaveVersion = () => {
    if (!currentTemplate?.id) return;
    const versionName = `Version ${new Date().toLocaleString()}`;
    createVersionMutation.mutate({
      templateId: currentTemplate.id,
      name: versionName,
      sections: currentTemplate.sections,
      settings: {
        pageMargins: currentTemplate.pageMargins,
        pageOrientation: currentTemplate.pageOrientation,
        pageSize: currentTemplate.pageSize,
      }
    });
  };
  
  const handleCopySection = () => {
    if (!selectedSection || !currentTemplate) return;
    const section = currentTemplate.sections.find(s => s.id === selectedSection);
    if (section) {
      setCopiedSection(JSON.parse(JSON.stringify(section)));
      toast({ title: "Copied", description: "Section copied to clipboard" });
    }
  };
  
  const handlePasteSection = () => {
    if (!copiedSection || !currentTemplate) return;
    
    const newSection: TemplateSection = {
      ...JSON.parse(JSON.stringify(copiedSection)),
      id: `${copiedSection.type}-${Date.now()}`,
      x: copiedSection.x + 20,
      y: copiedSection.y + 20,
    };
    
    const updatedSections = [...currentTemplate.sections, newSection];
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    addToHistory(updatedSections, 'Paste section');
    setSelectedSection(newSection.id);
    toast({ title: "Pasted", description: "Section pasted" });
  };
  
  const handleDeleteSection = (sectionId: string) => {
    if (!currentTemplate) return;
    const updatedSections = currentTemplate.sections.filter(s => s.id !== sectionId);
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    addToHistory(updatedSections, 'Delete section');
    setSelectedSection(null);
    toast({ title: "Deleted", description: "Section removed" });
  };
  
  // Alignment functions
  const alignSections = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
    if (!currentTemplate || selectedSections.length < 2) {
      toast({ title: "Select multiple", description: "Select at least 2 sections to align", variant: "destructive" });
      return;
    }
    
    const sections = currentTemplate.sections.filter(s => selectedSections.includes(s.id));
    let updatedSections = [...currentTemplate.sections];
    
    switch (alignment) {
      case 'left': {
        const minX = Math.min(...sections.map(s => s.x));
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, x: minX } : s
        );
        break;
      }
      case 'center': {
        const centerX = sections.reduce((sum, s) => sum + s.x + s.width / 2, 0) / sections.length;
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, x: centerX - s.width / 2 } : s
        );
        break;
      }
      case 'right': {
        const maxRight = Math.max(...sections.map(s => s.x + s.width));
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, x: maxRight - s.width } : s
        );
        break;
      }
      case 'top': {
        const minY = Math.min(...sections.map(s => s.y));
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, y: minY } : s
        );
        break;
      }
      case 'middle': {
        const centerY = sections.reduce((sum, s) => sum + s.y + s.height / 2, 0) / sections.length;
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, y: centerY - s.height / 2 } : s
        );
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...sections.map(s => s.y + s.height));
        updatedSections = updatedSections.map(s => 
          selectedSections.includes(s.id) ? { ...s, y: maxBottom - s.height } : s
        );
        break;
      }
      case 'distribute-h': {
        const sorted = [...sections].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((sum, s) => sum + s.width, 0);
        const spacing = (getPageWidth() - totalWidth) / (sorted.length + 1);
        let currentX = spacing;
        sorted.forEach(s => {
          updatedSections = updatedSections.map(sec => 
            sec.id === s.id ? { ...sec, x: currentX } : sec
          );
          currentX += s.width + spacing;
        });
        break;
      }
      case 'distribute-v': {
        const sorted = [...sections].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((sum, s) => sum + s.height, 0);
        const spacing = (getPageHeight() - totalHeight) / (sorted.length + 1);
        let currentY = spacing;
        sorted.forEach(s => {
          updatedSections = updatedSections.map(sec => 
            sec.id === s.id ? { ...sec, y: currentY } : sec
          );
          currentY += s.height + spacing;
        });
        break;
      }
    }
    
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    addToHistory(updatedSections, `Align ${alignment}`);
  };

  // Snap to edges logic
  const findSnapPosition = (section: TemplateSection, newX: number, newY: number): { x: number; y: number } => {
    if (!snapToEdges || !currentTemplate) return { x: newX, y: newY };
    
    const SNAP_THRESHOLD = 10;
    let snapX = newX;
    let snapY = newY;
    
    const otherSections = currentTemplate.sections.filter(s => s.id !== section.id && s.visible);
    
    for (const other of otherSections) {
      // Left edge alignment
      if (Math.abs(newX - other.x) < SNAP_THRESHOLD) snapX = other.x;
      if (Math.abs(newX - (other.x + other.width)) < SNAP_THRESHOLD) snapX = other.x + other.width;
      
      // Right edge alignment  
      if (Math.abs((newX + section.width) - other.x) < SNAP_THRESHOLD) snapX = other.x - section.width;
      if (Math.abs((newX + section.width) - (other.x + other.width)) < SNAP_THRESHOLD) snapX = other.x + other.width - section.width;
      
      // Top edge alignment
      if (Math.abs(newY - other.y) < SNAP_THRESHOLD) snapY = other.y;
      if (Math.abs(newY - (other.y + other.height)) < SNAP_THRESHOLD) snapY = other.y + other.height;
      
      // Bottom edge alignment
      if (Math.abs((newY + section.height) - other.y) < SNAP_THRESHOLD) snapY = other.y - section.height;
      if (Math.abs((newY + section.height) - (other.y + other.height)) < SNAP_THRESHOLD) snapY = other.y + other.height - section.height;
    }
    
    // Snap to grid
    if (snapToGrid) {
      const gridSize = 10;
      snapX = Math.round(snapX / gridSize) * gridSize;
      snapY = Math.round(snapY / gridSize) * gridSize;
    }
    
    return { x: snapX, y: snapY };
  };

  const handleMouseDown = (e: React.MouseEvent, section: TemplateSection) => {
    if (section.locked || !isMoving || !currentTemplate || !canvasRef.current) return;
    e.preventDefault();
    
    // Multi-select with Shift key
    if (e.shiftKey) {
      setSelectedSections(prev => 
        prev.includes(section.id) 
          ? prev.filter(id => id !== section.id)
          : [...prev, section.id]
      );
    } else {
      setSelectedSection(section.id);
      if (!selectedSections.includes(section.id)) {
        setSelectedSections([section.id]);
      }
    }
    
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
    let x = (e.clientX - canvasRect.left) / zoomLevel - dragOffset.x;
    let y = (e.clientY - canvasRect.top) / zoomLevel - dragOffset.y;
    
    // Apply snapping
    const snapped = findSnapPosition(draggedSection, x, y);
    x = snapped.x;
    y = snapped.y;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(0, Math.min(x, getPageWidth() - draggedSection.width));
    const constrainedY = Math.max(0, Math.min(y, getPageHeight() - draggedSection.height));
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === draggedSection.id ? { ...s, x: constrainedX, y: constrainedY } : s
    );
    
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    setDraggedSection({ ...draggedSection, x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    if (draggedSection && currentTemplate) {
      addToHistory(currentTemplate.sections, 'Move section');
      saveTemplateMutation.mutate(currentTemplate);
    }
    if (resizingSection && currentTemplate) {
      addToHistory(currentTemplate.sections, 'Resize section');
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
    
    if (handle.includes('e')) newWidth = Math.max(50, mouseX - section.x);
    if (handle.includes('s')) newHeight = Math.max(30, mouseY - section.y);
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
    
    // Constrain to canvas
    newX = Math.max(0, Math.min(newX, getPageWidth() - newWidth));
    newY = Math.max(0, Math.min(newY, getPageHeight() - newHeight));
    newWidth = Math.min(newWidth, getPageWidth() - newX);
    newHeight = Math.min(newHeight, getPageHeight() - newY);
    
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
    addToHistory(updatedSections, 'Toggle visibility');
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
    setEditingSection(JSON.parse(JSON.stringify(section)));
    setIsSettingsDialogOpen(true);
  };

  const updateSectionSettings = (settings: any) => {
    if (!currentTemplate || !editingSection) return;
    
    const updatedSections = currentTemplate.sections.map(s =>
      s.id === editingSection.id ? { ...s, settings: { ...s.settings, ...settings }, style: editingSection.style, condition: editingSection.condition } : s
    );
    
    const updated = { ...currentTemplate, sections: updatedSections };
    setCurrentTemplate(updated);
    addToHistory(updatedSections, 'Update settings');
    saveTemplateMutation.mutate(updated);
    setIsSettingsDialogOpen(false);
    setEditingSection(null);
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
      table: '#6366f1',
      image: '#a855f7',
      qrCode: '#0ea5e9',
      barcode: '#84cc16',
    };
    return colors[type] || '#6b7280';
  };

  const addSection = (type: TemplateSection['type']) => {
    if (!currentTemplate) return;
    
    const baseConfig: Partial<TemplateSection> = {
      id: `${type}-${Date.now()}`,
      type,
      x: 30,
      y: 400,
      visible: true,
      locked: false,
      page: currentPage,
    };
    
    let newSection: TemplateSection;
    
    switch (type) {
      case 'customField':
        newSection = {
          ...baseConfig,
          width: 200,
          height: 30,
          settings: {
            customLabel: 'New Field',
            fieldText: 'Field Label',
            hasCheckbox: true,
            hasText: true,
            fontSize: 9,
          }
        } as TemplateSection;
        break;
      case 'table':
        newSection = {
          ...baseConfig,
          width: 300,
          height: 150,
          settings: {
            customLabel: 'Table',
            tableRows: 4,
            tableCols: 3,
            tableData: [['Header 1', 'Header 2', 'Header 3'], ['', '', ''], ['', '', ''], ['', '', '']],
            fontSize: 9,
          }
        } as TemplateSection;
        break;
      case 'image':
        newSection = {
          ...baseConfig,
          width: 150,
          height: 100,
          settings: {
            customLabel: 'Image',
            imageUrl: '',
          }
        } as TemplateSection;
        break;
      case 'qrCode':
        newSection = {
          ...baseConfig,
          width: 80,
          height: 80,
          settings: {
            customLabel: 'QR Code',
            qrCodeValue: '{{contractNumber}}',
          }
        } as TemplateSection;
        break;
      case 'barcode':
        newSection = {
          ...baseConfig,
          width: 150,
          height: 50,
          settings: {
            customLabel: 'Barcode',
            barcodeValue: '{{contractNumber}}',
          }
        } as TemplateSection;
        break;
      default:
        newSection = {
          ...baseConfig,
          width: 200,
          height: 60,
          settings: { customLabel: 'New Section', fontSize: 9 }
        } as TemplateSection;
    }
    
    const updatedSections = [...currentTemplate.sections, newSection];
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    addToHistory(updatedSections, `Add ${type}`);
    setSelectedSection(newSection.id);
    toast({ title: "Added", description: `${SECTION_LABELS[type]} added to template` });
  };
  
  const addPresetSection = (preset: SectionPreset) => {
    if (!currentTemplate) return;
    
    const newSection: TemplateSection = {
      ...JSON.parse(JSON.stringify(preset.config)),
      id: `${preset.type}-${Date.now()}`,
      x: 30,
      y: 400,
      page: currentPage,
    };
    
    const updatedSections = [...currentTemplate.sections, newSection];
    setCurrentTemplate({ ...currentTemplate, sections: updatedSections });
    addToHistory(updatedSections, `Add preset: ${preset.name}`);
    setSelectedSection(newSection.id);
    toast({ title: "Added", description: `${preset.name} added to template` });
  };
  
  const handleAddTag = () => {
    if (!currentTemplate || !newTag.trim()) return;
    
    const updatedTags = [...(currentTemplate.tags || []), newTag.trim()];
    const updated = { ...currentTemplate, tags: updatedTags };
    setCurrentTemplate(updated);
    saveTemplateMutation.mutate(updated);
    setNewTag('');
  };
  
  const handleRemoveTag = (tag: string) => {
    if (!currentTemplate) return;
    
    const updatedTags = (currentTemplate.tags || []).filter(t => t !== tag);
    const updated = { ...currentTemplate, tags: updatedTags };
    setCurrentTemplate(updated);
    saveTemplateMutation.mutate(updated);
  };
  
  const addPage = () => {
    if (!currentTemplate) return;
    const newPageCount = (currentTemplate.pageCount || 1) + 1;
    const updated = { ...currentTemplate, pageCount: newPageCount };
    setCurrentTemplate(updated);
    setCurrentPage(newPageCount);
    saveTemplateMutation.mutate(updated);
    toast({ title: "Page Added", description: `Page ${newPageCount} added` });
  };
  
  const removePage = (pageNum: number) => {
    if (!currentTemplate || (currentTemplate.pageCount || 1) <= 1) return;
    
    const updatedSections = currentTemplate.sections.filter(s => (s.page || 1) !== pageNum);
    const reindexedSections = updatedSections.map(s => ({
      ...s,
      page: (s.page || 1) > pageNum ? (s.page || 1) - 1 : (s.page || 1)
    }));
    
    const newPageCount = (currentTemplate.pageCount || 1) - 1;
    const updated = { ...currentTemplate, sections: reindexedSections, pageCount: newPageCount };
    setCurrentTemplate(updated);
    setCurrentPage(Math.min(currentPage, newPageCount));
    addToHistory(reindexedSections, 'Remove page');
    saveTemplateMutation.mutate(updated);
    toast({ title: "Page Removed", description: `Page ${pageNum} removed` });
  };

  const handleExportTemplate = async () => {
    if (!currentTemplate?.id) {
      toast({ title: "Error", description: "Please save the template first", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/damage-check-pdf-templates/${currentTemplate.id}/export`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to export template');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${currentTemplate.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Template exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export template", variant: "destructive" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const templateData = JSON.parse(text);
      await apiRequest('POST', '/api/damage-check-pdf-templates/import', templateData);
      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
      toast({ title: "Success", description: "PDF template layout imported successfully" });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to import template", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTemplate) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'template-background');

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      
      const updated = { ...currentTemplate, backgroundImage: data.filePath };
      setCurrentTemplate(updated);
      saveTemplateMutation.mutate(updated);
      toast({ title: "Success", description: "Background image uploaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload background", variant: "destructive" });
    }
  };

  const renderRulers = () => {
    if (!showRulers) return null;
    
    const rulerSize = 20;
    const pageW = getPageWidth();
    const pageH = getPageHeight();
    
    return (
      <>
        {/* Horizontal ruler */}
        <div 
          className="absolute bg-gray-100 border-b border-gray-300 flex items-end"
          style={{ 
            top: -rulerSize * zoomLevel, 
            left: 0, 
            width: pageW * zoomLevel, 
            height: rulerSize * zoomLevel 
          }}
        >
          {Array.from({ length: Math.ceil(pageW / 50) }).map((_, i) => (
            <div 
              key={i} 
              className="relative border-r border-gray-300" 
              style={{ width: 50 * zoomLevel, height: '100%' }}
            >
              <span className="absolute bottom-0 left-1 text-[8px] text-gray-600">{i * 50}</span>
            </div>
          ))}
        </div>
        
        {/* Vertical ruler */}
        <div 
          className="absolute bg-gray-100 border-r border-gray-300 flex flex-col"
          style={{ 
            top: 0, 
            left: -rulerSize * zoomLevel, 
            width: rulerSize * zoomLevel, 
            height: pageH * zoomLevel 
          }}
        >
          {Array.from({ length: Math.ceil(pageH / 50) }).map((_, i) => (
            <div 
              key={i} 
              className="relative border-b border-gray-300" 
              style={{ height: 50 * zoomLevel, width: '100%' }}
            >
              <span className="absolute left-1 top-0 text-[8px] text-gray-600" style={{ writingMode: 'vertical-lr' }}>{i * 50}</span>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Damage Check PDF Template Editor</CardTitle>
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleImportFile} />
              <input type="file" ref={checklistInputRef} accept=".json" className="hidden" />
              <input type="file" ref={backgroundInputRef} accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
              
              <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" data-testid="button-import-pdf-template">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" data-testid="button-new-template">
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Toolbar */}
          {currentTemplate && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg border">
              {/* Undo/Redo */}
              <div className="flex gap-1 border-r pr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleUndo} disabled={historyIndex <= 0} data-testid="button-undo">
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1} data-testid="button-redo">
                      <Redo2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Copy/Paste */}
              <div className="flex gap-1 border-r pr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleCopySection} disabled={!selectedSection} data-testid="button-copy">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy (Ctrl+C)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handlePasteSection} disabled={!copiedSection} data-testid="button-paste">
                      <ClipboardPaste className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Paste (Ctrl+V)</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Alignment */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={selectedSections.length < 2} data-testid="button-align">
                    <AlignHorizontalJustifyCenter className="w-4 h-4 mr-1" />
                    Align
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => alignSections('left')}>
                    <AlignHorizontalJustifyStart className="w-4 h-4 mr-2" /> Align Left
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSections('center')}>
                    <AlignHorizontalJustifyCenter className="w-4 h-4 mr-2" /> Align Center
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSections('right')}>
                    <AlignHorizontalJustifyEnd className="w-4 h-4 mr-2" /> Align Right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => alignSections('top')}>
                    <AlignVerticalJustifyStart className="w-4 h-4 mr-2" /> Align Top
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSections('middle')}>
                    <AlignVerticalJustifyCenter className="w-4 h-4 mr-2" /> Align Middle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSections('bottom')}>
                    <AlignVerticalJustifyEnd className="w-4 h-4 mr-2" /> Align Bottom
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => alignSections('distribute-h')}>
                    <LayoutGrid className="w-4 h-4 mr-2" /> Distribute Horizontally
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSections('distribute-v')}>
                    <LayoutGrid className="w-4 h-4 mr-2" /> Distribute Vertically
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* View Options */}
              <div className="flex gap-1 border-r pr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={showGrid ? "secondary" : "ghost"} size="sm" onClick={() => setShowGrid(!showGrid)} data-testid="button-grid">
                      <Grid className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Grid</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={showRulers ? "secondary" : "ghost"} size="sm" onClick={() => setShowRulers(!showRulers)} data-testid="button-rulers">
                      <Ruler className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Rulers</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={showPrintMargins ? "secondary" : "ghost"} size="sm" onClick={() => setShowPrintMargins(!showPrintMargins)} data-testid="button-margins">
                      <LayoutTemplate className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print Margins Guide</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Snapping */}
              <div className="flex gap-1 border-r pr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={snapToGrid ? "secondary" : "ghost"} size="sm" onClick={() => setSnapToGrid(!snapToGrid)} data-testid="button-snap-grid">
                      <Grid className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Snap to Grid</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={snapToEdges ? "secondary" : "ghost"} size="sm" onClick={() => setSnapToEdges(!snapToEdges)} data-testid="button-snap-edges">
                      <Magnet className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Snap to Edges</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Zoom */}
              <div className="flex items-center gap-1 border-r pr-2">
                <Button variant="ghost" size="sm" onClick={() => setZoomLevel(Math.max(0.3, zoomLevel - 0.1))} disabled={zoomLevel <= 0.3}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))} disabled={zoomLevel >= 1.5}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Add Section */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-add-section">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Section
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => addSection('customField')}>
                    <FileText className="w-4 h-4 mr-2" /> Custom Field
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSection('table')}>
                    <Table2 className="w-4 h-4 mr-2" /> Table
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSection('image')}>
                    <Image className="w-4 h-4 mr-2" /> Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSection('qrCode')}>
                    <QrCode className="w-4 h-4 mr-2" /> QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSection('barcode')}>
                    <Barcode className="w-4 h-4 mr-2" /> Barcode
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Pages */}
              {(currentTemplate.pageCount || 1) > 1 && (
                <div className="flex items-center gap-1 border-l pl-2">
                  <span className="text-sm text-gray-600">Page:</span>
                  {Array.from({ length: currentTemplate.pageCount || 1 }).map((_, i) => (
                    <Button
                      key={i}
                      variant={currentPage === i + 1 ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addPage} className="h-7 w-7 p-0">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-1 ml-auto">
                <Button size="sm" onClick={() => saveTemplateMutation.mutate(currentTemplate)} disabled={saveTemplateMutation.isPending}>
                  <Save className="w-4 h-4 mr-1" />
                  {saveTemplateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[280px_1fr] gap-4">
            {/* Left Sidebar */}
            <div className="space-y-4">
              {/* Template List */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-100 rounded-t-lg">
                  <span className="font-semibold text-sm">Templates</span>
                  <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-40 border rounded-b-lg p-2">
                    <div className="space-y-1">
                      {templates.map(template => (
                        <Button
                          key={template.id}
                          variant={currentTemplate?.id === template.id ? "default" : "ghost"}
                          className="w-full justify-start h-auto py-2"
                          onClick={() => setCurrentTemplate(template)}
                          data-testid={`template-${template.id}`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{template.name}</span>
                            <div className="flex gap-1 mt-1">
                              {template.isDefault && <Badge variant="secondary" className="text-xs h-4">Default</Badge>}
                              {template.tags?.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs h-4">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>

              {currentTemplate && (
                <>
                  {/* Template Actions */}
                  <div className="space-y-2 p-2 border rounded-lg">
                    <Label className="text-sm font-semibold">Template Actions</Label>
                    <div className="grid grid-cols-2 gap-1">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                        setDuplicateName(`${currentTemplate.name} (Copy)`);
                        setIsDuplicateDialogOpen(true);
                      }}>
                        <Copy className="w-3 h-3 mr-1" /> Duplicate
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsVersionDialogOpen(true)}>
                        <History className="w-3 h-3 mr-1" /> Versions
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsTagsDialogOpen(true)}>
                        <Tag className="w-3 h-3 mr-1" /> Tags
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsPageSettingsDialogOpen(true)}>
                        <Settings2 className="w-3 h-3 mr-1" /> Page
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportTemplate}>
                        <Download className="w-3 h-3 mr-1" /> Export
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSaveVersion}>
                        <History className="w-3 h-3 mr-1" /> Save Ver.
                      </Button>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => backgroundInputRef.current?.click()}>
                      <Image className="w-3 h-3 mr-1" /> Background Image
                    </Button>
                    
                    {(currentTemplate.pageCount || 1) <= 1 && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addPage}>
                        <Plus className="w-3 h-3 mr-1" /> Add Page
                      </Button>
                    )}
                  </div>

                  {/* Sections List */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-100 rounded-t-lg">
                      <span className="font-semibold text-sm">Sections (Page {currentPage})</span>
                      <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ScrollArea className="h-64 border rounded-b-lg p-2">
                        <div className="space-y-1">
                          {currentTemplate.sections
                            .filter(s => (s.page || 1) === currentPage)
                            .map(section => (
                              <div
                                key={section.id}
                                className={`p-2 rounded border cursor-pointer transition-colors ${
                                  selectedSection === section.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                                }`}
                                style={{ borderLeftWidth: 4, borderLeftColor: getSectionColor(section.type) }}
                                onClick={() => setSelectedSection(section.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="w-3 h-3 text-gray-400" />
                                    <span className="text-sm font-medium truncate max-w-28">
                                      {section.settings.customLabel || SECTION_LABELS[section.type]}
                                    </span>
                                  </div>
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); openSectionSettings(section); }}>
                                      <Settings2 className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}>
                                      {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toggleSectionLock(section.id); }}>
                                      {section.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    </Button>
                                    {['customField', 'table', 'image', 'qrCode', 'barcode'].includes(section.type) && (
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {section.condition && (
                                  <Badge variant="outline" className="mt-1 text-xs">Conditional</Badge>
                                )}
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <Button className="w-full" variant={currentTemplate.isDefault ? "secondary" : "outline"} onClick={async () => {
                      if (!currentTemplate.id || currentTemplate.isDefault) return;
                      const updatedTemplate = { ...currentTemplate, isDefault: true };
                      await apiRequest('PATCH', `/api/damage-check-pdf-templates/${currentTemplate.id}`, updatedTemplate);
                      queryClient.invalidateQueries({ queryKey: ['/api/damage-check-pdf-templates'] });
                      toast({ title: "Success", description: "Template set as default" });
                    }} disabled={!currentTemplate.id || currentTemplate.isDefault}>
                      <Check className="w-4 h-4 mr-2" />
                      {currentTemplate.isDefault ? 'Default Template' : 'Set as Default'}
                    </Button>
                    
                    <Button variant="outline" className="w-full" onClick={async () => {
                      if (!currentTemplate.id) return;
                      try {
                        const response = await fetch(`/api/damage-check-pdf-templates/${currentTemplate.id}/preview`, { credentials: 'include' });
                        if (!response.ok) throw new Error('Failed to generate preview');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `preview_${currentTemplate.name.replace(/\s+/g, '_')}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast({ title: "Success", description: "Preview PDF downloaded" });
                      } catch (error) {
                        toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
                      }
                    }} disabled={!currentTemplate.id}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Preview PDF
                    </Button>
                    
                    <Button variant="outline" className="w-full text-red-600" onClick={() => currentTemplate.id && deleteTemplateMutation.mutate(currentTemplate.id)} disabled={deleteTemplateMutation.isPending}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Template
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Canvas Area */}
            <div className="flex flex-col items-center">
              {currentTemplate ? (
                <div className="relative bg-gray-100 p-8 rounded-lg overflow-auto max-h-[800px]" style={{ paddingLeft: showRulers ? 28 : 32, paddingTop: showRulers ? 28 : 32 }}>
                  {renderRulers()}
                  
                  <div
                    ref={canvasRef}
                    className="relative bg-white shadow-lg mx-auto"
                    style={{
                      width: getPageWidth() * zoomLevel,
                      height: getPageHeight() * zoomLevel,
                      cursor: isMoving ? 'move' : 'default',
                      backgroundImage: currentTemplate.backgroundImage ? `url(${currentTemplate.backgroundImage})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    onMouseMove={(e) => {
                      handleMouseMove(e);
                      handleResizeMouseMove(e);
                    }}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={() => setSelectedSection(null)}
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
                    
                    {/* Print Margins Guide */}
                    {showPrintMargins && (
                      <div 
                        className="absolute border-2 border-dashed border-red-300 pointer-events-none"
                        style={{
                          left: (currentTemplate.pageMargins || 15) * zoomLevel,
                          top: (currentTemplate.pageMargins || 15) * zoomLevel,
                          right: (currentTemplate.pageMargins || 15) * zoomLevel,
                          bottom: (currentTemplate.pageMargins || 15) * zoomLevel,
                        }}
                      />
                    )}

                    {/* Sections */}
                    {currentTemplate.sections
                      .filter(s => s.visible && (s.page || 1) === currentPage)
                      .map(section => {
                        const style = section.style || {};
                        const borderStyle = style.borderStyle || 'solid';
                        const borderWidth = style.borderWidth ?? 1;
                        const borderColor = style.borderColor || '#cccccc';
                        const rotation = style.rotation || 0;
                        const opacity = style.opacity ?? 1;
                        const padding = style.padding ?? 4;
                        
                        return (
                          <div
                            key={section.id}
                            className={`absolute ${
                              selectedSection === section.id || selectedSections.includes(section.id) ? 'ring-2 ring-blue-500' : ''
                            } ${section.locked ? 'cursor-not-allowed' : 'cursor-move'} rounded overflow-hidden`}
                            style={{
                              left: section.x * zoomLevel,
                              top: section.y * zoomLevel,
                              width: section.width * zoomLevel,
                              height: section.height * zoomLevel,
                              backgroundColor: style.backgroundColor || `${getSectionColor(section.type)}05`,
                              borderWidth: borderWidth * zoomLevel,
                              borderColor: selectedSection === section.id ? '#3b82f6' : borderColor,
                              borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
                              transform: rotation ? `rotate(${rotation}deg)` : undefined,
                              opacity,
                              padding: padding * zoomLevel,
                            }}
                            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, section); }}
                          >
                            {/* Section Label */}
                            <div
                              className="absolute top-0 left-0 right-0 text-white px-2 py-0.5 text-xs font-semibold flex items-center justify-between"
                              style={{ backgroundColor: getSectionColor(section.type), fontSize: 10 * zoomLevel }}
                            >
                              <span>{section.settings.customLabel || SECTION_LABELS[section.type]}</span>
                              {section.locked && <Lock className="w-3 h-3" />}
                            </div>
                            
                            {/* Section Content Preview */}
                            <div 
                              className="pt-6 text-gray-700 leading-tight overflow-hidden" 
                              style={{ 
                                fontSize: (style.fontSize || section.settings.fontSize || 9) * zoomLevel,
                                textAlign: style.textAlign || section.settings.textAlign || 'left',
                                fontWeight: style.fontWeight || 'normal',
                                fontStyle: style.fontStyle || 'normal',
                                color: style.textColor || '#000000',
                              }}
                            >
                              {section.type === 'header' && (
                                <div className="font-bold text-center" style={{ color: section.settings.headerColor || '#334d99' }}>
                                  {section.settings.companyName || 'LAM GROUP'}
                                </div>
                              )}
                              {section.type === 'table' && (
                                <div className="text-xs text-gray-500">[Table: {section.settings.tableRows}x{section.settings.tableCols}]</div>
                              )}
                              {section.type === 'image' && (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                  {section.settings.imageUrl ? <img src={section.settings.imageUrl} alt="Section" className="max-w-full max-h-full object-contain" /> : <Image className="w-8 h-8" />}
                                </div>
                              )}
                              {section.type === 'qrCode' && (
                                <div className="flex items-center justify-center h-full">
                                  <QrCode className="w-12 h-12 text-gray-600" />
                                </div>
                              )}
                              {section.type === 'barcode' && (
                                <div className="flex items-center justify-center h-full">
                                  <Barcode className="w-16 h-8 text-gray-600" />
                                </div>
                              )}
                              {section.type === 'customField' && (
                                <div className="flex items-center gap-1">
                                  {section.settings.hasCheckbox && <span>☐</span>}
                                  {section.settings.hasText && <span>{section.settings.fieldText || 'Field'}</span>}
                                </div>
                              )}
                              {section.type === 'contractInfo' && (
                                <div className="space-y-0.5 pt-2" style={{ fontSize: Math.max(8, (section.settings.fontSize || 9) * zoomLevel * 0.9) }}>
                                  {(section.settings.contractFields || [
                                    { id: 'contract', label: 'Contract Nr:', value: '{{contractNumber}}' },
                                    { id: 'date', label: 'Datum:', value: '{{date}}' },
                                    { id: 'customer', label: 'Klant:', value: '{{customerName}}' },
                                  ]).slice(0, 5).map((field: any) => (
                                    <div key={field.id} className="flex gap-1">
                                      <span className="font-semibold">{field.label}</span>
                                      <span className="text-gray-600">___________</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {section.type === 'vehicleData' && (
                                <div className="space-y-0.5 pt-2" style={{ fontSize: Math.max(8, (section.settings.fontSize || 9) * zoomLevel * 0.9) }}>
                                  {(section.settings.vehicleFields || [
                                    { id: 'plate', label: 'Kenteken:', value: '{{licensePlate}}' },
                                    { id: 'brand', label: 'Merk:', value: '{{brand}}' },
                                    { id: 'model', label: 'Model:', value: '{{model}}' },
                                  ]).slice(0, 5).map((field: any) => (
                                    <div key={field.id} className="flex gap-1">
                                      <span className="font-semibold">{field.label}</span>
                                      <span className="text-gray-600">___________</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {section.type === 'checklist' && (() => {
                                const templateId = section.settings.checklistTemplateId;
                                const checklistTemplate = templateId ? damageCheckTemplates.find((t: any) => t.id === templateId) : null;
                                const items = section.settings.checklistItems || checklistTemplate?.inspectionPoints || [];
                                const columns = section.settings.useMultipleColumns ? (section.settings.columnCount || 2) : 1;
                                const itemsPerCol = Math.ceil(Math.min(items.length, 12) / columns);
                                
                                return (
                                  <div className="pt-2" style={{ fontSize: Math.max(7, (section.settings.fontSize || 9) * zoomLevel * 0.85) }}>
                                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                                      {items.slice(0, 12).map((item: any, idx: number) => (
                                        <div key={item.id || idx} className="flex items-center gap-1">
                                          <span className="inline-block border border-gray-400" style={{ width: (section.settings.checkboxSize || 8) * zoomLevel, height: (section.settings.checkboxSize || 8) * zoomLevel }}></span>
                                          <span className="truncate">{item.name || item.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {items.length > 12 && <div className="text-gray-400 text-center mt-1">+{items.length - 12} more items...</div>}
                                  </div>
                                );
                              })()}
                              {section.type === 'remarks' && (
                                <div className="space-y-1 pt-2" style={{ fontSize: Math.max(8, (section.settings.fontSize || 9) * zoomLevel * 0.9) }}>
                                  {(section.settings.customItems || [
                                    { id: 'damage', text: 'Schade Opmerkingen:' },
                                    { id: 'general', text: 'Algemene Opmerkingen:' },
                                  ]).slice(0, 3).map((item: any) => (
                                    <div key={item.id}>
                                      <div className="font-semibold">{item.text}</div>
                                      <div className="border-b border-gray-300 h-3"></div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {section.type === 'signatures' && (
                                <div className="grid grid-cols-2 gap-2 pt-2" style={{ fontSize: Math.max(8, (section.settings.fontSize || 9) * zoomLevel * 0.9) }}>
                                  {(section.settings.customItems || [
                                    { id: 'klant', text: 'Handtekening Klant' },
                                    { id: 'medewerker', text: 'Handtekening Medewerker' },
                                  ]).map((item: any) => (
                                    <div key={item.id} className="text-center">
                                      <div className="border border-gray-300 bg-gray-50" style={{ height: (section.settings.signatureHeight || 30) * zoomLevel * 0.6 }}></div>
                                      <div className="text-xs mt-0.5">{item.text}</div>
                                      {section.settings.includeDateLine !== false && <div className="text-xs text-gray-400">Datum: __/__/____</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {section.type === 'diagram' && (
                                <div className="flex items-center justify-center h-full pt-2">
                                  <div className="text-center text-gray-500">
                                    <Car className="w-16 h-10 mx-auto text-gray-400" />
                                    <div className="text-xs mt-1">Vehicle Diagram</div>
                                    <div className="text-xs text-gray-400">
                                      {[
                                        section.settings.showFront !== false && 'Front',
                                        section.settings.showRear !== false && 'Rear',
                                        section.settings.showSides !== false && 'Sides',
                                        section.settings.showTop !== false && 'Top'
                                      ].filter(Boolean).join(', ')}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Resize Handles */}
                            {(selectedSection === section.id || selectedSections.includes(section.id)) && !section.locked && (
                              <>
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-nw-resize" style={{ top: -2, left: -2 }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'nw')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-ne-resize" style={{ top: -2, right: -2 }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'ne')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-sw-resize" style={{ bottom: -2, left: -2 }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'sw')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-se-resize" style={{ bottom: -2, right: -2 }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'se')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-n-resize" style={{ top: -2, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'n')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-s-resize" style={{ bottom: -2, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleResizeMouseDown(e, section, 's')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-w-resize" style={{ top: '50%', left: -2, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'w')} />
                                <div className="absolute w-3 h-3 bg-blue-500 border border-white cursor-e-resize" style={{ top: '50%', right: -2, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleResizeMouseDown(e, section, 'e')} />
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  Select a template or create a new one to start editing
                </div>
              )}
            </div>
          </div>

          {/* Dialogs */}
          
          {/* Create Template Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>Create a new damage check PDF template with default section layout</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="templateName">Template Name</Label>
                  <Input id="templateName" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g., Default Layout" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTemplate}>Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Duplicate Template Dialog */}
          <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Duplicate Template</DialogTitle>
                <DialogDescription>Create a copy of the current template</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="duplicateName">New Template Name</Label>
                  <Input id="duplicateName" value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} placeholder="Template name" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleDuplicateTemplate} disabled={duplicateTemplateMutation.isPending}>
                  {duplicateTemplateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Version History Dialog */}
          <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Version History</DialogTitle>
                <DialogDescription>View and restore previous versions of this template</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-80">
                <div className="space-y-2 p-2">
                  {versions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No saved versions yet</div>
                  ) : (
                    versions.map(version => (
                      <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <div className="font-medium">Version {version.version}</div>
                          <div className="text-sm text-gray-500">{version.name}</div>
                          <div className="text-xs text-gray-400">{new Date(version.createdAt).toLocaleString()}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => {
                          if (currentTemplate?.id) {
                            restoreVersionMutation.mutate({ templateId: currentTemplate.id, versionId: version.id });
                          }
                        }} disabled={restoreVersionMutation.isPending}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          
          {/* Tags Dialog */}
          <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Tags</DialogTitle>
                <DialogDescription>Add tags to organize your templates</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a tag..." onKeyDown={(e) => e.key === 'Enter' && handleAddTag()} />
                  <Button onClick={handleAddTag}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(currentTemplate?.tags || []).map(tag => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1">
                      {tag}
                      <button className="ml-2 hover:text-red-600" onClick={() => handleRemoveTag(tag)}>×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Page Settings Dialog */}
          <Dialog open={isPageSettingsDialogOpen} onOpenChange={setIsPageSettingsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Page Settings</DialogTitle>
                <DialogDescription>Configure page size and orientation</DialogDescription>
              </DialogHeader>
              {currentTemplate && (
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Page Size</Label>
                    <Select value={currentTemplate.pageSize || 'A4'} onValueChange={(value: 'A4' | 'Letter' | 'A5' | 'custom') => {
                      setCurrentTemplate({ ...currentTemplate, pageSize: value });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                        <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                        <SelectItem value="A5">A5 (148 × 210 mm)</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Orientation</Label>
                    <Select value={currentTemplate.pageOrientation || 'portrait'} onValueChange={(value: 'portrait' | 'landscape') => {
                      setCurrentTemplate({ ...currentTemplate, pageOrientation: value });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Page Margins (pt)</Label>
                    <Input type="number" value={currentTemplate.pageMargins || 15} onChange={(e) => setCurrentTemplate({ ...currentTemplate, pageMargins: parseInt(e.target.value) || 15 })} min={0} max={50} />
                  </div>
                  
                  {currentTemplate.pageSize === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Width (pt)</Label>
                        <Input type="number" value={currentTemplate.customPageWidth || 595} onChange={(e) => setCurrentTemplate({ ...currentTemplate, customPageWidth: parseInt(e.target.value) || 595 })} />
                      </div>
                      <div>
                        <Label>Height (pt)</Label>
                        <Input type="number" value={currentTemplate.customPageHeight || 842} onChange={(e) => setCurrentTemplate({ ...currentTemplate, customPageHeight: parseInt(e.target.value) || 842 })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPageSettingsDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (currentTemplate) {
                    saveTemplateMutation.mutate(currentTemplate);
                  }
                  setIsPageSettingsDialogOpen(false);
                }}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Section Settings Dialog */}
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSection ? `${SECTION_LABELS[editingSection.type]} Settings` : 'Section Settings'}
                </DialogTitle>
                <DialogDescription>Customize the appearance and content of this section</DialogDescription>
              </DialogHeader>
              {editingSection && (
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                    <TabsTrigger value="border">Border</TabsTrigger>
                    <TabsTrigger value="condition">Condition</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="content" className="space-y-4 mt-4">
                    <div>
                      <Label>Section Header</Label>
                      <Input value={editingSection.settings.customLabel || ''} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, customLabel: e.target.value}})} placeholder={SECTION_LABELS[editingSection.type]} />
                    </div>
                    
                    {editingSection.type === 'header' && (
                      <>
                        <div>
                          <Label>Company Name</Label>
                          <Input value={editingSection.settings.companyName || ''} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, companyName: e.target.value}})} />
                        </div>
                        <div>
                          <Label>Header Color</Label>
                          <Input type="color" value={editingSection.settings.headerColor || '#334d99'} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, headerColor: e.target.value}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Show Logo</Label>
                          <Switch checked={editingSection.settings.showLogo !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showLogo: checked}})} />
                        </div>
                      </>
                    )}
                    
                    {/* Contract Info Section Editor */}
                    {editingSection.type === 'contractInfo' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Contract Info Fields</Label>
                          <Button variant="outline" size="sm" onClick={() => {
                            const items = editingSection.settings.customItems || [];
                            const newItem = { id: `field-${Date.now()}`, text: 'New Field:', hasCheckbox: false, fieldKey: '' };
                            setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: [...items, newItem]}});
                          }}>
                            <Plus className="w-4 h-4 mr-1" /> Add Field
                          </Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-lg p-2">
                          {(editingSection.settings.customItems || []).map((item: any, index: number) => (
                            <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <Input 
                                value={item.text} 
                                onChange={(e) => {
                                  const items = [...(editingSection.settings.customItems || [])];
                                  items[index] = { ...items[index], text: e.target.value };
                                  setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                                }}
                                placeholder="Label:"
                                className="flex-1"
                              />
                              <Select value={item.fieldKey || 'manual'} onValueChange={(v) => {
                                const items = [...(editingSection.settings.customItems || [])];
                                items[index] = { ...items[index], fieldKey: v === 'manual' ? '' : v };
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <SelectTrigger className="w-40"><SelectValue placeholder="Data source" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual entry</SelectItem>
                                  <SelectItem value="contractNumber">Contract Number</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="customerName">Customer Name</SelectItem>
                                  <SelectItem value="rentalPeriod">Rental Period</SelectItem>
                                  <SelectItem value="pickupDate">Pickup Date</SelectItem>
                                  <SelectItem value="returnDate">Return Date</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => {
                                const items = (editingSection.settings.customItems || []).filter((_: any, i: number) => i !== index);
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    
                    {/* Vehicle Data Section Editor */}
                    {editingSection.type === 'vehicleData' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Vehicle Data Fields</Label>
                          <Button variant="outline" size="sm" onClick={() => {
                            const items = editingSection.settings.customItems || [];
                            const newItem = { id: `field-${Date.now()}`, text: 'New Field:', hasCheckbox: false, fieldKey: '' };
                            setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: [...items, newItem]}});
                          }}>
                            <Plus className="w-4 h-4 mr-1" /> Add Field
                          </Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-lg p-2">
                          {(editingSection.settings.customItems || []).map((item: any, index: number) => (
                            <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <Input 
                                value={item.text} 
                                onChange={(e) => {
                                  const items = [...(editingSection.settings.customItems || [])];
                                  items[index] = { ...items[index], text: e.target.value };
                                  setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                                }}
                                placeholder="Label:"
                                className="flex-1"
                              />
                              <Select value={item.fieldKey || 'manual'} onValueChange={(v) => {
                                const items = [...(editingSection.settings.customItems || [])];
                                items[index] = { ...items[index], fieldKey: v === 'manual' ? '' : v };
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <SelectTrigger className="w-40"><SelectValue placeholder="Data source" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual entry</SelectItem>
                                  <SelectItem value="licensePlate">License Plate</SelectItem>
                                  <SelectItem value="brand">Brand</SelectItem>
                                  <SelectItem value="model">Model</SelectItem>
                                  <SelectItem value="buildYear">Build Year</SelectItem>
                                  <SelectItem value="mileage">Mileage</SelectItem>
                                  <SelectItem value="fuel">Fuel Level</SelectItem>
                                  <SelectItem value="color">Color</SelectItem>
                                  <SelectItem value="vin">VIN Number</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => {
                                const items = (editingSection.settings.customItems || []).filter((_: any, i: number) => i !== index);
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    
                    {/* Checklist Section Editor */}
                    {editingSection.type === 'checklist' && (
                      <div className="space-y-3">
                        {/* Mode Toggle */}
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div>
                            <Label className="font-semibold">Custom Items Mode</Label>
                            <p className="text-xs text-gray-500">Edit items directly instead of using template</p>
                          </div>
                          <Switch 
                            checked={editingSection.settings.useCustomItems === true} 
                            onCheckedChange={(checked) => {
                              if (checked && !editingSection.settings.checklistItems?.length) {
                                const templateId = editingSection.settings.checklistTemplateId;
                                const selectedTemplate = templateId ? damageCheckTemplates.find((t: any) => t.id === templateId) : null;
                                const clonedItems = (selectedTemplate?.inspectionPoints || []).map((p: any) => ({
                                  id: p.id,
                                  name: p.name,
                                  text: p.name,
                                  category: p.category,
                                  damageTypes: p.damageTypes || [],
                                  hasCheckbox: true,
                                  required: p.required
                                }));
                                setEditingSection({...editingSection, settings: {...editingSection.settings, useCustomItems: checked, checklistItems: clonedItems}});
                              } else {
                                setEditingSection({...editingSection, settings: {...editingSection.settings, useCustomItems: checked}});
                              }
                            }}
                          />
                        </div>
                        
                        {/* Template Selection (when not using custom items) */}
                        {!editingSection.settings.useCustomItems && (
                          <>
                            <div>
                              <Label className="font-semibold">Select Checklist Template</Label>
                              <p className="text-xs text-gray-500 mb-2">Items come from the template. Enable "Custom Items Mode" to edit them.</p>
                              <Select 
                                value={editingSection.settings.checklistTemplateId?.toString() || ''} 
                                onValueChange={(v) => {
                                  const templateId = parseInt(v);
                                  const selectedTemplate = damageCheckTemplates.find((t: any) => t.id === templateId);
                                  setEditingSection({
                                    ...editingSection, 
                                    settings: {
                                      ...editingSection.settings, 
                                      checklistTemplateId: templateId,
                                      checklistTemplateName: selectedTemplate?.name
                                    }
                                  });
                                }}
                              >
                                <SelectTrigger><SelectValue placeholder="Select a checklist template..." /></SelectTrigger>
                                <SelectContent>
                                  {damageCheckTemplates.map((template: any) => (
                                    <SelectItem key={template.id} value={template.id.toString()}>
                                      {template.name} ({template.inspectionPoints?.length || 0} items)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {editingSection.settings.checklistTemplateId && (() => {
                              const selectedTemplate = damageCheckTemplates.find((t: any) => t.id === editingSection.settings.checklistTemplateId);
                              const points = selectedTemplate?.inspectionPoints || [];
                              const categories = [...new Set(points.map((p: any) => p.category))];
                              const categoryLabels: Record<string, string> = {
                                'interieur': 'Interieur',
                                'exterieur': 'Exterieur',
                                'afweez_check': 'Afweez Check',
                                'documents': 'Documenten'
                              };
                              
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="font-semibold">Template Items ({points.length})</Label>
                                    <Button variant="outline" size="sm" onClick={() => {
                                      const clonedItems = points.map((p: any) => ({
                                        id: p.id,
                                        name: p.name,
                                        text: p.name,
                                        category: p.category,
                                        damageTypes: p.damageTypes || [],
                                        hasCheckbox: true,
                                        required: p.required
                                      }));
                                      setEditingSection({...editingSection, settings: {...editingSection.settings, useCustomItems: true, checklistItems: clonedItems}});
                                      toast({ title: "Cloned", description: `${points.length} items cloned for editing` });
                                    }}>
                                      <Copy className="w-3 h-3 mr-1" /> Clone to Edit
                                    </Button>
                                  </div>
                                  <ScrollArea className="h-48 border rounded-lg">
                                    {categories.map((category: string) => {
                                      const categoryPoints = points.filter((p: any) => p.category === category);
                                      return (
                                        <div key={category} className="p-2 border-b">
                                          <div className="font-semibold text-xs bg-gray-100 p-1.5 rounded mb-1">
                                            {categoryLabels[category] || category} ({categoryPoints.length})
                                          </div>
                                          {categoryPoints.map((point: any) => (
                                            <div key={point.id} className="flex items-center justify-between text-xs py-0.5 px-2">
                                              <span>{point.name}</span>
                                              <div className="flex gap-0.5">
                                                {point.damageTypes?.slice(0, 3).map((type: string) => (
                                                  <Badge key={type} variant="outline" className="text-[10px] h-4">{type}</Badge>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </ScrollArea>
                                </div>
                              );
                            })()}
                          </>
                        )}
                        
                        {/* Custom Items Editor (when using custom items) */}
                        {editingSection.settings.useCustomItems && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-semibold">Checklist Items ({(editingSection.settings.checklistItems || []).length})</Label>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => {
                                  const templateId = editingSection.settings.checklistTemplateId;
                                  const selectedTemplate = templateId ? damageCheckTemplates.find((t: any) => t.id === templateId) : null;
                                  if (selectedTemplate) {
                                    const clonedItems = selectedTemplate.inspectionPoints.map((p: any) => ({
                                      id: p.id,
                                      name: p.name,
                                      text: p.name,
                                      category: p.category,
                                      damageTypes: p.damageTypes || [],
                                      hasCheckbox: true,
                                      required: p.required
                                    }));
                                    setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: clonedItems}});
                                    toast({ title: "Reset", description: "Items reset to template defaults" });
                                  }
                                }} title="Reset to template">
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => {
                                  const items = editingSection.settings.checklistItems || [];
                                  const newItem = { 
                                    id: `check-${Date.now()}`, 
                                    name: 'New Item', 
                                    text: 'New Item', 
                                    category: 'custom',
                                    damageTypes: ['Ja', 'Nee'],
                                    hasCheckbox: true,
                                    required: false
                                  };
                                  setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: [...items, newItem]}});
                                }}>
                                  <Plus className="w-3 h-3 mr-1" /> Add
                                </Button>
                              </div>
                            </div>
                            <ScrollArea className="h-64 border rounded-lg p-2">
                              {(editingSection.settings.checklistItems || []).map((item: any, index: number) => (
                                <div key={item.id} className="flex items-start gap-2 mb-2 p-2 bg-gray-50 rounded border">
                                  <GripVertical className="w-4 h-4 text-gray-400 mt-2" />
                                  <div className="flex-1 space-y-1">
                                    <Input 
                                      value={item.name || item.text} 
                                      onChange={(e) => {
                                        const items = [...(editingSection.settings.checklistItems || [])];
                                        items[index] = { ...items[index], name: e.target.value, text: e.target.value };
                                        setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: items}});
                                      }}
                                      placeholder="Item name"
                                      className="h-8"
                                    />
                                    <div className="flex gap-2">
                                      <Select 
                                        value={item.category || 'custom'} 
                                        onValueChange={(v) => {
                                          const items = [...(editingSection.settings.checklistItems || [])];
                                          items[index] = { ...items[index], category: v };
                                          setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: items}});
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="interieur">Interieur</SelectItem>
                                          <SelectItem value="exterieur">Exterieur</SelectItem>
                                          <SelectItem value="afweez_check">Afweez Check</SelectItem>
                                          <SelectItem value="documents">Documenten</SelectItem>
                                          <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input 
                                        value={(item.damageTypes || []).join(', ')} 
                                        onChange={(e) => {
                                          const items = [...(editingSection.settings.checklistItems || [])];
                                          items[index] = { ...items[index], damageTypes: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) };
                                          setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: items}});
                                        }}
                                        placeholder="Options: Ja, Nee"
                                        className="h-7 text-xs flex-1"
                                      />
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => {
                                    const items = (editingSection.settings.checklistItems || []).filter((_: any, i: number) => i !== index);
                                    setEditingSection({...editingSection, settings: {...editingSection.settings, checklistItems: items}});
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                        
                        <Separator />
                        
                        <div className="space-y-3">
                          <Label className="font-semibold">Display Settings</Label>
                          
                          <div className="flex items-center justify-between">
                            <Label>Group by Category</Label>
                            <Switch checked={editingSection.settings.groupByCategory !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, groupByCategory: checked}})} />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label>Show Damage Type Options</Label>
                            <Switch checked={editingSection.settings.showDamageTypes !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showDamageTypes: checked}})} />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label>Use Multiple Columns</Label>
                            <Switch checked={editingSection.settings.useMultipleColumns === true} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, useMultipleColumns: checked}})} />
                          </div>
                          
                          {editingSection.settings.useMultipleColumns && (
                            <div>
                              <Label>Number of Columns</Label>
                              <Select value={editingSection.settings.columnCount?.toString() || '2'} onValueChange={(v) => setEditingSection({...editingSection, settings: {...editingSection.settings, columnCount: parseInt(v)}})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2">2 Columns</SelectItem>
                                  <SelectItem value="3">3 Columns</SelectItem>
                                  <SelectItem value="4">4 Columns</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div>
                            <Label>Checkbox Size</Label>
                            <Input type="number" value={editingSection.settings.checkboxSize || 10} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, checkboxSize: parseInt(e.target.value)}})} min={8} max={20} />
                          </div>
                          
                          <div>
                            <Label>Row Spacing</Label>
                            <Input type="number" value={editingSection.settings.rowSpacing || 12} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, rowSpacing: parseInt(e.target.value)}})} min={8} max={24} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Remarks Section Editor */}
                    {editingSection.type === 'remarks' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Remarks Fields</Label>
                          <Button variant="outline" size="sm" onClick={() => {
                            const items = editingSection.settings.customItems || [];
                            const newItem = { id: `remark-${Date.now()}`, text: 'Remark:', hasCheckbox: false, hasTextArea: true };
                            setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: [...items, newItem]}});
                          }}>
                            <Plus className="w-4 h-4 mr-1" /> Add Field
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">Add fields for notes, damage descriptions, or other remarks.</p>
                        <ScrollArea className="h-40 border rounded-lg p-2">
                          {(editingSection.settings.customItems || [
                            { id: 'damage-notes', text: 'Schade Opmerkingen:', hasTextArea: true },
                            { id: 'general-notes', text: 'Algemene Opmerkingen:', hasTextArea: true },
                          ]).map((item: any, index: number) => (
                            <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <Input 
                                value={item.text} 
                                onChange={(e) => {
                                  const items = [...(editingSection.settings.customItems || [])];
                                  items[index] = { ...items[index], text: e.target.value };
                                  setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                                }}
                                placeholder="Label:"
                                className="flex-1"
                              />
                              <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => {
                                const items = (editingSection.settings.customItems || []).filter((_: any, i: number) => i !== index);
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </ScrollArea>
                        <div>
                          <Label>Lines per Field</Label>
                          <Input type="number" value={editingSection.settings.linesPerField || 3} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, linesPerField: parseInt(e.target.value)}})} min={1} max={10} />
                        </div>
                      </div>
                    )}
                    
                    {/* Signatures Section Editor */}
                    {editingSection.type === 'signatures' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Signature Fields</Label>
                          <Button variant="outline" size="sm" onClick={() => {
                            const items = editingSection.settings.customItems || [];
                            const newItem = { id: `sig-${Date.now()}`, text: 'Signature', hasCheckbox: false };
                            setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: [...items, newItem]}});
                          }}>
                            <Plus className="w-4 h-4 mr-1" /> Add Signature
                          </Button>
                        </div>
                        <ScrollArea className="h-40 border rounded-lg p-2">
                          {(editingSection.settings.customItems || [
                            { id: 'klant-sig', text: 'Handtekening Klant' },
                            { id: 'medewerker-sig', text: 'Handtekening Medewerker' },
                          ]).map((item: any, index: number) => (
                            <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <Input 
                                value={item.text} 
                                onChange={(e) => {
                                  const items = [...(editingSection.settings.customItems || [])];
                                  items[index] = { ...items[index], text: e.target.value };
                                  setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                                }}
                                placeholder="Signature label"
                                className="flex-1"
                              />
                              <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => {
                                const items = (editingSection.settings.customItems || []).filter((_: any, i: number) => i !== index);
                                setEditingSection({...editingSection, settings: {...editingSection.settings, customItems: items}});
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </ScrollArea>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Signature Box Height</Label>
                            <Input type="number" value={editingSection.settings.signatureHeight || 40} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, signatureHeight: parseInt(e.target.value)}})} min={30} max={100} />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Label>Include Date Line</Label>
                            <Switch checked={editingSection.settings.includeDateLine !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, includeDateLine: checked}})} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Vehicle Diagram Section Editor */}
                    {editingSection.type === 'diagram' && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">The vehicle diagram shows a visual representation of the vehicle for marking damage locations.</p>
                        <div className="flex items-center justify-between">
                          <Label>Show Front View</Label>
                          <Switch checked={editingSection.settings.showFront !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showFront: checked}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Show Rear View</Label>
                          <Switch checked={editingSection.settings.showRear !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showRear: checked}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Show Side Views</Label>
                          <Switch checked={editingSection.settings.showSides !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showSides: checked}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Show Top View</Label>
                          <Switch checked={editingSection.settings.showTop !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, showTop: checked}})} />
                        </div>
                      </div>
                    )}
                    
                    {editingSection.type === 'customField' && (
                      <>
                        <div>
                          <Label>Field Text</Label>
                          <Input value={editingSection.settings.fieldText || ''} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, fieldText: e.target.value}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Show Checkbox</Label>
                          <Switch checked={editingSection.settings.hasCheckbox !== false} onCheckedChange={(checked) => setEditingSection({...editingSection, settings: {...editingSection.settings, hasCheckbox: checked}})} />
                        </div>
                      </>
                    )}
                    
                    {editingSection.type === 'table' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Rows</Label>
                            <Input type="number" value={editingSection.settings.tableRows || 4} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, tableRows: parseInt(e.target.value)}})} min={1} max={20} />
                          </div>
                          <div>
                            <Label>Columns</Label>
                            <Input type="number" value={editingSection.settings.tableCols || 3} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, tableCols: parseInt(e.target.value)}})} min={1} max={10} />
                          </div>
                        </div>
                      </>
                    )}
                    
                    {editingSection.type === 'qrCode' && (
                      <div>
                        <Label>QR Code Value</Label>
                        <Input value={editingSection.settings.qrCodeValue || ''} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, qrCodeValue: e.target.value}})} placeholder="{{contractNumber}}" />
                        <p className="text-xs text-gray-500 mt-1">Use variables like {'{{contractNumber}}'}, {'{{licensePlate}}'}</p>
                      </div>
                    )}
                    
                    {editingSection.type === 'barcode' && (
                      <div>
                        <Label>Barcode Value</Label>
                        <Input value={editingSection.settings.barcodeValue || ''} onChange={(e) => setEditingSection({...editingSection, settings: {...editingSection.settings, barcodeValue: e.target.value}})} placeholder="{{contractNumber}}" />
                      </div>
                    )}
                    
                    <div>
                      <Label>Text Variables</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {TEXT_VARIABLES.map(v => (
                          <Badge key={v.key} variant="outline" className="cursor-pointer hover:bg-gray-100" onClick={() => {
                            if (editingSection.type === 'qrCode') {
                              setEditingSection({...editingSection, settings: {...editingSection.settings, qrCodeValue: v.key}});
                            } else if (editingSection.type === 'barcode') {
                              setEditingSection({...editingSection, settings: {...editingSection.settings, barcodeValue: v.key}});
                            }
                          }}>
                            {v.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="style" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Font Size</Label>
                        <Input type="number" value={editingSection.style?.fontSize || editingSection.settings.fontSize || 9} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), fontSize: parseInt(e.target.value)}})} min={6} max={24} />
                      </div>
                      <div>
                        <Label>Font Weight</Label>
                        <Select value={editingSection.style?.fontWeight || 'normal'} onValueChange={(v: 'normal' | 'bold') => setEditingSection({...editingSection, style: {...(editingSection.style || {}), fontWeight: v}})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="bold">Bold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Text Color</Label>
                        <Input type="color" value={editingSection.style?.textColor || '#000000'} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), textColor: e.target.value}})} />
                      </div>
                      <div>
                        <Label>Background Color</Label>
                        <Input type="color" value={editingSection.style?.backgroundColor || '#ffffff'} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), backgroundColor: e.target.value}})} />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Text Alignment</Label>
                      <div className="flex gap-2 mt-2">
                        <Button variant={editingSection.style?.textAlign === 'left' ? 'default' : 'outline'} size="sm" onClick={() => setEditingSection({...editingSection, style: {...(editingSection.style || {}), textAlign: 'left'}})}>
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button variant={editingSection.style?.textAlign === 'center' ? 'default' : 'outline'} size="sm" onClick={() => setEditingSection({...editingSection, style: {...(editingSection.style || {}), textAlign: 'center'}})}>
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button variant={editingSection.style?.textAlign === 'right' ? 'default' : 'outline'} size="sm" onClick={() => setEditingSection({...editingSection, style: {...(editingSection.style || {}), textAlign: 'right'}})}>
                          <AlignRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Padding (pt)</Label>
                        <Input type="number" value={editingSection.style?.padding ?? 4} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), padding: parseInt(e.target.value)}})} min={0} max={50} />
                      </div>
                      <div>
                        <Label>Rotation (deg)</Label>
                        <Input type="number" value={editingSection.style?.rotation || 0} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), rotation: parseInt(e.target.value)}})} min={-180} max={180} />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Opacity</Label>
                      <Input type="range" min={0} max={1} step={0.1} value={editingSection.style?.opacity ?? 1} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), opacity: parseFloat(e.target.value)}})} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="border" className="space-y-4 mt-4">
                    <div>
                      <Label>Border Style</Label>
                      <Select value={editingSection.style?.borderStyle || 'solid'} onValueChange={(v: 'solid' | 'dashed' | 'dotted' | 'none') => setEditingSection({...editingSection, style: {...(editingSection.style || {}), borderStyle: v}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="dashed">Dashed</SelectItem>
                          <SelectItem value="dotted">Dotted</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Border Width</Label>
                        <Input type="number" value={editingSection.style?.borderWidth ?? 1} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), borderWidth: parseInt(e.target.value)}})} min={0} max={10} />
                      </div>
                      <div>
                        <Label>Border Color</Label>
                        <Input type="color" value={editingSection.style?.borderColor || '#cccccc'} onChange={(e) => setEditingSection({...editingSection, style: {...(editingSection.style || {}), borderColor: e.target.value}})} />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="condition" className="space-y-4 mt-4">
                    <p className="text-sm text-gray-600">Show this section only when a condition is met</p>
                    
                    <div className="flex items-center justify-between">
                      <Label>Enable Condition</Label>
                      <Switch checked={!!editingSection.condition} onCheckedChange={(checked) => {
                        if (checked) {
                          setEditingSection({...editingSection, condition: { field: 'checkType', operator: 'equals', value: 'pickup' }});
                        } else {
                          setEditingSection({...editingSection, condition: undefined});
                        }
                      }} />
                    </div>
                    
                    {editingSection.condition && (
                      <>
                        <div>
                          <Label>Field</Label>
                          <Select value={editingSection.condition.field} onValueChange={(v) => setEditingSection({...editingSection, condition: {...editingSection.condition!, field: v}})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checkType">Check Type (pickup/return)</SelectItem>
                              <SelectItem value="vehicleType">Vehicle Type</SelectItem>
                              <SelectItem value="customerType">Customer Type</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Operator</Label>
                          <Select value={editingSection.condition.operator} onValueChange={(v: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty') => setEditingSection({...editingSection, condition: {...editingSection.condition!, operator: v}})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="notEquals">Not Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="isEmpty">Is Empty</SelectItem>
                              <SelectItem value="isNotEmpty">Is Not Empty</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {!['isEmpty', 'isNotEmpty'].includes(editingSection.condition.operator) && (
                          <div>
                            <Label>Value</Label>
                            <Input value={editingSection.condition.value || ''} onChange={(e) => setEditingSection({...editingSection, condition: {...editingSection.condition!, value: e.target.value}})} placeholder="e.g., pickup, return" />
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setIsSettingsDialogOpen(false); setEditingSection(null); }}>Cancel</Button>
                <Button onClick={() => editingSection && updateSectionSettings(editingSection.settings)}>Save Settings</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

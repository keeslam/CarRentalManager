import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { getQueryFn, apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Loader2, Plus, Save, Trash2, FileText, ZoomIn, ZoomOut, Grid, 
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Copy, Lock, Unlock,
  Maximize2, Undo2, Redo2, LayoutGrid, Move, History, Settings,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal,
  AlignStartVertical, AlignEndVertical, AlignCenterVertical, ChevronDown
} from "lucide-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

interface TemplateField {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  isBold: boolean;
  source: string;
  textAlign: 'left' | 'center' | 'right';
  locked?: boolean;
}

interface Template {
  id: number;
  name: string;
  isDefault: boolean;
  backgroundPath?: string | null;
  fields: TemplateField[];
}

interface HistoryState {
  fields: TemplateField[];
  timestamp: number;
}

interface PositionPreset {
  name: string;
  x: number;
  y: number;
}

const DEFAULT_PRESETS: PositionPreset[] = [
  { name: 'Top Left', x: 100, y: 100 },
  { name: 'Top Center', x: 297.5, y: 100 },
  { name: 'Top Right', x: 495, y: 100 },
  { name: 'Center', x: 297.5, y: 421 },
  { name: 'Bottom Left', x: 100, y: 742 },
  { name: 'Bottom Center', x: 297.5, y: 742 },
  { name: 'Bottom Right', x: 495, y: 742 },
];

const PDFTemplateEditor = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
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
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [gridSize, setGridSize] = useState<number>(10);
  const [showRulers, setShowRulers] = useState<boolean>(false);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState<boolean>(true);
  const [alignmentGuides, setAlignmentGuides] = useState<{x?: number, y?: number}>({});
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copiedFields, setCopiedFields] = useState<TemplateField[]>([]);
  const [fieldHistory, setFieldHistory] = useState<TemplateField[]>([]);
  const [selectionBox, setSelectionBox] = useState<{start: {x: number, y: number}, end: {x: number, y: number}} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
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

  const uploadBackgroundMutation = useMutation({
    mutationFn: async ({ templateId, file }: { templateId: number, file: File }) => {
      const formData = new FormData();
      formData.append('background', file);
      const res = await fetch(`/api/pdf-templates/${templateId}/background`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Upload failed');
      }
      const data = await res.json();
      return data;
    },
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pdf-templates'] });
      // Update current template to show the new background immediately
      if (currentTemplate && updatedTemplate.id === currentTemplate.id) {
        setCurrentTemplate(updatedTemplate);
      }
      toast({
        title: "Success",
        description: "Background uploaded successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Background upload error:', error);
      toast({
        title: "Error",
        description: `Failed to upload background: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const removeBackgroundMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest('DELETE', `/api/pdf-templates/${templateId}/background`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pdf-templates'] });
      toast({
        title: "Success",
        description: "Background removed, using default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to remove background: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async ({ templateId }: { templateId: number }) => {
      const res = await apiRequest('GET', `/api/pdf-templates/${templateId}/preview`);
      return await res.blob();
    },
    onSuccess: (data) => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
      const url = URL.createObjectURL(data);
      setPreviewPdfUrl(url);
      toast({
        title: "Preview Generated",
        description: "Preview shows field labels for better visibility",
      });
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
      const templatesArray = Array.isArray(templateData) ? templateData : [];
      const processedTemplates = templatesArray.map((template: any) => {
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
        return {
          ...template,
          fields: Array.isArray(template.fields) ? template.fields : []
        };
      });
      
      setTemplates(processedTemplates);
      if (processedTemplates.length > 0 && !currentTemplate) {
        const defaultTemplate = processedTemplates.find((t: Template) => t.isDefault) || processedTemplates[0];
        setCurrentTemplate(defaultTemplate);
        // Reset history and state for new template
        setHistory([{ fields: JSON.parse(JSON.stringify(defaultTemplate.fields)), timestamp: Date.now() }]);
        setHistoryIndex(0);
        setSelectedFields([]);
        setCopiedFields([]);
        setFieldHistory([]);
      }
    }
  }, [templateData]);

  useEffect(() => {
    if (reservationsData) {
      const reservationsArray = Array.isArray(reservationsData) ? reservationsData : [];
      setReservations(reservationsArray);
      if (reservationsArray.length > 0 && !previewReservationId) {
        setPreviewReservationId(reservationsArray[0].id.toString());
      }
    }
  }, [reservationsData]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl/Cmd + C for copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedFields.length > 0) {
        e.preventDefault();
        handleCopyFields();
      }
      // Ctrl/Cmd + V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedFields.length > 0) {
        e.preventDefault();
        handlePasteFields();
      }
      // Ctrl/Cmd + D for duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedFields.length > 0) {
        e.preventDefault();
        handleDuplicateFields();
      }
      // Arrow keys for precise movement
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedFields.length > 0) {
        e.preventDefault();
        handleArrowKeyMove(e.key, e.shiftKey);
      }
      // Delete key
      if (e.key === 'Delete' && selectedFields.length > 0) {
        e.preventDefault();
        handleDeleteSelectedFields();
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedFields([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFields, copiedFields, history, historyIndex, currentTemplate]);

  const addToHistory = (fields: TemplateField[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ fields: JSON.parse(JSON.stringify(fields)), timestamp: Date.now() });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0 && currentTemplate) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentTemplate({
        ...currentTemplate,
        fields: JSON.parse(JSON.stringify(history[newIndex].fields))
      });
      toast({ title: "Undo", description: "Reverted last change" });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1 && currentTemplate) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentTemplate({
        ...currentTemplate,
        fields: JSON.parse(JSON.stringify(history[newIndex].fields))
      });
      toast({ title: "Redo", description: "Reapplied change" });
    }
  };

  const snapPosition = (value: number): number => {
    if (!snapToGrid) return value;
    const safeGridSize = Math.max(1, gridSize); // Ensure grid size is always at least 1
    return Math.round(value / safeGridSize) * safeGridSize;
  };

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
      id: 0,
      name: newTemplateName,
      isDefault: templates.length === 0,
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

    const x = snapPosition(595 / 2);
    const y = snapPosition(842 / 2);

    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      name: newFieldName,
      x,
      y,
      fontSize: 12,
      isBold: false,
      source: newFieldSource,
      textAlign: 'left',
      locked: false
    };

    const updatedTemplate = {
      ...currentTemplate,
      fields: [...currentTemplate.fields, newField]
    };

    setCurrentTemplate(updatedTemplate);
    addToHistory(updatedTemplate.fields);
    setNewFieldName('');
    setNewFieldSource('');
    setIsAddFieldDialogOpen(false);
  };

  const handleMouseDown = (e: React.MouseEvent, field: TemplateField) => {
    if (field.locked) {
      toast({ title: "Field Locked", description: "Unlock the field to move it" });
      return;
    }
    
    if (!isMoving || !currentTemplate || !pdfContainerRef.current) return;
    e.preventDefault();
    
    // Multi-select with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
      if (selectedFields.includes(field.id)) {
        setSelectedFields(selectedFields.filter(id => id !== field.id));
      } else {
        setSelectedFields([...selectedFields, field.id]);
      }
    } else if (!selectedFields.includes(field.id)) {
      setSelectedFields([field.id]);
    }
    
    // Calculate where on the field the user clicked (in PDF coordinates)
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const clickX = (e.clientX - containerRect.left) / zoomLevel;
    const clickY = (e.clientY - containerRect.top) / zoomLevel;
    
    // Store offset from field position to click position
    setDragOffset({
      x: clickX - field.x,
      y: clickY - field.y
    });
    
    setDraggedField(field);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMoving || !draggedField || !currentTemplate || !pdfContainerRef.current || !dragOffset) return;
    
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const rawX = e.clientX - containerRect.left;
    const rawY = e.clientY - containerRect.top;
    
    // Convert cursor position to PDF coordinates and subtract drag offset
    let x = Math.max(0, Math.min(rawX / zoomLevel - dragOffset.x, 595));
    let y = Math.max(0, Math.min(rawY / zoomLevel - dragOffset.y, 842));
    
    x = snapPosition(x);
    y = snapPosition(y);

    const deltaX = x - draggedField.x;
    const deltaY = y - draggedField.y;

    // Move all selected fields together
    const fieldsToMove = selectedFields.length > 0 ? selectedFields : [draggedField.id];
    const updatedFields = currentTemplate.fields.map(f => {
      if (fieldsToMove.includes(f.id) && !f.locked) {
        return { ...f, x: snapPosition(f.x + deltaX), y: snapPosition(f.y + deltaY) };
      }
      return f;
    });

    // Show alignment guides (works for single or multi-select)
    if (showAlignmentGuides) {
      const guides: {x?: number, y?: number} = {};
      const threshold = 5;
      
      currentTemplate.fields.forEach(f => {
        if (!fieldsToMove.includes(f.id)) {
          if (Math.abs(f.x - x) < threshold) guides.x = f.x;
          if (Math.abs(f.y - y) < threshold) guides.y = f.y;
        }
      });
      
      setAlignmentGuides(guides);
    }

    setCurrentTemplate({
      ...currentTemplate,
      fields: updatedFields
    });

    if (fieldsToMove.includes(draggedField.id)) {
      setDraggedField({ ...draggedField, x, y });
    }
  };

  const handleMouseUp = () => {
    if (draggedField && currentTemplate) {
      addToHistory(currentTemplate.fields);
    }
    setDraggedField(null);
    setDragOffset(null);
    setAlignmentGuides({});
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!isMoving && pdfContainerRef.current) {
      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      setSelectionBox({ start: { x, y }, end: { x, y } });
      setIsSelecting(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && selectionBox && pdfContainerRef.current) {
      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      setSelectionBox({ ...selectionBox, end: { x, y } });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isSelecting && selectionBox && currentTemplate) {
      const minX = Math.min(selectionBox.start.x, selectionBox.end.x) / zoomLevel;
      const maxX = Math.max(selectionBox.start.x, selectionBox.end.x) / zoomLevel;
      const minY = Math.min(selectionBox.start.y, selectionBox.end.y) / zoomLevel;
      const maxY = Math.max(selectionBox.start.y, selectionBox.end.y) / zoomLevel;

      const selected = currentTemplate.fields
        .filter(f => f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY)
        .map(f => f.id);

      setSelectedFields(selected);
    }
    setIsSelecting(false);
    setSelectionBox(null);
  };

  const handleFieldClick = (field: TemplateField, e?: React.MouseEvent) => {
    if (isMoving) return;
    
    if (e && (e.ctrlKey || e.metaKey)) {
      if (selectedFields.includes(field.id)) {
        setSelectedFields(selectedFields.filter(id => id !== field.id));
      } else {
        setSelectedFields([...selectedFields, field.id]);
      }
    } else {
      setSelectedFields([field.id]);
    }

    // Add to field history
    if (!fieldHistory.find(f => f.id === field.id)) {
      setFieldHistory([field, ...fieldHistory.slice(0, 9)]);
    }
  };

  const handleArrowKeyMove = (key: string, shiftKey: boolean) => {
    if (!currentTemplate || selectedFields.length === 0) return;

    const step = shiftKey ? 10 : 1;
    const updatedFields = currentTemplate.fields.map(f => {
      if (selectedFields.includes(f.id) && !f.locked) {
        let { x, y } = f;
        if (key === 'ArrowLeft') x -= step;
        if (key === 'ArrowRight') x += step;
        if (key === 'ArrowUp') y -= step;
        if (key === 'ArrowDown') y += step;
        x = Math.max(0, Math.min(x, 595));
        y = Math.max(0, Math.min(y, 842));
        return { ...f, x: snapPosition(x), y: snapPosition(y) };
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
  };

  const handleCopyFields = () => {
    if (!currentTemplate || selectedFields.length === 0) return;
    const fieldsToCopy = currentTemplate.fields.filter(f => selectedFields.includes(f.id));
    setCopiedFields(fieldsToCopy);
    toast({ title: "Copied", description: `${fieldsToCopy.length} field(s) copied` });
  };

  const handlePasteFields = () => {
    if (!currentTemplate || copiedFields.length === 0) return;
    
    const newFields = copiedFields.map(f => ({
      ...f,
      id: `field-${Date.now()}-${Math.random()}`,
      x: Math.min(575, f.x + 20), // Keep within page bounds (595 - 20 margin)
      y: Math.min(822, f.y + 20)  // Keep within page bounds (842 - 20 margin)
    }));

    const updatedTemplate = {
      ...currentTemplate,
      fields: [...currentTemplate.fields, ...newFields]
    };

    setCurrentTemplate(updatedTemplate);
    addToHistory(updatedTemplate.fields);
    setSelectedFields(newFields.map(f => f.id));
    toast({ title: "Pasted", description: `${newFields.length} field(s) pasted` });
  };

  const handleDuplicateFields = () => {
    if (!currentTemplate || selectedFields.length === 0) return;
    
    const fieldsToDuplicate = currentTemplate.fields.filter(f => selectedFields.includes(f.id));
    const newFields = fieldsToDuplicate.map(f => ({
      ...f,
      id: `field-${Date.now()}-${Math.random()}`,
      x: Math.min(575, f.x + 20), // Keep within page bounds (595 - 20 margin)
      y: Math.min(822, f.y + 20)  // Keep within page bounds (842 - 20 margin)
    }));

    const updatedTemplate = {
      ...currentTemplate,
      fields: [...currentTemplate.fields, ...newFields]
    };

    setCurrentTemplate(updatedTemplate);
    addToHistory(updatedTemplate.fields);
    setSelectedFields(newFields.map(f => f.id));
    toast({ title: "Duplicated", description: `${newFields.length} field(s) duplicated` });
  };

  const handleDeleteSelectedFields = () => {
    if (!currentTemplate || selectedFields.length === 0) return;

    const updatedFields = currentTemplate.fields.filter(f => !selectedFields.includes(f.id));
    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    setSelectedFields([]);
    toast({ title: "Deleted", description: `${selectedFields.length} field(s) deleted` });
  };

  const handleAlignFields = (type: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    if (!currentTemplate || selectedFields.length < 2) return;

    const fieldsToAlign = currentTemplate.fields.filter(f => selectedFields.includes(f.id));
    let referenceValue: number;

    switch (type) {
      case 'left':
        referenceValue = Math.min(...fieldsToAlign.map(f => f.x));
        break;
      case 'right':
        referenceValue = Math.max(...fieldsToAlign.map(f => f.x));
        break;
      case 'top':
        referenceValue = Math.min(...fieldsToAlign.map(f => f.y));
        break;
      case 'bottom':
        referenceValue = Math.max(...fieldsToAlign.map(f => f.y));
        break;
      case 'centerH':
        referenceValue = fieldsToAlign.reduce((sum, f) => sum + f.x, 0) / fieldsToAlign.length;
        break;
      case 'centerV':
        referenceValue = fieldsToAlign.reduce((sum, f) => sum + f.y, 0) / fieldsToAlign.length;
        break;
    }

    const updatedFields = currentTemplate.fields.map(f => {
      if (selectedFields.includes(f.id) && !f.locked) {
        if (type === 'left' || type === 'right' || type === 'centerH') {
          return { ...f, x: snapPosition(referenceValue) };
        } else {
          return { ...f, y: snapPosition(referenceValue) };
        }
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    toast({ title: "Aligned", description: `Fields aligned to ${type}` });
  };

  const handleDistribute = (direction: 'horizontal' | 'vertical') => {
    if (!currentTemplate || selectedFields.length < 3) {
      toast({ title: "Error", description: "Select at least 3 fields to distribute" });
      return;
    }

    const fieldsToDistribute = currentTemplate.fields
      .filter(f => selectedFields.includes(f.id))
      .sort((a, b) => direction === 'horizontal' ? a.x - b.x : a.y - b.y);

    const first = fieldsToDistribute[0];
    const last = fieldsToDistribute[fieldsToDistribute.length - 1];
    const totalSpace = direction === 'horizontal' ? last.x - first.x : last.y - first.y;
    const gap = totalSpace / (fieldsToDistribute.length - 1);

    const updatedFields = currentTemplate.fields.map(f => {
      const index = fieldsToDistribute.findIndex(field => field.id === f.id);
      if (index > 0 && index < fieldsToDistribute.length - 1 && !f.locked) {
        if (direction === 'horizontal') {
          return { ...f, x: snapPosition(first.x + gap * index) };
        } else {
          return { ...f, y: snapPosition(first.y + gap * index) };
        }
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    toast({ title: "Distributed", description: `Fields distributed ${direction}ly` });
  };

  const handleToggleLock = (fieldId: string) => {
    if (!currentTemplate) return;

    const updatedFields = currentTemplate.fields.map(f => 
      f.id === fieldId ? { ...f, locked: !f.locked } : f
    );

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
  };

  const handleApplyPreset = (preset: PositionPreset) => {
    if (!currentTemplate || selectedFields.length === 0) return;

    const updatedFields = currentTemplate.fields.map(f => {
      if (selectedFields.includes(f.id) && !f.locked) {
        return { ...f, x: preset.x, y: preset.y };
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    toast({ title: "Preset Applied", description: `Moved to ${preset.name}` });
  };

  const handleMatchProperty = (property: 'x' | 'y' | 'fontSize') => {
    if (!currentTemplate || selectedFields.length < 2) return;

    const firstField = currentTemplate.fields.find(f => f.id === selectedFields[0]);
    if (!firstField) return;

    const updatedFields = currentTemplate.fields.map(f => {
      if (selectedFields.includes(f.id) && f.id !== selectedFields[0] && !f.locked) {
        return { ...f, [property]: firstField[property] };
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    toast({ title: "Matched", description: `${property} matched to first selected field` });
  };

  const handleBatchEdit = (property: 'fontSize' | 'isBold' | 'textAlign', value: any) => {
    if (!currentTemplate || selectedFields.length === 0) return;

    const updatedFields = currentTemplate.fields.map(f => {
      if (selectedFields.includes(f.id)) {
        return { ...f, [property]: value };
      }
      return f;
    });

    setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
    addToHistory(updatedFields);
    toast({ title: "Batch Edit", description: `${property} updated for ${selectedFields.length} fields` });
  };

  const handleZoomToFit = () => {
    if (!pdfContainerRef.current) return;
    const parent = pdfContainerRef.current.parentElement;
    if (!parent) return;
    
    const containerWidth = parent.clientWidth - 32;
    const containerHeight = parent.clientHeight - 32;
    const zoomWidth = containerWidth / 595;
    const zoomHeight = containerHeight / 842;
    const idealZoom = Math.min(zoomWidth, zoomHeight);
    setZoomLevel(Math.max(idealZoom, 0.3)); // Only enforce minimum, no maximum
    toast({ title: "Zoom to Fit", description: "Adjusted zoom to fit page" });
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.1, 3);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.1, 0.3);
    setZoomLevel(newZoom);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleUploadBackground = () => {
    if (!currentTemplate) return;
    backgroundInputRef.current?.click();
  };

  const handleBackgroundFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTemplate) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only JPG, PNG, and PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    uploadBackgroundMutation.mutate({ templateId: currentTemplate.id, file });
    
    // Reset input
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  };

  const handleRemoveBackground = () => {
    if (!currentTemplate) return;
    removeBackgroundMutation.mutate(currentTemplate.id);
  };

  const handleSaveTemplate = () => {
    if (!currentTemplate) return;
    
    const templateToSave = {
      id: currentTemplate.id,
      name: currentTemplate.name,
      isDefault: currentTemplate.isDefault,
      fields: currentTemplate.fields.map(field => ({
        id: field.id,
        name: field.name,
        x: field.x,
        y: field.y,
        fontSize: field.fontSize,
        isBold: field.isBold,
        source: field.source,
        textAlign: field.textAlign,
        locked: field.locked || false
      }))
    };
    
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
        textAlign: field.textAlign,
        locked: field.locked || false
      }))
    };
    
    saveTemplateMutation.mutate(templateToSave);
  };

  const handlePreviewGenerate = () => {
    if (!currentTemplate) return;
    
    if (saveTemplateMutation.isPending) {
      toast({
        title: "Template is saving",
        description: "Please wait until the template is saved before generating preview",
      });
      return;
    }
    
    generatePreviewMutation.mutate({ templateId: currentTemplate.id });
  };

  const selectedField = selectedFields.length === 1 
    ? currentTemplate?.fields.find(f => f.id === selectedFields[0]) 
    : null;

  if (isTemplateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Link href="/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>
          </Link>
        </div>
        
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Your First Template</CardTitle>
            <CardDescription>
              Get started by creating a contract template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Rental Contract"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateTemplate} disabled={saveTemplateMutation.isPending}>
              {saveTemplateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Template
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <kbd className="px-2 py-1 rounded bg-muted">Ctrl+Z</kbd> Undo
            <kbd className="px-2 py-1 rounded bg-muted">Ctrl+Y</kbd> Redo
            <kbd className="px-2 py-1 rounded bg-muted">Ctrl+C/V</kbd> Copy/Paste
            <kbd className="px-2 py-1 rounded bg-muted">Ctrl+D</kbd> Duplicate
            <kbd className="px-2 py-1 rounded bg-muted">↑←↓→</kbd> Move (Shift for 10px)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Template Selection</CardTitle>
                <CardDescription>Choose a template to edit or preview</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => handleUndo()} disabled={historyIndex <= 0} variant="outline" size="sm" title="Undo (Ctrl+Z)">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button onClick={() => handleRedo()} disabled={historyIndex >= history.length - 1} variant="outline" size="sm" title="Redo (Ctrl+Y)">
                  <Redo2 className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Background
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleUploadBackground} disabled={!currentTemplate || uploadBackgroundMutation.isPending}>
                      Upload Custom Background
                    </DropdownMenuItem>
                    {currentTemplate?.backgroundPath && (
                      <DropdownMenuItem onClick={handleRemoveBackground} disabled={removeBackgroundMutation.isPending}>
                        Remove Custom Background
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={handleDeleteTemplate} disabled={saveTemplateMutation.isPending || deleteTemplateMutation.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
                  {saveTemplateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-4">
                <Label>Select Template</Label>
                <Select
                  value={currentTemplate?.id.toString() || ''}
                  onValueChange={(value) => {
                    const template = templates.find(t => t.id.toString() === value);
                    if (template) {
                      setCurrentTemplate(template);
                      // Reset all state when switching templates
                      setHistory([{ fields: JSON.parse(JSON.stringify(template.fields)), timestamp: Date.now() }]);
                      setHistoryIndex(0);
                      setSelectedFields([]);
                      setCopiedFields([]);
                      setFieldHistory([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name} {template.isDefault ? ' (Default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentTemplate && !currentTemplate.isDefault && (
                <div className="space-y-4">
                  <Label>Set as Default</Label>
                  <Button variant="outline" onClick={handleSetDefaultTemplate} className="w-full">
                    Make Default
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                <Label>Move Mode</Label>
                <div className="flex items-center space-x-2">
                  <Switch checked={isMoving} onCheckedChange={setIsMoving} id="move-mode" />
                  <Label htmlFor="move-mode">
                    {isMoving ? 'Active' : 'Inactive'}
                  </Label>
                </div>
              </div>
              <div className="space-y-4">
                <Label>Snap to Grid ({gridSize}px)</Label>
                <div className="flex items-center space-x-2">
                  <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} id="snap-grid" />
                  <Input type="number" value={gridSize} onChange={(e) => {
                    const value = Number(e.target.value);
                    setGridSize(value < 1 ? 1 : value > 50 ? 50 : value);
                  }} className="w-20" min="1" max="50" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentTemplate && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Template Editor</CardTitle>
                      <CardDescription>
                        {selectedFields.length > 0 
                          ? `${selectedFields.length} field(s) selected` 
                          : 'Click fields to select, drag to move'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex gap-1 rounded-md border border-input p-1">
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleResetZoom} title="Reset Zoom">
                          <span className="text-xs font-mono">{Math.round(zoomLevel * 100)}%</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleZoomToFit} title="Zoom to Fit">
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <Button variant="outline" size="icon" onClick={() => setShowGrid(!showGrid)} className={showGrid ? "bg-slate-100" : ""} title="Toggle Grid">
                        <Grid className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setShowRulers(!showRulers)} className={showRulers ? "bg-slate-100" : ""} title="Toggle Rulers">
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setShowAlignmentGuides(!showAlignmentGuides)} className={showAlignmentGuides ? "bg-slate-100" : ""} title="Toggle Alignment Guides">
                        <Move className="h-4 w-4" />
                      </Button>

                      {selectedFields.length > 0 && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <AlignCenter className="h-4 w-4 mr-1" />
                                Align
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuLabel>Align Fields</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAlignFields('left')}>
                                <AlignStartHorizontal className="h-4 w-4 mr-2" />
                                Align Left
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAlignFields('centerH')}>
                                <AlignCenterHorizontal className="h-4 w-4 mr-2" />
                                Align Center (H)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAlignFields('right')}>
                                <AlignEndHorizontal className="h-4 w-4 mr-2" />
                                Align Right
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAlignFields('top')}>
                                <AlignStartVertical className="h-4 w-4 mr-2" />
                                Align Top
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAlignFields('centerV')}>
                                <AlignCenterVertical className="h-4 w-4 mr-2" />
                                Align Center (V)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAlignFields('bottom')}>
                                <AlignEndVertical className="h-4 w-4 mr-2" />
                                Align Bottom
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {selectedFields.length >= 3 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Distribute
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleDistribute('horizontal')}>
                                  <AlignHorizontalDistributeCenter className="h-4 w-4 mr-2" />
                                  Distribute Horizontally
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDistribute('vertical')}>
                                  <AlignVerticalDistributeCenter className="h-4 w-4 mr-2" />
                                  Distribute Vertically
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          <Button variant="outline" size="sm" onClick={handleDuplicateFields} title="Duplicate (Ctrl+D)">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Dialog open={isAddFieldDialogOpen} onOpenChange={setIsAddFieldDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="default">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Field
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Field</DialogTitle>
                            <DialogDescription>
                              Specify the field details to add to the template
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
                              <Select value={newFieldSource} onValueChange={setNewFieldSource}>
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
                            <Button onClick={handleAddField}>Add Field</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative">
                    {showRulers && (
                      <>
                        <div className="absolute top-0 left-8 right-0 h-8 bg-gray-100 border-b flex items-end text-xs text-gray-600" style={{ zIndex: 10 }}>
                          {Array.from({ length: Math.ceil(595 / 50) + 1 }).map((_, i) => (
                            <div key={i} className="absolute" style={{ left: `${i * 50 * zoomLevel + 32}px` }}>
                              <div className="h-2 w-px bg-gray-400" />
                              <span className="ml-1">{i * 50}</span>
                            </div>
                          ))}
                        </div>
                        <div className="absolute top-8 left-0 bottom-0 w-8 bg-gray-100 border-r flex flex-col text-xs text-gray-600" style={{ zIndex: 10 }}>
                          {Array.from({ length: Math.ceil(842 / 50) + 1 }).map((_, i) => (
                            <div key={i} className="absolute" style={{ top: `${i * 50 * zoomLevel + 32}px` }}>
                              <div className="w-2 h-px bg-gray-400" />
                              <span className="ml-0.5">{i * 50}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    
                    <div 
                      className="relative overflow-auto" 
                      style={{
                        height: '70vh',
                        paddingLeft: showRulers ? '32px' : '16px',
                        paddingTop: showRulers ? '32px' : '16px',
                        paddingRight: '16px',
                        paddingBottom: '16px'
                      }}
                    >
                      <div 
                        ref={pdfContainerRef}
                        className={`relative bg-white border border-gray-300 shadow-lg ${showGrid ? 'bg-grid' : ''}`}
                        style={{ 
                          width: `${595 * zoomLevel}px`, 
                          height: `${842 * zoomLevel}px`,
                          margin: '0 auto',
                          backgroundImage: showGrid ? 
                            `repeating-linear-gradient(0deg, transparent, transparent ${gridSize * zoomLevel - 1}px, #e5e7eb ${gridSize * zoomLevel - 1}px, #e5e7eb ${gridSize * zoomLevel}px),
                             repeating-linear-gradient(90deg, transparent, transparent ${gridSize * zoomLevel - 1}px, #e5e7eb ${gridSize * zoomLevel - 1}px, #e5e7eb ${gridSize * zoomLevel}px),
                             url(${currentTemplate?.backgroundPath ? `/${currentTemplate.backgroundPath}` : contractBackground})` :
                            `url(${currentTemplate?.backgroundPath ? `/${currentTemplate.backgroundPath}` : contractBackground})`,
                          backgroundSize: showGrid ? `${gridSize * zoomLevel}px ${gridSize * zoomLevel}px, ${gridSize * zoomLevel}px ${gridSize * zoomLevel}px, cover` : 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: showGrid ? 'repeat, repeat, no-repeat' : 'no-repeat',
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleCanvasMouseDown}
                      >
                        {alignmentGuides.x !== undefined && (
                          <div className="absolute top-0 bottom-0 w-px bg-blue-500" style={{ left: `${alignmentGuides.x * zoomLevel}px` }} />
                        )}
                        {alignmentGuides.y !== undefined && (
                          <div className="absolute left-0 right-0 h-px bg-blue-500" style={{ top: `${alignmentGuides.y * zoomLevel}px` }} />
                        )}
                        
                        {currentTemplate.fields.map(field => (
                          <div
                            key={field.id}
                            className={`absolute cursor-pointer p-1 rounded transition-all ${
                              selectedFields.includes(field.id) ? 'ring-2 ring-blue-500 bg-white bg-opacity-90' : ''
                            } ${isMoving && !field.locked ? 'cursor-move' : ''} ${field.locked ? 'opacity-60' : ''}`}
                            style={{
                              left: `${field.x * zoomLevel}px`,
                              top: `${field.y * zoomLevel}px`,
                              fontSize: `${field.fontSize * zoomLevel}px`,
                              fontWeight: field.isBold ? 'bold' : 'normal',
                              transform: 'translate(-50%, -50%)',
                              backgroundColor: selectedFields.includes(field.id) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.85)',
                              color: '#000000',
                              padding: `${1 * zoomLevel}px ${6 * zoomLevel}px`,
                              boxShadow: selectedFields.includes(field.id) ? '0 2px 4px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.2)',
                              borderRadius: `${2 * zoomLevel}px`,
                              textAlign: field.textAlign,
                              minWidth: `${60 * zoomLevel}px`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: field.textAlign === 'left' ? 'flex-start' : field.textAlign === 'right' ? 'flex-end' : 'center',
                              lineHeight: 1.2
                            }}
                            onClick={(e) => handleFieldClick(field, e)}
                            onMouseDown={(e) => handleMouseDown(e, field)}
                          >
                            {field.locked && <Lock className="h-3 w-3 mr-1" />}
                            {field.name}
                          </div>
                        ))}
                        
                        {selectionBox && (
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
                            style={{
                              left: `${Math.min(selectionBox.start.x, selectionBox.end.x)}px`,
                              top: `${Math.min(selectionBox.start.y, selectionBox.end.y)}px`,
                              width: `${Math.abs(selectionBox.end.x - selectionBox.start.x)}px`,
                              height: `${Math.abs(selectionBox.end.y - selectionBox.start.y)}px`
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedFields.length === 0 ? 'No Selection' : 
                     selectedFields.length === 1 ? 'Field Properties' : 
                     `Batch Edit (${selectedFields.length})`}
                  </CardTitle>
                  <CardDescription>
                    {selectedFields.length === 0 ? 'Select fields to edit' :
                     selectedFields.length === 1 ? 'Edit the selected field' :
                     'Edit multiple fields together'}
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
                            setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
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
                            setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
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
                              setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
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
                              setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Font Size</Label>
                        <Input 
                          type="number"
                          value={selectedField.fontSize}
                          onChange={(e) => {
                            if (!currentTemplate) return;
                            const fontSize = Number(e.target.value);
                            const updatedFields = currentTemplate.fields.map(f => 
                              f.id === selectedField.id ? { ...f, fontSize } : f
                            );
                            setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Bold Text</Label>
                        <Switch
                          checked={selectedField.isBold}
                          onCheckedChange={(checked) => {
                            if (!currentTemplate) return;
                            const updatedFields = currentTemplate.fields.map(f => 
                              f.id === selectedField.id ? { ...f, isBold: checked } : f
                            );
                            setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Text Alignment</Label>
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant={selectedField.textAlign === 'left' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (!currentTemplate) return;
                              const updatedFields = currentTemplate.fields.map(f => 
                                f.id === selectedField.id ? { ...f, textAlign: 'left' as const } : f
                              );
                              setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                            }}
                          >
                            <AlignLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedField.textAlign === 'center' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (!currentTemplate) return;
                              const updatedFields = currentTemplate.fields.map(f => 
                                f.id === selectedField.id ? { ...f, textAlign: 'center' as const } : f
                              );
                              setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                            }}
                          >
                            <AlignCenter className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedField.textAlign === 'right' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (!currentTemplate) return;
                              const updatedFields = currentTemplate.fields.map(f => 
                                f.id === selectedField.id ? { ...f, textAlign: 'right' as const } : f
                              );
                              setCurrentTemplate({ ...currentTemplate, fields: updatedFields });
                            }}
                          >
                            <AlignRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Lock Field</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLock(selectedField.id)}
                        >
                          {selectedField.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Separator />
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteSelectedFields}
                        className="w-full"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Field
                      </Button>
                    </div>
                  ) : selectedFields.length > 1 ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Batch Font Size</Label>
                        <Input 
                          type="number"
                          placeholder="Enter font size"
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (value > 0) handleBatchEdit('fontSize', value);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Batch Bold</Label>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleBatchEdit('isBold', true)}>
                            On
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleBatchEdit('isBold', false)}>
                            Off
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Batch Alignment</Label>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => handleBatchEdit('textAlign', 'left')}>
                            <AlignLeft className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleBatchEdit('textAlign', 'center')}>
                            <AlignCenter className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleBatchEdit('textAlign', 'right')}>
                            <AlignRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label>Match Property</Label>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => handleMatchProperty('x')}>X</Button>
                          <Button size="sm" variant="outline" onClick={() => handleMatchProperty('y')}>Y</Button>
                          <Button size="sm" variant="outline" onClick={() => handleMatchProperty('fontSize')}>Size</Button>
                        </div>
                      </div>
                      <Separator />
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteSelectedFields}
                        className="w-full"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete All Selected
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Select one or more fields to edit
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Position Presets</CardTitle>
                  <CardDescription>Quick positioning for selected fields</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyPreset(preset)}
                        disabled={selectedFields.length === 0}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {fieldHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Field History
                    </CardTitle>
                    <CardDescription>Recently edited fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {fieldHistory.slice(0, 5).map((field) => (
                        <Button
                          key={field.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleFieldClick(field)}
                        >
                          {field.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Preview Template</CardTitle>
                  <CardDescription>Generate PDF preview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
                      <a 
                        href={previewPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                      >
                        View Preview PDF →
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden file input for background upload */}
      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,application/pdf"
        onChange={handleBackgroundFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default PDFTemplateEditor;

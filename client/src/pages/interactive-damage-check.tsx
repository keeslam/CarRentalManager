import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Vehicle, type Reservation } from "@shared/schema";
import { displayLicensePlate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { X, Save, Trash2, Plus, Pencil, Eraser, Download } from "lucide-react";

interface DamageMarker {
  id: string;
  x: number;
  y: number;
  type: 'scratch' | 'dent' | 'crack' | 'missing' | 'other';
  severity: 'minor' | 'moderate' | 'severe';
  notes: string;
}

interface DiagramTemplate {
  id: number;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  diagramPath: string;
  description: string | null;
}

interface InteractiveDamageCheckProps {
  onClose?: () => void;
  editingCheckId?: number | null;
  initialVehicleId?: number | null;
  initialReservationId?: number | null;
}

export default function InteractiveDamageCheck({ onClose, editingCheckId: propEditingCheckId, initialVehicleId, initialReservationId }: InteractiveDamageCheckProps = {}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingCheckId, setEditingCheckId] = useState<number | null>(propEditingCheckId || null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(initialReservationId || null);
  const [diagramTemplate, setDiagramTemplate] = useState<DiagramTemplate | null>(null);
  const [markers, setMarkers] = useState<DamageMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<DamageMarker | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [checkType, setCheckType] = useState<'pickup' | 'return'>('pickup');
  const [fuelLevel, setFuelLevel] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Inspection checklist items
  const [checklistItems, setChecklistItems] = useState({
    interior: {
      carInterior: '', // schoon/vuil
      floorMats: '', // ja/nee
      upholstery: '', // kapot/heel/brandgaten
      ashtray: '', // schoon/vuil
      spareWheel: '', // goed/geen/lek
      jack: '', // ja/nee
      wheelBrace: '', // ja/nee
      matKit: '', // ja/nee
      mainKeys: '', // goed/kapot
    },
    exterior: {
      carExterior: '', // vuil/schoon
      hubcaps: '', // LV/LA/RV/RA/geen
      licensePlates: '', // voor/achter
      mirrorCapsLeft: '', // kapot/krassen/goed
      mirrorCapsRight: '', // kapot/krassen/goed
      mirrorGlassLeftRight: '', // goed/kapot
      antenna: '', // goed/kapot/geen
      wiperBlade: '', // goed/kapot
      mudguards: '', // goed/kapot
      slidingDoorBus: '', // goed/kapot/slecht
      indicatorSlots: '', // ja/nee
      fogLights: '', // goed/kapot/geen
    },
    delivery: {
      oilWater: false,
      washerFluid: false,
      lighting: false,
      tireInflation: false,
      fanBelt: false,
      engineBoard: false,
      jackKnife: false,
      allDoorsOpen: false,
      licensePlatePapers: false,
      validGreenCard: false,
      europeanDamageForm: false,
    }
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renterSignatureRef = useRef<HTMLCanvasElement>(null);
  const customerSignatureRef = useRef<HTMLCanvasElement>(null);
  
  // Signature states
  const [isSigningRenter, setIsSigningRenter] = useState(false);
  const [isSigningCustomer, setIsSigningCustomer] = useState(false);
  const [renterSignature, setRenterSignature] = useState<string | null>(null);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);

  // Handle initial vehicle ID from props
  useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId);
    }
  }, [initialVehicleId]);

  // Sync editingCheckId when prop changes
  useEffect(() => {
    if (propEditingCheckId !== undefined) {
      setEditingCheckId(propEditingCheckId);
    }
  }, [propEditingCheckId]);

  // Parse URL params (for when used as standalone page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get('vehicleId');
    const reservationId = params.get('reservationId');
    const checkId = params.get('checkId');
    
    if (vehicleId) {
      setSelectedVehicleId(parseInt(vehicleId));
    }
    if (reservationId) {
      setSelectedReservationId(parseInt(reservationId));
    }
    if (checkId) {
      setEditingCheckId(parseInt(checkId));
    }
  }, []);

  // Load saved check when editing
  useEffect(() => {
    const loadSavedCheck = async () => {
      if (!editingCheckId) return;

      try {
        const response = await fetch(`/api/interactive-damage-checks/${editingCheckId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load damage check');
        }

        const savedCheck = await response.json();
        
        // Populate form fields
        setSelectedVehicleId(savedCheck.vehicleId);
        setSelectedReservationId(savedCheck.reservationId);
        setCheckType(savedCheck.checkType);
        setFuelLevel(savedCheck.fuelLevel || '');
        setMileage(savedCheck.mileage || '');
        setNotes(savedCheck.notes || '');

        // Load damage markers
        if (savedCheck.damageMarkers) {
          const loadedMarkers = typeof savedCheck.damageMarkers === 'string'
            ? JSON.parse(savedCheck.damageMarkers)
            : savedCheck.damageMarkers;
          setMarkers(loadedMarkers || []);
        }

        // Load drawing paths
        if (savedCheck.drawingPaths) {
          const loadedPaths = typeof savedCheck.drawingPaths === 'string'
            ? JSON.parse(savedCheck.drawingPaths)
            : savedCheck.drawingPaths;
          setDrawingPaths(loadedPaths || []);
        }

        // Load checklist data
        if (savedCheck.checklistData) {
          const loadedChecklist = typeof savedCheck.checklistData === 'string'
            ? JSON.parse(savedCheck.checklistData)
            : savedCheck.checklistData;
          setChecklistItems({
            interior: loadedChecklist.interior || checklistItems.interior,
            exterior: loadedChecklist.exterior || checklistItems.exterior,
            delivery: loadedChecklist.delivery || checklistItems.delivery,
          });
        }

        // Load signatures
        if (savedCheck.renterSignature) {
          setRenterSignature(savedCheck.renterSignature);
        }
        if (savedCheck.customerSignature) {
          setCustomerSignature(savedCheck.customerSignature);
        }

        // Load diagram template
        if (savedCheck.diagramTemplateId) {
          const templateResponse = await fetch(`/api/vehicle-diagram-templates/${savedCheck.diagramTemplateId}`);
          if (templateResponse.ok) {
            const template = await templateResponse.json();
            setDiagramTemplate(template);
          }
        }

        toast({
          title: "Check Loaded",
          description: "Damage check loaded successfully for editing",
        });
      } catch (error) {
        console.error('Error loading damage check:', error);
        toast({
          title: "Error",
          description: "Failed to load damage check",
          variant: "destructive",
        });
      }
    };

    loadSavedCheck();
  }, [editingCheckId, toast]);

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
  });

  // Fetch reservations
  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
  });

  // Fetch matching diagram when vehicle is selected
  useEffect(() => {
    const fetchDiagram = async () => {
      if (!selectedVehicleId) return;
      
      try {
        const response = await fetch(`/api/vehicle-diagram-templates/match/${selectedVehicleId}`);
        if (response.ok) {
          const template = await response.json();
          setDiagramTemplate(template);
        } else {
          toast({
            title: "No diagram found",
            description: "No matching vehicle diagram found for this vehicle",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching diagram:", error);
      }
    };

    fetchDiagram();
  }, [selectedVehicleId, toast]);

  // Auto-select vehicle from reservation
  useEffect(() => {
    if (selectedReservationId) {
      const reservation = reservations.find(r => r.id === selectedReservationId);
      if (reservation && reservation.vehicleId) {
        setSelectedVehicleId(reservation.vehicleId);
      }
    }
  }, [selectedReservationId, reservations]);

  // Setup canvas drawing
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !diagramTemplate) return;

    const canvas = canvasRef.current;
    const image = imageRef.current;

    const setupCanvas = () => {
      // Use naturalWidth/naturalHeight for the actual image dimensions
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      redrawCanvas();
    };

    // If image is already loaded, setup immediately
    if (image.complete && image.naturalWidth) {
      setupCanvas();
    }
    
    // Also setup when image loads (for first load)
    image.onload = setupCanvas;
    
    return () => {
      image.onload = null;
    };
  }, [diagramTemplate, markers, drawingPaths]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing paths - convert from percentages to pixels
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    drawingPaths.forEach(path => {
      const points = path.split(' ');
      ctx.beginPath();
      points.forEach((point, i) => {
        const [xPercent, yPercent] = point.split(',').map(Number);
        // Convert percentage (0-1) to pixel coordinates
        const x = xPercent * canvas.width;
        const y = yPercent * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Draw markers - convert from percentages to pixels
    markers.forEach(marker => {
      const markerColor = marker.severity === 'severe' ? '#DC2626' : marker.severity === 'moderate' ? '#F59E0B' : '#10B981';
      
      // Convert percentage coordinates to pixels
      const x = marker.x * canvas.width;
      const y = marker.y * canvas.height;
      
      // Make marker size proportional to canvas size (0.5% of width)
      const markerRadius = Math.max(6, canvas.width * 0.005);
      
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      const fontSize = Math.max(10, markerRadius * 1.2);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((markers.indexOf(marker) + 1).toString(), x, y);
    });
  };

  useEffect(() => {
    redrawCanvas();
  }, [markers, drawingPaths]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Convert click coordinates to percentage (0-1)
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;

    // Check if clicked on existing marker (convert marker percentages to pixels for distance check)
    const clickRadius = 15 / rect.width; // Click radius as percentage
    const clickedMarker = markers.find(m => {
      const dx = m.x - xPercent;
      const dy = m.y - yPercent;
      return Math.sqrt(dx * dx + dy * dy) < clickRadius;
    });

    if (clickedMarker) {
      setSelectedMarker(clickedMarker);
    } else {
      // Add new marker with percentage coordinates
      const newMarker: DamageMarker = {
        id: Date.now().toString(),
        x: xPercent,
        y: yPercent,
        type: 'scratch',
        severity: 'minor',
        notes: '',
      };
      setMarkers([...markers, newMarker]);
      setSelectedMarker(newMarker);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Convert to percentage coordinates (0-1)
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;
    setCurrentPath(`${xPercent},${yPercent}`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Convert to percentage coordinates (0-1)
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;
    setCurrentPath(prev => `${prev} ${xPercent},${yPercent}`);

    // Draw preview - convert percentages to pixels for display
    const ctx = canvas.getContext('2d');
    if (ctx) {
      redrawCanvas();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      const points = (currentPath + ` ${xPercent},${yPercent}`).split(' ');
      ctx.beginPath();
      points.forEach((point, i) => {
        const [pxPercent, pyPercent] = point.split(',').map(Number);
        const px = pxPercent * canvas.width;
        const py = pyPercent * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentPath) return;
    setDrawingPaths([...drawingPaths, currentPath]);
    setCurrentPath("");
  };

  const updateMarker = (updates: Partial<DamageMarker>) => {
    if (!selectedMarker) return;
    const updated = markers.map(m => 
      m.id === selectedMarker.id ? { ...m, ...updates } : m
    );
    setMarkers(updated);
    setSelectedMarker(updated.find(m => m.id === selectedMarker.id) || null);
  };

  const deleteMarker = (markerId: string) => {
    setMarkers(markers.filter(m => m.id !== markerId));
    if (selectedMarker?.id === markerId) {
      setSelectedMarker(null);
    }
  };

  const clearDrawings = () => {
    setDrawingPaths([]);
  };

  // Signature handling
  const setupSignatureCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>, setIsSigning: (val: boolean) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // Higher resolution
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as MouseEvent).clientX - rect.left;
      const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as MouseEvent).clientY - rect.top;
      lastX = x;
      lastY = y;
    };
    
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as MouseEvent).clientX - rect.left;
      const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as MouseEvent).clientY - rect.top;
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      lastX = x;
      lastY = y;
    };
    
    const stopDrawing = () => {
      isDrawing = false;
    };
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  };
  
  const clearSignature = (canvasRef: React.RefObject<HTMLCanvasElement>, setSignature: (val: string | null) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };
  
  const saveSignature = (canvasRef: React.RefObject<HTMLCanvasElement>, setSignature: (val: string | null) => void, setIsSigning: (val: boolean) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setSignature(dataUrl);
    setIsSigning(false);
  };

  const handleSave = async () => {
    if (!selectedVehicleId || !diagramTemplate) {
      toast({
        title: "Validation Error",
        description: "Please select a vehicle",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Convert canvas to base64 image
      const canvas = canvasRef.current;
      let diagramWithAnnotations = "";
      
      if (canvas && imageRef.current) {
        // Create a temporary canvas with the background image and annotations
        const tempCanvas = document.createElement('canvas');
        const img = imageRef.current;
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          // Draw background image
          tempCtx.drawImage(img, 0, 0);
          
          // Draw annotations from main canvas
          tempCtx.drawImage(canvas, 0, 0);
          
          diagramWithAnnotations = tempCanvas.toDataURL('image/png');
        }
      }

      const checkData = {
        vehicleId: selectedVehicleId,
        reservationId: selectedReservationId,
        checkType,
        checkDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
        diagramTemplateId: diagramTemplate.id,
        damageMarkers: JSON.stringify(markers),
        drawingPaths: JSON.stringify(drawingPaths),
        diagramWithAnnotations,
        fuelLevel: fuelLevel || null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes || null,
        checklistData: JSON.stringify(checklistItems),
        renterSignature: renterSignature || null,
        customerSignature: customerSignature || null,
      };

      // Use PUT for update, POST for create
      if (editingCheckId) {
        await apiRequest('PUT', `/api/interactive-damage-checks/${editingCheckId}`, checkData);
        toast({
          title: "Success",
          description: "Damage check updated successfully",
        });
      } else {
        await apiRequest('POST', '/api/interactive-damage-checks', checkData);
        toast({
          title: "Success",
          description: "Damage check saved successfully",
        });
      }

      if (onClose) {
        onClose();
      } else {
        navigate('/documents');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save damage check",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Interactive Damage Check</h1>
            <p className="text-gray-600 mt-1">iPad-optimized damage inspection interface</p>
          </div>
          <Button variant="outline" onClick={() => onClose ? onClose() : navigate('/documents')} data-testid="button-close">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        {/* Vehicle Selection - Full Width */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Vehicle *</Label>
              <Select 
                value={selectedVehicleId?.toString() || ""} 
                onValueChange={(val) => setSelectedVehicleId(parseInt(val))}
              >
                <SelectTrigger data-testid="select-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                      {displayLicensePlate(vehicle.licensePlate)} - {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reservation (Optional)</Label>
              <Select 
                value={selectedReservationId?.toString() || "none"} 
                onValueChange={(val) => setSelectedReservationId(val === "none" ? null : parseInt(val))}
              >
                <SelectTrigger data-testid="select-reservation">
                  <SelectValue placeholder="Link to reservation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Reservation</SelectItem>
                  {reservations.map(reservation => (
                    <SelectItem key={reservation.id} value={reservation.id.toString()}>
                      #{reservation.id} - Reservation
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Check Type</Label>
              <Select value={checkType} onValueChange={(val: any) => setCheckType(val)}>
                <SelectTrigger data-testid="select-check-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup Inspection</SelectItem>
                  <SelectItem value="return">Return Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleSave}
                disabled={isSaving || !selectedVehicleId || !diagramTemplate}
                className="w-full"
                data-testid="button-save-check"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Check'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Diagram Canvas - Full Width */}
        <Card className="p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">
              {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Vehicle Diagram'}
            </h3>
            <div className="flex gap-2">
              <Button 
                variant={isDrawing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsDrawing(!isDrawing)}
                data-testid="button-toggle-drawing"
              >
                {isDrawing ? <Eraser className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                {isDrawing ? 'Stop Drawing' : 'Draw'}
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={clearDrawings}
                disabled={drawingPaths.length === 0}
                data-testid="button-clear-drawings"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Drawings
              </Button>
            </div>
          </div>

          {diagramTemplate ? (
            <div ref={containerRef} className="relative bg-white border rounded-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              <div className="relative w-full">
                <img 
                  ref={imageRef}
                  src={`/${diagramTemplate.diagramPath}`}
                  alt="Vehicle diagram"
                  className="w-full h-auto"
                  crossOrigin="anonymous"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 cursor-crosshair w-full"
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  data-testid="damage-canvas"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">Select a vehicle to load the diagram</p>
              <p className="text-sm mt-2">Vehicle diagrams can be added in Documents → Damage Check → Diagram Templates</p>
            </div>
          )}

          {markers.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Damage Points ({markers.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {markers.map((marker, index) => (
                  <div 
                    key={marker.id}
                    className={`p-2 rounded cursor-pointer ${selectedMarker?.id === marker.id ? 'bg-blue-100' : 'bg-white'}`}
                    onClick={() => setSelectedMarker(marker)}
                    data-testid={`marker-summary-${index}`}
                  >
                    <span className="font-medium">#{index + 1}</span> - {marker.type}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Inspection Checklist - Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Interior */}
          <Card className="p-4">
            <h3 className="font-bold text-center text-lg mb-4 bg-blue-900 text-white py-2 rounded">Interieur</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Binnenzijde auto</span>
                <Select value={checklistItems.interior.carInterior} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, carInterior: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="schoon">schoon</SelectItem><SelectItem value="vuil">vuil</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Vloermatten</span>
                <Select value={checklistItems.interior.floorMats} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, floorMats: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">ja</SelectItem><SelectItem value="nee">nee</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Bekleding</span>
                <Select value={checklistItems.interior.upholstery} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, upholstery: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="kapot">kapot</SelectItem><SelectItem value="heel">heel</SelectItem><SelectItem value="brandgaten">brandgaten</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Asbak</span>
                <Select value={checklistItems.interior.ashtray} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, ashtray: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="schoon">schoon</SelectItem><SelectItem value="vuil">vuil</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Reservewiel</span>
                <Select value={checklistItems.interior.spareWheel} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, spareWheel: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="geen">geen</SelectItem><SelectItem value="lek">lek</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Krik</span>
                <Select value={checklistItems.interior.jack} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, jack: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">ja</SelectItem><SelectItem value="nee">nee</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Wielsleutel</span>
                <Select value={checklistItems.interior.wheelBrace} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, wheelBrace: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">ja</SelectItem><SelectItem value="nee">nee</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Matten</span>
                <Select value={checklistItems.interior.matKit} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, matKit: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">ja</SelectItem><SelectItem value="nee">nee</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Hoofdsteunen</span>
                <Select value={checklistItems.interior.mainKeys} onValueChange={(val) => setChecklistItems({...checklistItems, interior: {...checklistItems.interior, mainKeys: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Exterior */}
          <Card className="p-4">
            <h3 className="font-bold text-center text-lg mb-4 bg-blue-900 text-white py-2 rounded">Exterieur</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Buitenzijde auto</span>
                <Select value={checklistItems.exterior.carExterior} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, carExterior: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="vuil">vuil</SelectItem><SelectItem value="schoon">schoon</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Wieldoppen</span>
                <Select value={checklistItems.exterior.hubcaps} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, hubcaps: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="LV">LV</SelectItem><SelectItem value="LA">LA</SelectItem><SelectItem value="RV">RV</SelectItem><SelectItem value="RA">RA</SelectItem><SelectItem value="geen">geen</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Kentekemplaten</span>
                <Select value={checklistItems.exterior.licensePlates} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, licensePlates: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="voor">voor</SelectItem><SelectItem value="achter">achter</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Spiegelkap links</span>
                <Select value={checklistItems.exterior.mirrorCapsLeft} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, mirrorCapsLeft: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="kapot">kapot</SelectItem><SelectItem value="krassen">krassen</SelectItem><SelectItem value="goed">goed</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Spiegelkap rechts</span>
                <Select value={checklistItems.exterior.mirrorCapsRight} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, mirrorCapsRight: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="kapot">kapot</SelectItem><SelectItem value="krassen">krassen</SelectItem><SelectItem value="goed">goed</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Spiegelglas L+R</span>
                <Select value={checklistItems.exterior.mirrorGlassLeftRight} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, mirrorGlassLeftRight: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Antenne</span>
                <Select value={checklistItems.exterior.antenna} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, antenna: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem><SelectItem value="geen">geen</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Ruitenwisser</span>
                <Select value={checklistItems.exterior.wiperBlade} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, wiperBlade: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Deurvanger</span>
                <Select value={checklistItems.exterior.mudguards} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, mudguards: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Schuifdeur (bus)</span>
                <Select value={checklistItems.exterior.slidingDoorBus} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, slidingDoorBus: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem><SelectItem value="slecht">slecht</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Werkende sloten</span>
                <Select value={checklistItems.exterior.indicatorSlots} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, indicatorSlots: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">ja</SelectItem><SelectItem value="nee">nee</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span>Mistlampen voor</span>
                <Select value={checklistItems.exterior.fogLights} onValueChange={(val) => setChecklistItems({...checklistItems, exterior: {...checklistItems.exterior, fogLights: val}})}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent><SelectItem value="goed">goed</SelectItem><SelectItem value="kapot">kapot</SelectItem><SelectItem value="geen">geen</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Delivery Check */}
          <Card className="p-4">
            <h3 className="font-bold text-center text-lg mb-4 bg-blue-900 text-white py-2 rounded">Aflever Check</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.oilWater} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, oilWater: e.target.checked}})} className="w-4 h-4" />
                <span>Olie - water</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.washerFluid} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, washerFluid: e.target.checked}})} className="w-4 h-4" />
                <span>Ruitenproeiervloeistof</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.lighting} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, lighting: e.target.checked}})} className="w-4 h-4" />
                <span>Verlichting</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.tireInflation} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, tireInflation: e.target.checked}})} className="w-4 h-4" />
                <span>Bandenspanning incl. reservewiel</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.fanBelt} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, fanBelt: e.target.checked}})} className="w-4 h-4" />
                <span>Kachelfan</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.engineBoard} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, engineBoard: e.target.checked}})} className="w-4 h-4" />
                <span>Hoedenplank</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.jackKnife} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, jackKnife: e.target.checked}})} className="w-4 h-4" />
                <span>IJskrabber</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.allDoorsOpen} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, allDoorsOpen: e.target.checked}})} className="w-4 h-4" />
                <span>Gaan alle deuren open</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.licensePlatePapers} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, licensePlatePapers: e.target.checked}})} className="w-4 h-4" />
                <span>Kentekenpapieren <span className="text-xs">(eventueel kopie)</span></span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.validGreenCard} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, validGreenCard: e.target.checked}})} className="w-4 h-4" />
                <span>Geldige groene kaart</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={checklistItems.delivery.europeanDamageForm} onChange={(e) => setChecklistItems({...checklistItems, delivery: {...checklistItems.delivery, europeanDamageForm: e.target.checked}})} className="w-4 h-4" />
                <span>Europees schadeformulier</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Information - Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Vehicle Details</h3>
            <div className="space-y-4">
              <div>
                <Label>Fuel Level</Label>
                <Input 
                  placeholder="e.g., 3/4, 50%" 
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(e.target.value)}
                  data-testid="input-fuel-level"
                />
              </div>

              <div>
                <Label>Mileage</Label>
                <Input 
                  type="number" 
                  placeholder="Current mileage" 
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  data-testid="input-mileage"
                />
              </div>

              <div>
                <Label>General Notes</Label>
                <Textarea 
                  placeholder="Add general observations..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          </Card>

          {selectedMarker && (
            <Card className="p-4 md:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">
                  Damage Point #{markers.indexOf(selectedMarker) + 1}
                </h3>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteMarker(selectedMarker.id)}
                  data-testid="button-delete-marker"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Damage Type</Label>
                  <Select 
                    value={selectedMarker.type} 
                    onValueChange={(val: any) => updateMarker({ type: val })}
                  >
                    <SelectTrigger data-testid="select-damage-type">
                      <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scratch">Scratch</SelectItem>
                        <SelectItem value="dent">Dent</SelectItem>
                        <SelectItem value="crack">Crack</SelectItem>
                        <SelectItem value="missing">Missing Part</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Severity</Label>
                    <Select 
                      value={selectedMarker.severity} 
                      onValueChange={(val: any) => updateMarker({ severity: val })}
                    >
                      <SelectTrigger data-testid="select-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea 
                      placeholder="Describe the damage..." 
                      value={selectedMarker.notes}
                      onChange={(e) => updateMarker({ notes: e.target.value })}
                      rows={3}
                      data-testid="textarea-marker-notes"
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>

        {/* Signatures Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Renter Signature */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Renter Signature</h3>
            {renterSignature ? (
              <div>
                <img src={renterSignature} alt="Renter signature" className="border rounded h-32 w-full object-contain bg-white" />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => clearSignature(renterSignatureRef, setRenterSignature)}
                  className="mt-2"
                  data-testid="button-clear-renter-signature"
                >
                  Clear Signature
                </Button>
              </div>
            ) : (
              <div>
                <canvas
                  ref={renterSignatureRef}
                  className="border rounded h-32 w-full bg-white cursor-crosshair"
                  onMouseEnter={() => !isSigningRenter && setupSignatureCanvas(renterSignatureRef, setIsSigningRenter)}
                  onTouchStart={() => !isSigningRenter && setupSignatureCanvas(renterSignatureRef, setIsSigningRenter)}
                  data-testid="canvas-renter-signature"
                />
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => clearSignature(renterSignatureRef, setRenterSignature)}
                    data-testid="button-clear-renter-canvas"
                  >
                    Clear
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => saveSignature(renterSignatureRef, setRenterSignature, setIsSigningRenter)}
                    data-testid="button-save-renter-signature"
                  >
                    Save Signature
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Customer Signature */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Customer Signature</h3>
            {customerSignature ? (
              <div>
                <img src={customerSignature} alt="Customer signature" className="border rounded h-32 w-full object-contain bg-white" />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => clearSignature(customerSignatureRef, setCustomerSignature)}
                  className="mt-2"
                  data-testid="button-clear-customer-signature"
                >
                  Clear Signature
                </Button>
              </div>
            ) : (
              <div>
                <canvas
                  ref={customerSignatureRef}
                  className="border rounded h-32 w-full bg-white cursor-crosshair"
                  onMouseEnter={() => !isSigningCustomer && setupSignatureCanvas(customerSignatureRef, setIsSigningCustomer)}
                  onTouchStart={() => !isSigningCustomer && setupSignatureCanvas(customerSignatureRef, setIsSigningCustomer)}
                  data-testid="canvas-customer-signature"
                />
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => clearSignature(customerSignatureRef, setCustomerSignature)}
                    data-testid="button-clear-customer-canvas"
                  >
                    Clear
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => saveSignature(customerSignatureRef, setCustomerSignature, setIsSigningCustomer)}
                    data-testid="button-save-customer-signature"
                  >
                    Save Signature
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

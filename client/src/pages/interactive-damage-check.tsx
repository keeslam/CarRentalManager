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

export default function InteractiveDamageCheck() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
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
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get('vehicleId');
    const reservationId = params.get('reservationId');
    
    if (vehicleId) {
      setSelectedVehicleId(parseInt(vehicleId));
    }
    if (reservationId) {
      setSelectedReservationId(parseInt(reservationId));
    }
  }, []);

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

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      redrawCanvas();
    };
  }, [diagramTemplate]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing paths
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    drawingPaths.forEach(path => {
      const points = path.split(' ');
      ctx.beginPath();
      points.forEach((point, i) => {
        const [x, y] = point.split(',').map(Number);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Draw markers
    markers.forEach(marker => {
      const markerColor = marker.severity === 'severe' ? '#DC2626' : marker.severity === 'moderate' ? '#F59E0B' : '#10B981';
      
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((markers.indexOf(marker) + 1).toString(), marker.x, marker.y);
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on existing marker
    const clickedMarker = markers.find(m => 
      Math.sqrt(Math.pow(m.x - x, 2) + Math.pow(m.y - y, 2)) < 15
    );

    if (clickedMarker) {
      setSelectedMarker(clickedMarker);
    } else {
      // Add new marker
      const newMarker: DamageMarker = {
        id: Date.now().toString(),
        x,
        y,
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath(`${x},${y}`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath(prev => `${prev} ${x},${y}`);

    // Draw preview
    const ctx = canvas.getContext('2d');
    if (ctx) {
      redrawCanvas();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      const points = (currentPath + ` ${x},${y}`).split(' ');
      ctx.beginPath();
      points.forEach((point, i) => {
        const [px, py] = point.split(',').map(Number);
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
        checkDate: new Date().toISOString(),
        diagramTemplateId: diagramTemplate.id,
        damageMarkers: JSON.stringify(markers),
        drawingPaths: JSON.stringify(drawingPaths),
        diagramWithAnnotations,
        fuelLevel: fuelLevel || null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes || null,
      };

      await apiRequest('POST', '/api/interactive-damage-checks', checkData);

      toast({
        title: "Success",
        description: "Damage check saved successfully",
      });

      navigate('/documents');
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Interactive Damage Check</h1>
            <p className="text-gray-600 mt-1">iPad-optimized damage inspection interface</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/documents')} data-testid="button-close">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Selection and Details */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Vehicle Selection</h3>
              
              <div className="space-y-4">
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
                    value={selectedReservationId?.toString() || ""} 
                    onValueChange={(val) => setSelectedReservationId(val ? parseInt(val) : null)}
                  >
                    <SelectTrigger data-testid="select-reservation">
                      <SelectValue placeholder="Link to reservation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Reservation</SelectItem>
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
              <Card className="p-4">
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

                <div className="space-y-3">
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

          {/* Center/Right Panel - Diagram Canvas */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">
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
                  <Button 
                    onClick={handleSave}
                    disabled={isSaving || !selectedVehicleId || !diagramTemplate}
                    data-testid="button-save-check"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Check'}
                  </Button>
                </div>
              </div>

              {diagramTemplate ? (
                <div ref={containerRef} className="relative bg-white border rounded-lg overflow-auto max-h-[70vh]">
                  <div className="relative inline-block">
                    <img 
                      ref={imageRef}
                      src={`/${diagramTemplate.diagramPath}`}
                      alt="Vehicle diagram"
                      className="max-w-full h-auto"
                      crossOrigin="anonymous"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair"
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
                  <div className="space-y-1 text-sm">
                    {markers.map((marker, index) => (
                      <div 
                        key={marker.id}
                        className={`p-2 rounded cursor-pointer ${selectedMarker?.id === marker.id ? 'bg-blue-100' : 'bg-white'}`}
                        onClick={() => setSelectedMarker(marker)}
                        data-testid={`marker-summary-${index}`}
                      >
                        <span className="font-medium">#{index + 1}</span> - {marker.type} ({marker.severity})
                        {marker.notes && <span className="text-gray-600 ml-2">- {marker.notes.substring(0, 30)}...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

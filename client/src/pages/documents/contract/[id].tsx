import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ContractViewer() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Load the contract PDF when the component mounts
  useEffect(() => {
    if (!id) return;

    const fetchContract = async () => {
      setLoading(true);
      try {
        // Create a direct URL to the API endpoint for PDF generation
        const response = await fetch(`/api/contracts/generate/${id}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contract: ${response.statusText}`);
        }

        // Get the PDF as a blob
        const blob = await response.blob();
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Error fetching contract:', error);
        toast({
          title: 'Error',
          description: 'Failed to load the rental contract. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContract();

    // Clean up the object URL when the component unmounts
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [id, toast]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Rental Contract</h1>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setLocation('/reservations')}
            variant="outline"
          >
            Back to Reservations
          </Button>
          {pdfUrl && (
            <Button 
              onClick={() => {
                // Open PDF in a new tab for printing
                window.open(pdfUrl, '_blank');
              }}
            >
              Print Contract
            </Button>
          )}
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Rental Contract</CardTitle>
          <CardDescription>
            Rental contract for reservation #{id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading contract...</span>
            </div>
          ) : pdfUrl ? (
            <div className="w-full aspect-[1/1.414] bg-gray-100 overflow-hidden rounded-md">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full"
                title="Rental Contract"
              />
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-lg text-gray-500">
                Failed to load the contract. Please try again.
              </p>
              <Button 
                onClick={() => setLocation(`/reservations/${id}`)}
                variant="outline"
                className="mt-4"
              >
                View Reservation Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
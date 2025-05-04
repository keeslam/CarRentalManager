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
            className="flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Back to Reservations
          </Button>
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
            <div className="w-full flex flex-col items-center justify-center py-10">
              <p className="mb-6 text-center text-gray-600">
                Contract successfully loaded but cannot be displayed inline due to browser security restrictions.
              </p>
              <div className="flex space-x-4">
                <Button 
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  View Contract
                </Button>
                <Button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = pdfUrl;
                    link.download = `rental_contract_${id}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  variant="outline"
                  className="flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Contract
                </Button>
              </div>
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
'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const IPFSStatus = () => {
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    // Check if Pinata credentials are available
    const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
    const secretKey = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
    setHasCredentials(!!(apiKey && secretKey));
  }, []);

  if (hasCredentials) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">IPFS Ready</span>
            <span className="text-green-600 text-sm">Pinata configured</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <div className="text-red-800 font-medium mb-2">IPFS Configuration Required</div>
            <div className="text-red-700 text-sm space-y-1">
              <p><strong>Token creation will fail</strong> without IPFS setup:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  <a 
                    href="https://pinata.cloud" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-red-800 underline hover:text-red-900 inline-flex items-center"
                  >
                    Sign up at Pinata.cloud <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </li>
                <li>Get your API keys from the dashboard</li>
                <li>Add them to your <code className="bg-red-100 px-1 rounded">.env.local</code> file</li>
                <li>Restart your development server</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

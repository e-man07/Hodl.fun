import Link from 'next/link';
import { FileQuestion, Home, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page Not Found | Hodl.fun',
  description: 'The page you are looking for does not exist or has been moved.',
};

export default function NotFound() {
  return (
    <div className="container py-16 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>

      <h1 className="text-3xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-muted-foreground text-center mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or navigate back to explore tokens.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link href="/launch">
            <Rocket className="h-4 w-4" />
            Launch a Token
          </Link>
        </Button>
      </div>
    </div>
  );
}

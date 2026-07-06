import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-5xl font-semibold text-muted-foreground">404</p>
          <h1 className="text-lg font-semibold">Page introuvable</h1>
          <p className="text-sm text-muted-foreground">
            Cette page n&apos;existe pas ou a été déplacée.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/">Accueil</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

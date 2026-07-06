import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComingSoonModuleProps {
  title: string;
  description: string;
  features?: string[];
}

export function ComingSoonModule({ title, description, features }: ComingSoonModuleProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <Badge variant="secondary">Bientôt disponible</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Disponible aujourd&apos;hui</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Relancez vos clients un par un via WhatsApp depuis la liste Clients — message
            personnalisé, prêt à envoyer en 1 clic.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/clients?nouveau=1">
                Ajouter un client
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/clients">Voir mes clients</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {features && features.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature} className="border-dashed border-border/60">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <span className="text-sm text-muted-foreground">{feature}</span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  Prochainement
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!features && (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[160px] flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ce module est en cours de développement.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nous vous préviendrons dès qu&apos;il sera activé sur votre compte.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function WelcomeBanner() {
  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-transparent animate-slide-up">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">Votre CRM est prêt 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez votre premier client pour voir la valeur en moins de 2 minutes. Ensuite,
            relancez-le en 1 clic via WhatsApp.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

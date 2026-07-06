import { X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const problems = [
  'Clients perdus après une seule visite',
  'Relances WhatsApp oubliées ou manuelles',
  'Aucune visibilité sur qui revient vraiment',
];

const solutions = [
  'CRM clients centralisé en 2 minutes',
  'Relances WhatsApp en 1 clic',
  'Segments actif / inactif automatiques',
];

export function ProblemSolutionSection() {
  return (
    <section id="solution" className="border-t border-border/40 px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-8">
            <p className="text-sm font-medium text-destructive">Sans Loyala</p>
            <ul className="mt-6 space-y-4">
              {problems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 shadow-glow">
          <CardContent className="p-8">
            <p className="text-sm font-medium text-primary">Avec Loyala AI</p>
            <ul className="mt-6 space-y-4">
              {solutions.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

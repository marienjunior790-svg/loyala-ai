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
    <section id="solution" className="scroll-mt-28 px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-destructive/10 via-transparent to-transparent">
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
        <Card className="glass-liquid bg-gradient-to-br from-primary/15 via-transparent to-transparent shadow-glow">
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

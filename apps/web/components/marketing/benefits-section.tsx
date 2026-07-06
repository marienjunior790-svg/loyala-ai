import { Users, MessageCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const benefits = [
  {
    icon: Users,
    title: 'Fichier clients unifié',
    description: 'Tous vos contacts au même endroit. Fini les numéros éparpillés dans 3 téléphones.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp qui travaille',
    description: 'Relancez un client inactif en 1 clic. Message personnalisé, prêt à envoyer.',
  },
  {
    icon: TrendingUp,
    title: 'ROI visible',
    description: '1 client qui revient = le mois payé. Voyez qui relancer en priorité.',
  },
];

export function BenefitsSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Conçu pour générer du revenu</h2>
          <p className="mt-4 text-muted-foreground">
            Chaque écran répond à une question : comment ramener plus de clients ce soir ?
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-border/60 bg-card/50 transition hover:border-primary/30">
              <CardContent className="p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-6 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

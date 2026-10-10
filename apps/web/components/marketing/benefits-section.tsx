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
            <Card
              key={title}
              className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
            >
              <CardContent className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/25 transition-shadow group-hover:shadow-glow">
                  <Icon className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
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

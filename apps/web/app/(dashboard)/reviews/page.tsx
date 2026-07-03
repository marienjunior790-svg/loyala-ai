import { Star } from 'lucide-react';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';
import { Card, CardContent } from '@/components/ui/card';

export default function ReviewsPage() {
  return (
    <SectionPlaceholder
      title="Avis Google"
      description="Centralisez vos avis, répondez rapidement et améliorez votre e-réputation."
      badge="Sprint 2"
    >
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-3xl font-semibold">4,6 / 5</p>
          <p className="text-sm text-muted-foreground">Score moyen — données démo</p>
        </CardContent>
      </Card>
    </SectionPlaceholder>
  );
}

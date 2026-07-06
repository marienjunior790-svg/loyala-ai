import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionPlaceholderProps {
  title: string;
  description: string;
  badge?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SectionPlaceholder({
  title,
  description,
  badge = 'Bientôt',
  children,
  className,
}: SectionPlaceholderProps) {
  return (
    <div className={cn('space-y-6 animate-fade-in', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <Badge variant="secondary">{badge}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ?? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Module en cours de développement — disponible prochainement.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { sanitizeUserErrorMessage } from '@/lib/errors/sanitize';

export function ModuleError({ message }: { message: string }) {
  const safeMessage = sanitizeUserErrorMessage(message);

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 text-sm text-destructive">
        <p className="font-medium">Module indisponible</p>
        <p className="mt-1">{safeMessage}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Vérifiez que les migrations Supabase sont appliquées ou contactez le support Loyala.
        </p>
      </CardContent>
    </Card>
  );
}

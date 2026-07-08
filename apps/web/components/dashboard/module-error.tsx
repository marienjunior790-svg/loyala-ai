import { Card, CardContent } from '@/components/ui/card';

/** Surfaces the real error — never replace it with a generic placeholder. */
export function ModuleError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 text-sm text-destructive">
        <p className="font-medium">Module indisponible</p>
        <p className="mt-1 break-words">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Vérifiez que les migrations Supabase sont appliquées ou contactez le support Loyala.
        </p>
      </CardContent>
    </Card>
  );
}

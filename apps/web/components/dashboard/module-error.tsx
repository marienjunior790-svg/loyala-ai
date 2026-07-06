import { Card, CardContent } from '@/components/ui/card';

export function ModuleError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 text-sm text-destructive">
        <p className="font-medium">Module indisponible</p>
        <p className="mt-1 font-mono text-xs">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Appliquez la migration <code>012_platform_modules.sql</code> sur Supabase si nécessaire.
        </p>
      </CardContent>
    </Card>
  );
}

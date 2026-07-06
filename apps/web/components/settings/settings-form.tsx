'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateOrganizationSettingsAction, type SettingsActionState } from '@/app/(dashboard)/settings/_actions/settings';
import type { Organization } from '@loyala/domain-crm';

const initial: SettingsActionState = {};

export function SettingsForm({ org }: { org: Organization }) {
  const [state, action, pending] = useActionState(updateOrganizationSettingsAction, initial);
  const whatsappPhone = String((org.settings as Record<string, unknown>)?.whatsapp_phone ?? '');

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Nom du restaurant</label>
            <Input name="name" defaultValue={org.name} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">WhatsApp (relances)</label>
            <Input
              name="whatsappPhone"
              defaultValue={whatsappPhone}
              placeholder="065719922"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Logo (Supabase Storage)</label>
            <Input name="logo" type="file" accept="image/*" className="mt-1" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
        </CardContent>
      </Card>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  createReviewAction,
  respondReviewAction,
  type ReviewActionState,
} from '@/app/(dashboard)/reviews/_actions/reviews';
import type { Review } from '@loyala/domain-crm';

const initial: ReviewActionState = {};

interface ReviewsPageClientProps {
  reviews: Review[];
  summary: { count: number; averageRating: number; pendingResponses: number };
}

export function ReviewsPageClient({ reviews, summary }: ReviewsPageClientProps) {
  const [createState, createAction, createPending] = useActionState(createReviewAction, initial);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Note moyenne</p>
            <p className="text-3xl font-semibold">{summary.averageRating.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total avis</p>
            <p className="text-3xl font-semibold">{summary.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sans réponse</p>
            <p className="text-3xl font-semibold">{summary.pendingResponses}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un avis (manuel / Google)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="authorName" placeholder="Nom du client" required />
            <Input name="rating" type="number" min={1} max={5} placeholder="Note 1-5" required />
            <textarea
              name="content"
              required
              placeholder="Contenu de l'avis..."
              className="sm:col-span-2 min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={createPending}>
              Enregistrer
            </Button>
            {createState.error && <p className="text-sm text-destructive">{createState.error}</p>}
            {createState.success && <p className="text-sm text-emerald-400">{createState.success}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [state, action, pending] = useActionState(
    respondReviewAction.bind(null, review.id),
    initial
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">{review.author_name}</p>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{review.rating}/5</span>
            <Badge variant="outline" className="ml-2">{review.source}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{review.content}</p>
        {review.response_text ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">{review.response_text}</p>
        ) : (
          <form action={action} className="space-y-2">
            <textarea
              name="responseText"
              defaultValue={`Merci ${review.author_name} pour votre avis !`}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={3}
            />
            <Button type="submit" size="sm" disabled={pending}>
              Publier la réponse
            </Button>
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

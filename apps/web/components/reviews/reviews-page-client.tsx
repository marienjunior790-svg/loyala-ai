'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Star, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  createReviewAction,
  respondReviewAction,
  suggestReviewResponseAction,
  type ReviewActionState,
} from '@/app/(dashboard)/reviews/_actions/reviews';
import type { Review } from '@loyala/domain-crm';

const initial: ReviewActionState = {};

interface ReviewsPageClientProps {
  reviews: Review[];
  summary: { count: number; averageRating: number; pendingResponses: number };
  googleReviewUrl: string;
  autoRequestEnabled: boolean;
}

export function ReviewsPageClient({
  reviews,
  summary,
  googleReviewUrl,
  autoRequestEnabled,
}: ReviewsPageClientProps) {
  const [createState, createAction, createPending] = useActionState(createReviewAction, initial);
  const configured = Boolean(googleReviewUrl);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Automatisation avis Google</p>
              {configured && autoRequestEnabled ? (
                <p className="mt-1">
                  Après chaque visite, WhatsApp s’ouvre avec un message demandant un avis sur Google
                  (client avec téléphone + opt-in). Les réponses IA restent à valider avant
                  publication.
                </p>
              ) : configured ? (
                <p className="mt-1">
                  Lien Google configuré, mais la demande auto après visite est désactivée dans
                  Paramètres.
                </p>
              ) : (
                <p className="mt-1">
                  Ajoutez votre lien « Écrire un avis » Google dans Paramètres pour activer la
                  demande WhatsApp automatique après chaque visite.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {configured && (
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Voir le lien
                </a>
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link href="/settings">Paramètres</Link>
            </Button>
          </div>
        </div>
      </div>

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
          <CardTitle>Ajouter un avis</CardTitle>
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
        {reviews.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun avis pour le moment. Demandez-en via WhatsApp après les visites, ou saisissez-les
              ici.
            </CardContent>
          </Card>
        ) : (
          reviews.map((r, index) => (
            <ReviewCard
              key={r.id}
              review={r}
              autoSuggest={!r.response_text && index === reviews.findIndex((x) => !x.response_text)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, autoSuggest }: { review: Review; autoSuggest?: boolean }) {
  const [state, action, pending] = useActionState(
    respondReviewAction.bind(null, review.id),
    initial
  );
  const [draft, setDraft] = useState('');
  const [aiPending, startAi] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  function handleSuggestAi() {
    setAiError(null);
    startAi(async () => {
      const result = await suggestReviewResponseAction(
        review.rating,
        review.content,
        review.author_name
      );
      if (result.error) setAiError(result.error);
      else if (result.text) setDraft(result.text);
    });
  }

  useEffect(() => {
    if (!autoSuggest || autoTried || review.response_text) return;
    setAutoTried(true);
    handleSuggestAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto draft
  }, [autoSuggest, autoTried, review.response_text]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">{review.author_name}</p>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{review.rating}/5</span>
            <Badge variant="outline" className="ml-2">
              {review.source}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{review.content}</p>
        {review.response_text ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">{review.response_text}</p>
        ) : (
          <form action={action} className="space-y-2">
            <textarea
              name="responseText"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={aiPending ? 'Brouillon IA en cours…' : 'Votre réponse au client...'}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={3}
              required
              minLength={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={aiPending} onClick={handleSuggestAi}>
                <Sparkles className="mr-1 h-3 w-3" />
                {aiPending ? 'IA...' : 'Régénérer avec IA'}
              </Button>
              <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
                Publier la réponse
              </Button>
            </div>
            {aiError && <p className="text-xs text-destructive">{aiError}</p>}
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

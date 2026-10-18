'use client';

import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquarePlus,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MiInsightsPanel, MiPeriodChip } from '@/components/mi/mi-insights-panel';
import {
  postMiChat,
  type MiChatApiPeriod,
  type MiChatApiSuccess,
  MI_MESSAGE_MAX,
} from '@/lib/mi/api-client';
import {
  localHistoryNotice,
  MI_PERIODS,
  periodLabel,
  suggestionsFor,
  type MiLocale,
  type MiPeriod,
} from '@/lib/mi/ui-copy';
import { cn } from '@/lib/utils';

type ThreadItem =
  | { id: string; kind: 'user'; content: string }
  | {
      id: string;
      kind: 'assistant';
      content: string;
      dataQuality: MiChatApiSuccess['dataQuality'] | null;
      period: MiChatApiPeriod | null;
      insights: Record<string, unknown> | null;
      toolsUsed: string[];
      intent: string | null;
    }
  | { id: string; kind: 'error'; content: string; status: number | null };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MarketingIntelligenceClient({
  initialLocale = 'fr',
}: {
  initialLocale?: MiLocale;
}) {
  const formId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [locale, setLocale] = useState<MiLocale>(initialLocale);
  const [period, setPeriod] = useState<MiPeriod>('mois');
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<MiChatApiSuccess | null>(null);

  const fr = locale !== 'en';
  const suggestions = suggestionsFor(locale);
  const isEmpty = thread.length === 0;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread, pending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const historyForApi = useCallback(() => {
    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const item of thread) {
      if (item.kind === 'user') turns.push({ role: 'user', content: item.content });
      if (item.kind === 'assistant') turns.push({ role: 'assistant', content: item.content });
    }
    return turns;
  }, [thread]);

  const ask = useCallback(
    async (rawMessage: string, opts?: { retry?: boolean }) => {
      const message = rawMessage.trim();
      if (!message || pending) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!opts?.retry) {
        setThread((prev) => [...prev, { id: uid(), kind: 'user', content: message }]);
      }
      setLastUserMessage(message);
      setInput('');
      setPending(true);

      const history = opts?.retry
        ? historyForApi().filter((_, i, arr) => {
            // Sur retry : garder l’historique avant le dernier user (déjà présent)
            if (i === arr.length - 1 && arr[i]?.role === 'user') return false;
            return true;
          })
        : historyForApi();

      const result = await postMiChat(
        {
          message,
          locale,
          period,
          history,
        },
        { signal: controller.signal }
      );

      if (controller.signal.aborted) {
        setPending(false);
        return;
      }

      if (!result.ok) {
        setThread((prev) => [
          ...prev,
          {
            id: uid(),
            kind: 'error',
            content: result.message,
            status: result.status,
          },
        ]);
        setPending(false);
        return;
      }

      setLastSuccess(result);
      setThread((prev) => [
        ...prev,
        {
          id: uid(),
          kind: 'assistant',
          content: result.answer,
          dataQuality: result.dataQuality,
          period: result.period,
          insights: result.insights,
          toolsUsed: result.toolsUsed,
          intent: result.intent,
        },
      ]);
      setPending(false);
    },
    [pending, locale, period, historyForApi]
  );

  function startNewConversation() {
    abortRef.current?.abort();
    setPending(false);
    setThread([]);
    setLastUserMessage(null);
    setLastSuccess(null);
    setInput('');
  }

  function retryLast() {
    if (!lastUserMessage || pending) return;
    void ask(lastUserMessage, { retry: true });
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-6 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <header className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight">
                {fr ? 'Marketing Intelligence' : 'Marketing Intelligence'}
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {fr
                ? 'Assistant consultatif basé sur les données réelles de votre restaurant. Aucun envoi WhatsApp, e-mail ou campagne depuis cet écran.'
                : 'Consultative assistant grounded in your restaurant’s real data. No WhatsApp, email, or campaign send from this screen.'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">{localHistoryNotice(locale)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={fr ? 'Langue' : 'Language'}
              className="flex rounded-lg border border-border p-0.5"
            >
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    locale === l ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={locale === l}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startNewConversation}
              disabled={pending && isEmpty}
            >
              <MessageSquarePlus className="h-4 w-4" />
              {fr ? 'Nouvelle conversation' : 'New conversation'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={fr ? 'Période' : 'Period'}>
          <span className="text-xs text-muted-foreground">{fr ? 'Période' : 'Period'}:</span>
          {MI_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              data-testid={`mi-period-${p.value}`}
              onClick={() => setPeriod(p.value)}
              disabled={pending}
              aria-pressed={period === p.value}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
                period === p.value
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              {periodLabel(p.value, locale)}
            </button>
          ))}
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <Card className="flex min-h-[28rem] flex-col overflow-hidden lg:min-h-0">
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={pending}
            data-testid="mi-thread"
          >
            {isEmpty && (
              <div className="space-y-4 py-4" data-testid="mi-welcome">
                <p className="text-sm text-muted-foreground">
                  {fr
                    ? 'Posez une question marketing. Les réponses s’appuient uniquement sur vos données CRM.'
                    : 'Ask a marketing question. Answers are grounded only in your CRM data.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={pending}
                      onClick={() => void ask(s)}
                      className="max-w-full rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                      data-testid="mi-suggestion"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {thread.map((item) => {
              if (item.kind === 'user') {
                return (
                  <div
                    key={item.id}
                    className="ml-8 rounded-2xl bg-primary/15 px-3.5 py-2.5 text-sm text-foreground sm:ml-16"
                    data-testid="mi-msg-user"
                  >
                    {item.content}
                  </div>
                );
              }
              if (item.kind === 'error') {
                return (
                  <div
                    key={item.id}
                    role="alert"
                    className="mr-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-200 sm:mr-12"
                    data-testid="mi-msg-error"
                    data-status={item.status ?? undefined}
                  >
                    <p className="font-medium">{fr ? 'Erreur' : 'Error'}</p>
                    <p className="mt-1">{item.content}</p>
                    {item.status === 401 || item.status === 403 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.status === 401
                          ? fr
                            ? 'Reconnectez-vous puis réessayez.'
                            : 'Sign in again, then retry.'
                          : fr
                            ? 'Demandez analytics:read à un administrateur.'
                            : 'Ask an admin for analytics:read.'}
                      </p>
                    ) : null}
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  className="mr-4 space-y-3 rounded-2xl bg-white/[0.05] px-3.5 py-3 text-sm text-muted-foreground sm:mr-8"
                  data-testid="mi-msg-assistant"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.intent ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.intent}
                      </Badge>
                    ) : null}
                    {item.dataQuality ? (
                      <Badge
                        variant={
                          item.dataQuality === 'insufficient'
                            ? 'warning'
                            : item.dataQuality === 'ok'
                              ? 'success'
                              : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {item.dataQuality}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{item.content}</p>
                  {(item.insights || item.period) && (
                    <MiInsightsPanel
                      insights={item.insights}
                      dataQuality={item.dataQuality}
                      period={item.period}
                      locale={locale}
                      toolsUsed={item.toolsUsed}
                    />
                  )}
                </div>
              );
            })}

            {pending && (
              <p
                className="flex items-center gap-2 text-xs text-muted-foreground"
                data-testid="mi-loading"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {fr ? 'Analyse en cours…' : 'Analyzing…'}
              </p>
            )}
          </div>

          <form
            id={formId}
            className="flex flex-col gap-2 border-t border-white/[0.08] p-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <label htmlFor={`${formId}-input`} className="sr-only">
              {fr ? 'Votre question marketing' : 'Your marketing question'}
            </label>
            <Input
              id={`${formId}-input`}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MI_MESSAGE_MAX))}
              placeholder={
                fr
                  ? 'Ex. Quels sont mes meilleurs clients ce mois-ci ?'
                  : 'e.g. Who are my top clients this month?'
              }
              disabled={pending}
              maxLength={MI_MESSAGE_MAX}
              className="flex-1"
              autoComplete="off"
              data-testid="mi-input"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={retryLast}
                disabled={pending || !lastUserMessage}
                aria-label={fr ? 'Relancer la dernière question' : 'Retry last question'}
                data-testid="mi-retry"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">{fr ? 'Relancer' : 'Retry'}</span>
              </Button>
              <Button
                type="submit"
                disabled={pending || !input.trim()}
                data-testid="mi-submit"
                aria-label={fr ? 'Poser la question' : 'Ask question'}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{fr ? 'Analyser' : 'Analyze'}</span>
              </Button>
            </div>
          </form>
          <p className="px-3 pb-3 text-[11px] text-muted-foreground">
            {input.length}/{MI_MESSAGE_MAX}
            {lastSuccess?.meta.skippedAi
              ? fr
                ? ' · Réponse déterministe (IA non appelée)'
                : ' · Deterministic answer (AI skipped)'
              : null}
          </p>
        </Card>

        <aside className="hidden space-y-3 lg:block" aria-label={fr ? 'Aide' : 'Help'}>
          <Card>
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{fr ? 'Mode consultatif' : 'Consultative mode'}</p>
              <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed">
                <li>
                  {fr
                    ? 'Les chiffres viennent uniquement de l’API (dashboard CRM).'
                    : 'Figures come only from the API (CRM dashboard).'}
                </li>
                <li>
                  {fr
                    ? 'Pas de bouton d’envoi WhatsApp, e-mail ou campagne.'
                    : 'No WhatsApp, email, or campaign send button.'}
                </li>
                <li>
                  {fr
                    ? '« Données insuffisantes » n’est pas une erreur technique.'
                    : '“Insufficient data” is not a technical error.'}
                </li>
              </ul>
            </CardContent>
          </Card>
          {lastSuccess?.period ? (
            <Card>
              <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{fr ? 'Dernière période API' : 'Last API period'}</p>
                <MiPeriodChip period={lastSuccess.period} locale={locale} />
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

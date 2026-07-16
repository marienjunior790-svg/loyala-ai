import { describe, expect, it } from 'vitest';
import { buildClientTimeline, type BuildClientTimelineInput } from './client-history';

const baseClient: BuildClientTimelineInput['client'] = {
  id: 'client-1',
  full_name: 'Awa Diop',
  created_at: '2026-01-01T10:00:00.000Z',
  notes: null,
};

describe('buildClientTimeline', () => {
  it('always includes a lifecycle creation event', () => {
    const events = buildClientTimeline({ client: baseClient });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ category: 'lifecycle', source: 'clients' });
  });

  it('adds an internal note event when the client has notes', () => {
    const events = buildClientTimeline({
      client: { ...baseClient, notes: 'Client VIP' },
    });
    expect(events.some((e) => e.category === 'notes' && e.summary === 'Client VIP')).toBe(true);
  });

  it('sorts every source newest-first', () => {
    const events = buildClientTimeline({
      client: baseClient,
      visits: [
        {
          id: 'v1',
          organization_id: 'org',
          client_id: 'client-1',
          kind: 'visit',
          visited_at: '2026-03-10T12:00:00.000Z',
          amount: 15000,
          notes: null,
          created_by: 'user-1',
          created_at: '2026-03-10T12:00:00.000Z',
          updated_at: '2026-03-10T12:00:00.000Z',
        },
      ],
      loyalty: [
        {
          id: 'l1',
          client_id: 'client-1',
          points_delta: 50,
          reason: 'Visite',
          created_at: '2026-04-01T09:00:00.000Z',
        },
      ],
    });

    const times = events.map((e) => new Date(e.timestamp).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(events[0].category).toBe('loyalty');
  });

  it('resolves the current user as "Vous" and others as "Équipe"', () => {
    const events = buildClientTimeline({
      client: baseClient,
      currentUserId: 'user-1',
      visits: [
        {
          id: 'v1',
          organization_id: 'org',
          client_id: 'client-1',
          kind: 'visit',
          visited_at: '2026-03-10T12:00:00.000Z',
          amount: 0,
          notes: 'RAS',
          created_by: 'user-1',
          created_at: '2026-03-10T12:00:00.000Z',
          updated_at: '2026-03-10T12:00:00.000Z',
        },
        {
          id: 'v2',
          organization_id: 'org',
          client_id: 'client-1',
          kind: 'expense',
          visited_at: '2026-03-11T12:00:00.000Z',
          amount: 5000,
          notes: null,
          created_by: 'user-2',
          created_at: '2026-03-11T12:00:00.000Z',
          updated_at: '2026-03-11T12:00:00.000Z',
        },
      ],
    });

    const mine = events.find((e) => e.id === 'visit:v1');
    const team = events.find((e) => e.id === 'visit:v2');
    expect(mine?.actor).toBe('Vous');
    expect(team?.actor).toBe('Équipe');
  });

  it('distinguishes loyalty points gained vs used', () => {
    const events = buildClientTimeline({
      client: baseClient,
      loyalty: [
        { id: 'l1', client_id: 'client-1', points_delta: 100, reason: 'Achat', created_at: '2026-02-01T00:00:00.000Z' },
        { id: 'l2', client_id: 'client-1', points_delta: -30, reason: 'Récompense', created_at: '2026-02-02T00:00:00.000Z' },
      ],
    });
    expect(events.find((e) => e.id === 'loyalty:l1')?.title).toContain('gagnés');
    expect(events.find((e) => e.id === 'loyalty:l2')?.title).toContain('utilisés');
  });

  it('does not duplicate visits already sourced from client_visits', () => {
    const events = buildClientTimeline({
      client: baseClient,
      events: [
        {
          id: 'e1',
          event_type: 'client.visit.recorded',
          actor_id: 'user-1',
          payload: {},
          metadata: {},
          created_at: '2026-03-10T12:00:00.000Z',
        },
      ],
    });
    expect(events.some((e) => e.source === 'domain_events')).toBe(false);
  });

  it('flags AI-sourced domain events with the ai category', () => {
    const events = buildClientTimeline({
      client: baseClient,
      events: [
        {
          id: 'e2',
          event_type: 'campaign.send.requested',
          actor_id: null,
          payload: { source: 'ai' },
          metadata: { source: 'inngest' },
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const evt = events.find((e) => e.id === 'event:e2');
    expect(evt?.category).toBe('ai');
    expect(evt?.actor).toBe('IA');
    expect(evt?.icon).toBe('🤖');
  });

  it('maps reviews to the review category with rating in the title', () => {
    const events = buildClientTimeline({
      client: baseClient,
      reviews: [
        {
          id: 'r1',
          client_id: 'client-1',
          source: 'google',
          rating: 5,
          author_name: 'Awa',
          content: 'Excellent service',
          review_url: null,
          response_text: null,
          responded_at: null,
          reviewed_at: '2026-06-01T00:00:00.000Z',
        },
      ],
    });
    const review = events.find((e) => e.id === 'review:r1');
    expect(review?.category).toBe('review');
    expect(review?.title).toContain('5/5');
  });
});

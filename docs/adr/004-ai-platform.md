# ADR-004: AI Platform Provider Abstraction

**Statut:** Accepté

## Décision
Toute IA passe par `@loyala/core-ai` orchestrator. Adapters swappables.

## Inviolable (T6)
Pas d'appel OpenAI direct depuis modules métier.

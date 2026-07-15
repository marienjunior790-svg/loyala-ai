# @loyala/ui

Shared design tokens (`colors`, `spacing`, `borderRadius`, `touchTarget`) and the `cn()` helper.

## Scope (P3)

- **In this package:** tokens + `cn` (clsx + tailwind-merge).
- **Not in this package:** interactive components. Use `apps/web/components/ui/*` (shadcn-style Button, Input, Card, etc.).

Auth and dashboard surfaces share the same Button from `@/components/ui/button`.

## Usage

```ts
import { cn, colors } from '@loyala/ui';
// or via web re-export:
import { cn } from '@/lib/utils';
```

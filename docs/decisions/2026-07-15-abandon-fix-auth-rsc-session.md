# Décision P1 — branche `fix/auth-rsc-session`

**Date :** 2026-07-15  
**Décision :** **abandonner** (ne pas merger à nouveau)

## Preuves

| Check | Résultat |
|-------|----------|
| Tip branche | `0d9264d fix(web): stabilize RSC auth session…` |
| Contenu dans `main` | Oui (`git branch --contains 0d9264d` → `main`) |
| Commits uniques vs `main` | Aucun (`main..origin/fix/auth-rsc-session` vide) |
| Diff fichier `main...branch` | Vide |

Les correctifs auth RSC (session cache, cookie org stale, `AUTH_DEBUG`, `validate-auth-fix.mjs`) sont déjà sur `main` et ont été étendus ensuite (guards, role-map, safe-redirect).

## Action recommandée

```bash
git branch -d fix/auth-rsc-session
git push origin --delete fix/auth-rsc-session
```

Ne pas cherry-pick / re-merger.

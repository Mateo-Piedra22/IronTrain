# Guía rápida GitHub para novato (IronTrain)

Esta guía está pensada para trabajar sin romper `master`, especialmente si sos único mantenedor.

---

## 1) Flujo diario recomendado (simple y seguro)

Siempre trabajá en ramas, no en `master`.

```bash
# 1) Asegurarte de estar actualizado
git switch master
git pull origin master

# 2) Crear rama para tu cambio
git switch -c feat/mi-cambio

# 3) Trabajar y commitear
git add .
git commit -m "feat: descripcion corta"

# 4) Subir rama
git push -u origin feat/mi-cambio
```

Después abrís Pull Request (PR) a `master` y mergeás desde GitHub cuando estén los checks en verde.

---

## 2) Cómo crear PR y mergear

### Opción UI (GitHub web)

1. Entrar al repo en GitHub.
2. Ir a la pestaña **Pull requests**.
3. Click en **New pull request**.
4. `base`: `master`, `compare`: tu rama.
5. Crear PR y esperar checks.
6. Click en **Merge pull request** (o **Squash and merge**).

### Opción CLI

```bash
gh pr create --base master --head feat/mi-cambio --title "feat: ..." --body "..."
gh pr checks <numero-pr>
gh pr merge <numero-pr> --squash
```

---

## 3) Si aparece GH006 (push rechazado a master)

Ejemplo típico:

- "Changes must be made through a pull request"
- "required status checks"

No está roto: significa que `master` está protegido.

Solución:

1. Mover tu commit a una rama.
2. Abrir PR.
3. Mergear por PR.

```bash
# Si te quedó 1 commit en master local
git switch -c chore/rescate-cambio
git push -u origin chore/rescate-cambio

# Volver master al remoto limpio
git switch master
git fetch origin
git reset --hard origin/master
```

---

## 4) Configuración recomendada si sos único mantenedor

En GitHub: **Settings > Branches > Branch protection rules > master**

Recomendado para single maintainer:

- ✅ Require pull request before merging
- ✅ Require status checks to pass before merging
- ❌ Requerir approvals obligatorias (poner 0)
- ❌ Require code owner reviews
- ✅ Do not allow bypassing required pull requests

Así mantenés calidad (checks) sin bloquearte por reviews que nadie más puede hacer.

---

## 5) Cómo habilitar/deshabilitar reglas manualmente

### Desde UI (recomendado para empezar)

1. Repo > **Settings** > **Branches**.
2. Editar regla de `master`.
3. Activar/desactivar checkboxes.
4. Guardar cambios.

### Desde CLI (avanzado)

Usalo solo cuando ya te sientas cómodo. La UI es más segura para no romper políticas por error.

---

## 6) Qué hacer después de merge

```bash
git switch master
git pull origin master
git branch -d feat/mi-cambio
git push origin --delete feat/mi-cambio
```

---

## 7) Checklist corto antes de push

- [ ] Estoy en una rama (no `master`)
- [ ] Hice commit con mensaje claro
- [ ] Hice push de la rama
- [ ] Abrí PR a `master`
- [ ] Revisé checks del PR

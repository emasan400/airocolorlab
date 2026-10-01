-- ============================================================
-- Patch: permitir categoria 'packs' en productos
-- Correr ANTES de seed-packs.sql sobre una base existente.
-- ============================================================

alter table productos drop constraint if exists productos_categoria_check;
alter table productos add constraint productos_categoria_check
  check (categoria in ('indumentaria', 'merchandising', 'packs'));

// Slug estable compartido UI + build — misma función en ambos lados.
export function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function productPath(p) {
  return `/productos/${p.id_producto}-${slugify(p.nombre)}/`;
}

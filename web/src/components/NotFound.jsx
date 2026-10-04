export default function NotFound() {
  return (
    <main className="notfound-page">
      <div className="container notfound-inner">
        <p className="privacy-kicker">Error 404</p>
        <h1 className="display notfound-title">Esta página se salió del molde.</h1>
        <p className="notfound-sub">
          La dirección que buscás no existe o fue movida. Volvé al inicio o explorá
          el catálogo de productos.
        </p>
        <div className="notfound-actions">
          <a href="#/" className="btn btn--primary">Volver al inicio</a>
          <a href="#/" className="btn btn--ghost" onClick={() => setTimeout(() => document.getElementById('coleccion')?.scrollIntoView(), 50)}>Ver productos</a>
        </div>
      </div>
    </main>
  );
}

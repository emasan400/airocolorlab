import { Reveal } from '../hooks/useReveal';

const setFilter = (categoria) =>
  window.dispatchEvent(new CustomEvent('airo:catalog-filter', { detail: categoria }));

export default function Lifestyle() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="life-grid">
          <Reveal as="a" href="#coleccion" className="life-card" onClick={() => setFilter('indumentaria')} aria-label="Ver productos de indumentaria">
            <img src="/imagenes/hero/hero-3.webp" alt="Indumentaria corporativa" loading="lazy" />
            <div className="life-info">
              <span className="tag">Indumentaria</span>
              <h3>Uniformes & colecciones</h3>
              <p>Vestí a tu equipo con materiales premium y acabados duraderos.</p>
            </div>
            <span className="life-cta" aria-hidden="true">Ver productos →</span>
          </Reveal>
          <Reveal as="a" delay={120} href="#coleccion" className="life-card" onClick={() => setFilter('merchandising')} aria-label="Ver productos de merchandising">
            <img src="/imagenes/lifestyle/packing.webp" alt="Merchandising para eventos" loading="lazy" />
            <div className="life-info">
              <span className="tag">Merchandising</span>
              <h3>Objetos que se conservan</h3>
              <p>Lanyards, tote bags y accesorios que tus clientes van a querer quedarse.</p>
            </div>
            <span className="life-cta" aria-hidden="true">Ver productos →</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

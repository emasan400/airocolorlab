import { Reveal } from '../hooks/useReveal';

export default function Lifestyle() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="life-grid">
          <Reveal className="life-card">
            <img src="/imagenes/hero/hero-3.jpg" alt="Indumentaria corporativa" loading="lazy" />
            <div className="life-info">
              <span className="tag">Indumentaria</span>
              <h3>Uniformes & colecciones</h3>
              <p>Vestí a tu equipo con materiales premium y acabados duraderos.</p>
            </div>
          </Reveal>
          <Reveal delay={120} className="life-card">
            <img src="/imagenes/lifestyle/packing.jpg" alt="Merchandising para eventos" loading="lazy" />
            <div className="life-info">
              <span className="tag">Merchandising</span>
              <h3>Objetos que se conservan</h3>
              <p>Lanyards, tote bags y accesorios que tus clientes van a querer quedarse.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

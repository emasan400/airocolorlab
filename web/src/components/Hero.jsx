import { Reveal } from '../hooks/useReveal';

export default function Hero() {
  return (
    <header className="hero" id="inicio">
      <div className="hero-bg" aria-hidden="true">
        <div className="layer" />
        <div className="layer" />
        <div className="layer" />
        <div className="layer" />
        <div className="layer" />
      </div>
      <div className="hero-veil" aria-hidden="true" />

      <div className="hero-inner">
        <Reveal>
          <div className="hero-badge">
            <span className="pulse" /> Estudio de producción textil
          </div>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="display hero-title">
            Tu marca,<br /><em>hecha prenda.</em>
          </h1>
        </Reveal>
        <Reveal delay={200} className="hero-bottom">
          <p className="hero-sub">
            Personalización textil y merchandising a medida para marcas, eventos
            y empresas. Calidad de fábrica, sin los mínimos de fábrica.
          </p>
          <div className="hero-actions">
            <a href="#coleccion" className="btn btn--light">Comenzar mi proyecto</a>
            <a href="#proceso" className="hero-link">Cómo trabajamos</a>
          </div>
          <div className="hero-meta">
            <span>Desde 10 uds.</span>
            <span>Taller propio</span>
            <span>Buenos Aires</span>
          </div>
        </Reveal>
      </div>
    </header>
  );
}

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
        <Reveal delay={90}>
          <h1 className="display hero-title">
            Hacé que tu marca<br /><em>no pase desapercibida.</em>
          </h1>
        </Reveal>
        <Reveal delay={200} className="hero-bottom">
          <p className="hero-sub">
            Desarrollamos productos textiles para marcas, empresas y eventos: indumentaria, merchandising y packs pensados desde cero para tu identidad. Calidad de fábrica, sin los mínimos de fábrica.
          </p>
          <div className="hero-actions">
            <a href="#coleccion" className="btn btn--light">Comenzar mi proyecto</a>
            <a href="#proceso" className="hero-link">Cómo trabajamos</a>
          </div>
          <div className="hero-meta">
            <span>Desde 10 uds.</span>
            <span>Desarrollo a medida</span>
            <span>Buenos Aires</span>
          </div>
        </Reveal>
      </div>
    </header>
  );
}

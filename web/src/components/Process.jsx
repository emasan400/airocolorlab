import { Reveal } from '../hooks/useReveal';

const STEPS = [
  { h: 'Contanos tu idea', p: 'Completás el brief inicial con tus requerimientos.' },
  { h: 'Te asesoramos', p: 'Definimos materiales, técnicas y diseño.' },
  { h: 'Fabricamos', p: 'Ingresamos a taller con control de calidad.' },
  { h: 'Recibís tu proyecto', p: 'Despachamos directamente a tu puerta.' },
];

export default function Process() {
  return (
    <section className="section section--neutral" id="proceso">
      <div className="container">
        <Reveal className="section-head">
          <span className="ed-index">02</span>
          <div className="section-eyebrow">Proceso</div>
          <h2 className="display section-title">¿Cómo trabajamos?</h2>
        </Reveal>
        <div className="process-grid">
          {STEPS.map((s, i) => (
            <Reveal key={s.h} delay={i * 90} className="process-step">
              <h4>{s.h}</h4>
              <p>{s.p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

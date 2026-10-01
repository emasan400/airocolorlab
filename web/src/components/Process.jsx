import { Reveal } from '../hooks/useReveal';

const STEP_MS = 2400; // tiempo que tarda el pulso en llegar de un nodo al siguiente

const STEPS = [
  { h: 'Contanos tu idea', p: 'Completás el formulario inicial con productos, cantidades y fecha objetivo.' },
  { h: 'Asesoramiento + muestra', p: 'Definimos materiales y técnicas juntos, y validás una muestra antes de producir.' },
  { h: 'Fabricamos', p: 'Producción dedicada con control de calidad por lote en cada etapa.' },
  { h: 'Entrega y post-venta', p: 'Despacho puerta a puerta y seguimiento hasta que estés conforme.' },
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
          <div className="process-track" aria-hidden="true">
            <span
              className="process-dot"
              style={{ animationDuration: `${STEP_MS * STEPS.length}ms` }}
            />
          </div>
          {STEPS.map((s, i) => (
            <Reveal key={s.h} delay={i * 90} className="process-step">
              <span
                className="step-node"
                style={{
                  animationDuration: `${STEP_MS * STEPS.length}ms`,
                  animationDelay: `${i * STEP_MS}ms`,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h4>{s.h}</h4>
              <p>{s.p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

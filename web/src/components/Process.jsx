import { Reveal } from '../hooks/useReveal';

const STEPS = [
  { h: 'Contanos tu idea', p: 'Completás el formulario inicial con productos, cantidades y fecha objetivo.' },
  { h: 'Asesoramiento + muestra', p: 'Definimos materiales y técnicas juntos, y validás una muestra antes de producir.' },
  { h: 'Fabricamos', p: 'Producción en taller propio con control de calidad por lote.' },
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

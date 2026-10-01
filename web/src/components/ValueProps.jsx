import { Reveal } from '../hooks/useReveal';

const VALUES = [
  {
    h: 'Producción nacional',
    p: 'Controlamos cada detalle en nuestro taller, desde el diseño inicial hasta la última costura.',
  },
  {
    h: 'Calidad verificable',
    p: 'Muestra física o digital antes de producir, y control de calidad por lote antes de cada despacho.',
  },
  {
    h: 'Acompañamiento dedicado',
    p: 'Un asesor sigue tu proyecto de punta a punta: materiales, colores, plazos y post-venta.',
  },
];

export default function ValueProps() {
  return (
    <section className="section">
      <div className="container ed-split">
        <Reveal className="ed-sticky">
          <span className="ed-index">01</span>
          <div className="section-eyebrow">El diferencial</div>
          <h2 className="display section-title">¿Por qué AIRO?</h2>
          <p className="section-sub">
            Un estudio-fábrica pensado para marcas que recién empiezan — y para
            las que ya vuelan.
          </p>
        </Reveal>

        <div>
          <Reveal className="value-lead">
            <div>
              <h3 className="display">Calidad de fábrica, sin los mínimos de fábrica.</h3>
              <p>
                Producí sin stock ocioso. Lanzá cápsulas o ediciones limitadas sin
                los mínimos inalcanzables de las fábricas tradicionales.
              </p>
            </div>
            <div className="value-stats">
              <div className="stat"><b>10</b><span>uds. mínimo</span></div>
              <div className="stat"><b>5–15</b><span>días hábiles</span></div>
              <div className="stat"><b>100%</b><span>a medida</span></div>
            </div>
          </Reveal>

          <div className="value-rows">
            {VALUES.map((v, i) => (
              <Reveal key={v.h} delay={i * 90} className="value-row">
                <h4>{v.h}</h4>
                <p>{v.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

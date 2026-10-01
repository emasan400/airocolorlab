import { useState } from 'react';
import { Reveal } from '../hooks/useReveal';

const FAQS = [
  {
    q: '¿Realizan envíos a todo el país?',
    a: 'Sí. Trabajamos con logística nacional puerta a puerta para asegurar que tu proyecto llegue a tiempo, estés donde estés, manteniendo la seguridad de la mercadería.',
  },
  {
    q: '¿Puedo pedir muestras físicas?',
    a: 'Absolutamente. Podés solicitar una muestra física para evaluar colores, telas y terminaciones. El costo de esta muestra se descuenta del total si decidís avanzar con la producción completa.',
  },
  {
    q: '¿Cómo envío mi diseño o logo?',
    a: 'Aceptamos archivos vectoriales (.AI, .EPS, .PDF) o imágenes en alta resolución (PNG, TIFF a 300dpi). Si no sabés cómo exportarlo, nuestro equipo de diseño te guía paso a paso.',
  },
  {
    q: '¿Qué pasa si no tengo diseño?',
    a: 'No te preocupes. Contamos con un equipo de diseño in-house que puede adaptar tu logo existente o crear una propuesta gráfica desde cero, optimizada especialmente para el estampado textil.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos transferencias bancarias, e-cheq y tarjetas. Para iniciar la producción solicitamos un anticipo del 50%, y el saldo restante se abona contra entrega del producto terminado.',
  },
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <section className="section" id="faq">
      <div className="container">
        <Reveal className="section-head section-head--center">
          <span className="ed-index">04</span>
          <div className="section-eyebrow">Información & Operativa</div>
          <h2 className="display section-title">Antes de producir.</h2>
          <p className="section-sub">
            Conocé nuestra filosofía de trabajo y resolvé tus dudas antes de iniciar la producción.
          </p>
        </Reveal>

        <div className="mv-grid">
          <Reveal className="mv-card">
            <span className="tag">Misión</span>
            <h3>Elevar tu identidad visual</h3>
            <p>
              Democratizar el acceso a productos textiles personalizados de calidad
              profesional. Acompañamos a marcas, eventos y creadores permitiéndoles
              producir desde bajos volúmenes sin comprometer la estética ni los
              acabados premium.
            </p>
          </Reveal>
          <Reveal delay={100} className="mv-card">
            <span className="tag">Visión</span>
            <h3>El estándar de diseño textil</h3>
            <p>
              Ser el estudio-fábrica referente en Argentina para producciones a
              medida y merchandising corporativo, demostrando que la personalización
              textil puede ser ágil, transparente y enfocada 100% en las necesidades
              del cliente.
            </p>
          </Reveal>
        </div>

        <Reveal className="faq-list">
          {FAQS.map((f, i) => (
            <div key={i} className={`faq-item${openIdx === i ? ' open' : ''}`}>
              <button
                className="faq-q"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                aria-expanded={openIdx === i}
              >
                {f.q}
                <span className="faq-icon" />
              </button>
              <div className="faq-a">
                <div><p>{f.a}</p></div>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

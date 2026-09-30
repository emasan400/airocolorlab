const ITEMS = [
  'Desde 10 unidades',
  'Producción nacional',
  'Envíos a todo el país',
  'Asesoramiento personalizado',
  'Sublimación full color',
  'Entrega en 5 a 7 días hábiles',
];

export default function Marquee() {
  const line = ITEMS.map((t, i) => (
    <span key={i}>
      <span className="star">★</span>
      {t}
    </span>
  ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {line}
        {line}
      </div>
    </div>
  );
}

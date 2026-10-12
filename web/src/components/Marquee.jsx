const ITEMS = [
  'Desarrollo de productos textiles',
  'Desde 10 unidades',
  'Producción nacional',
  'Diseño in-house',
  'Sublimación y DTF full color',
  'Envíos a todo el país',
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

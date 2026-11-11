import { IconPrinter, IconCheck } from './Icons';

export default function PresupuestoPrintView({ presupuesto, onVolver }) {
  if (!presupuesto) return null;

  const isKit = presupuesto.modo === 'KIT_PRENDA';
  const piezas = Array.isArray(presupuesto.piezas_kit)
    ? presupuesto.piezas_kit
    : Array.isArray(presupuesto.piezas)
    ? presupuesto.piezas
    : [];
  const demanda = Number(presupuesto.demanda_prendas || presupuesto.demanda || 10);
  const unitPrice = Number(presupuesto.precio_venta_unitario || presupuesto.unit_price || 0);
  const totalSale = Number(presupuesto.precio_venta_sugerido_total || presupuesto.total_quote || 0);
  const unitDtf = Number(presupuesto.costo_dtf_por_prenda || presupuesto.dtf_cost_per_unit || 0);
  const metersNeeded = Number(presupuesto.metros_requeridos || presupuesto.nesting?.linearMeters || 1);
  const utilPct = Number(presupuesto.aprovechamiento_pct || presupuesto.nesting?.utilizationPct || 0);
  const perMeter = Number(presupuesto.prendas_por_metro || 1);
  const rollWidth = Number(presupuesto.bobina_ancho_util_cm || presupuesto.roll_width_cm || 58);

  return (
    <div>
      <div
        className="remito-actions-toolbar"
        style={{
          maxWidth: '840px',
          margin: '0 auto 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button className="g-btn g-btn-outline" onClick={onVolver}>
          ← Volver al Cotizador DTF
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="g-btn g-btn-primary"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconPrinter size={15} /> Imprimir / Guardar PDF Oficial
          </button>
        </div>
      </div>

      <div className="remito-sheet">
        {/* Encabezado Oficial AIRO Color Lab */}
        <div className="remito-header-box">
          <div className="remito-issuer-info">
            <h2 className="remito-issuer-title">AIRO COLOR LAB.</h2>
            <div className="remito-issuer-tag">Estudio Textil & Merchandising B2B</div>
            <div className="remito-issuer-data">
              <div><strong>Domicilio:</strong> Buenos Aires, Argentina</div>
              <div><strong>WhatsApp Comercial:</strong> +54 9 11 6355 3443</div>
              <div><strong>Email:</strong> airocolorlab@gmail.com</div>
              <div><strong>Web:</strong> airocolorlab.vercel.app</div>
              <div><strong>IVA:</strong> Responsable Inscripto</div>
            </div>
          </div>

          <div className="remito-type-center">
            <div className="remito-letter-box">X</div>
            <span>DOCUMENTO NO VÁLIDO COMO FACTURA</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px' }}>PRESUPUESTO B2B</span>
          </div>

          <div className="remito-meta-box">
            <h3 className="remito-meta-title">COTIZACIÓN OFICIAL</h3>
            <div className="remito-meta-row">
              <strong>CÓDIGO:</strong> {presupuesto.codigo || presupuesto.id}
            </div>
            <div className="remito-meta-row">
              <strong>FECHA EMISIÓN:</strong> {presupuesto.fecha || new Date().toISOString().slice(0, 10)}
            </div>
            <div className="remito-meta-row">
              <strong>MODALIDAD:</strong> {isKit ? 'KIT DE PRENDA COMPLETA' : 'MONOPIEZA / PLIEGO DTF'}
            </div>
            <div className="remito-meta-row">
              <strong>ESTADO:</strong>{' '}
              <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                {presupuesto.estado || 'EMITIDA'}
              </span>
            </div>
          </div>
        </div>

        {/* Datos del Destinatario / Cliente B2B */}
        <div className="remito-client-box">
          <div className="remito-client-grid">
            <div>
              <strong>Empresa / Razón Social:</strong> {presupuesto.cliente_empresa || 'Cliente Corporativo B2B'}
            </div>
            <div>
              <strong>Contacto Responsable:</strong> {presupuesto.cliente_nombre || presupuesto.cliente_contacto || 'Departamento de Compras / Marketing'}
            </div>
            <div>
              <strong>WhatsApp / Teléfono:</strong> {presupuesto.cliente_whatsapp || '—'}
            </div>
            <div>
              <strong>Proyecto / Prenda Base:</strong> {presupuesto.titulo || presupuesto.prenda_nombre || 'Servicio de Estampa DTF Textil'}
            </div>
            <div>
              <strong>Volumen Solicitado:</strong> {demanda} unidades (Regla B2B: mín. 10 u., múltiplos de 10)
            </div>
            <div>
              <strong>Bobina DTF Seleccionada:</strong> {rollWidth} cm útiles (Largo pliego 100 cm · Gap 4 mm)
            </div>
          </div>
        </div>

        {/* Tabla Técnica de Piezas de Estampa y Nesting 2D */}
        <table className="remito-items-table">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>Ítem</th>
              <th style={{ width: '150px' }}>Ubicación / Pieza</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Medidas (cm)</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Cant. / Prenda</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Total Estampas</th>
              <th>Especificación Técnica DTF & Producción</th>
            </tr>
          </thead>
          <tbody>
            {piezas.map((p, idx) => {
              const qtyPerGarment = Number(p.qtyPerGarment) || 1;
              const totalPieces = qtyPerGarment * demanda;
              const w = p.width || p.widthCm || 5;
              const h = p.height || p.heightCm || 5;
              return (
                <tr key={p.id || idx}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                  <td><strong>{p.name || p.label || `Pieza ${idx + 1}`}</strong></td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                    {w} × {h} cm
                  </td>
                  <td style={{ textAlign: 'center' }}>{qtyPerGarment}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalPieces} u.</td>
                  <td style={{ fontSize: '0.8rem', color: '#334155' }}>
                    Impresión DTF textil alta definición · Separación de corte 4 mm · Poliamida termofusible
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Resumen de Optimización 2D MaxRects-BSSF y Desglose Operativo */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            background: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ingeniería de Pliego DTF (Motor MaxRects-BSSF 2D Nesting)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.6rem' }}>
            <div>
              <strong>Ancho útil de bobina:</strong> {rollWidth} cm
            </div>
            <div>
              <strong>Metros lineales requeridos:</strong> {metersNeeded} m
            </div>
            <div>
              <strong>Aprovechamiento textil:</strong> {utilPct}%
            </div>
            <div>
              <strong>Capacidad por metro:</strong> {perMeter} {isKit ? 'kits/m' : 'estampas/m'}
            </div>
            <div>
              <strong>Costo DTF por unidad:</strong> ${unitDtf.toLocaleString('es-AR')}
            </div>
            <div>
              <strong>Valor metro lineal DTF:</strong> ${(presupuesto.precio_metro_dtf || 25000).toLocaleString('es-AR')}/m
            </div>
          </div>
        </div>

        {/* Resumen Económico de la Cotización */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '2px solid #1a4295',
            borderRadius: '6px',
            padding: '0.9rem 1.2rem',
            marginBottom: '1rem',
            background: '#ffffff',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontWeight: 700 }}>
              Valor Unitario B2B ({demanda} unidades)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              ${unitPrice.toLocaleString('es-AR')}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>/ unidad</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1a4295', fontWeight: 700 }}>
              Total Presupuestado ({demanda} u.)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a4295' }}>
              ${totalSale.toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {/* Condiciones Comerciales B2B Innegociables */}
        <div className="remito-observations-box">
          <strong>Condiciones Comerciales B2B — AIRO Color Lab:</strong>
          <p style={{ margin: '0.35rem 0 0', color: '#334155', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {presupuesto.notas ||
              '1) Pedido mínimo: 10 unidades por referencia (escalas en múltiplos de 10). 2) Precios expresados por cotización a medida según volumen y pliego DTF calculado. 3) Validez del presupuesto: sujeta a confirmación de stock de insumos al momento de la seña. 4) Atención personalizada y aprobación de muestra digital en menos de 24 h hábiles vía WhatsApp (+54 9 11 6355 3443).'}
          </p>
          <div style={{ marginTop: '0.45rem', fontSize: '0.72rem', color: '#0e7490', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconCheck size={12} /> Cálculo determinístico auditado en Taller Central AIRO Color Lab (HITL-3 requerido para descuentos o condiciones especiales).
          </div>
        </div>

        {/* Firmas de Emisión y Aprobación Comercial */}
        <div className="remito-signatures-box">
          <div className="remito-signature-line">
            <strong>POR AIRO COLOR LAB.</strong>
            <span>Dirección Comercial & Taller DTF</span>
          </div>

          <div className="remito-signature-line">
            <strong>APROBACIÓN DEL CLIENTE B2B</strong>
            <span>Firma, Aclaración y Fecha de Conformidad</span>
          </div>
        </div>
      </div>
    </div>
  );
}

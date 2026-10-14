import { IconPrinter, IconCheck } from './Icons';

export default function RemitoPrintView({ remito, onVolver }) {
  if (!remito) return null;

  return (
    <div>
      <div className="remito-actions-toolbar" style={{ maxWidth: '840px', margin: '0 auto 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="g-btn g-btn-outline" onClick={onVolver}>
          ← Volver a la lista de Remitos
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="g-btn g-btn-primary" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPrinter size={15} /> Imprimir / Guardar PDF
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
              <div><strong>WhatsApp:</strong> +54 9 11 6355 3443</div>
              <div><strong>Email:</strong> airocolorlab@gmail.com</div>
              <div><strong>Web:</strong> airocolorlab.vercel.app</div>
              <div><strong>IVA:</strong> Responsable Inscripto</div>
            </div>
          </div>

          <div className="remito-type-center">
            <div className="remito-letter-box">R</div>
            <span>DOCUMENTO NO VÁLIDO COMO FACTURA</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px' }}>CÓD. 091</span>
          </div>

          <div className="remito-meta-box">
            <h3 className="remito-meta-title">REMITO OFICIAL</h3>
            <div className="remito-meta-row">
              <strong>NÚMERO:</strong> {remito.numero}
            </div>
            <div className="remito-meta-row">
              <strong>FECHA EMISIÓN:</strong> {remito.fecha_emision}
            </div>
            {remito.fecha_entrega && (
              <div className="remito-meta-row">
                <strong>FECHA ENTREGA:</strong> {remito.fecha_entrega}
              </div>
            )}
            <div className="remito-meta-row">
              <strong>ESTADO:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{remito.estado}</span>
            </div>
          </div>
        </div>

        {/* Datos del Destinatario / Cliente */}
        <div className="remito-client-box">
          <div className="remito-client-grid">
            <div>
              <strong>Señor(es) / Razón Social:</strong> {remito.cliente_nombre}
            </div>
            <div>
              <strong>CUIT / DNI:</strong> {remito.cliente_cuit || 'Consumidor Final'}
            </div>
            <div>
              <strong>Domicilio de Entrega:</strong> {remito.cliente_direccion || 'A convenir / Retiro en taller'}
            </div>
            <div>
              <strong>Teléfono / WhatsApp:</strong> {remito.cliente_whatsapp || '—'}
            </div>
            <div>
              <strong>Contacto Receptor:</strong> {remito.contacto_receptor || 'Personal autorizado'}
            </div>
            <div>
              <strong>Modalidad de Envío:</strong> {remito.modalidad_envio}
            </div>
            {remito.transportista && (
              <div>
                <strong>Transporte / Chofer:</strong> {remito.transportista}
              </div>
            )}
            {remito.cantidad_bultos && (
              <div>
                <strong>Cantidad de Bultos:</strong> {remito.cantidad_bultos} caja(s)/paquete(s)
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Mercadería Remitida */}
        <table className="remito-items-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>Ítem</th>
              <th style={{ width: '110px' }}>Código / SKU</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Cantidad</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Unidad</th>
              <th>Descripción del Producto y Detalles Técnicos</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Bulto</th>
            </tr>
          </thead>
          <tbody>
            {(remito.items || []).map((it, idx) => (
              <tr key={it.id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{it.sku || 'A MEDIDA'}</td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.95rem' }}>{it.cantidad}</td>
                <td style={{ textAlign: 'center' }}>{it.unidad || 'unidades'}</td>
                <td>
                  <strong>{it.descripcion}</strong>
                </td>
                <td style={{ textAlign: 'center', fontSize: '0.78rem' }}>{it.bulto || 'Caja 1'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Observaciones */}
        <div className="remito-observations-box">
          <strong>Observaciones / Instrucciones de Entrega:</strong>
          <p style={{ margin: '0.35rem 0 0', color: '#334155' }}>
            {remito.observaciones || 'Mercadería confeccionada según especificaciones del pedido. Revisada con control de calidad de AIRO Color Lab.'}
          </p>
          {remito.descontar_stock && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#0e7490', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheck size={12} /> Unidades verificadas y descargadas del inventario central de taller.
            </div>
          )}
        </div>

        {/* Firmas de Despacho y Recepción */}
        <div className="remito-signatures-box">
          <div className="remito-signature-line">
            <strong>POR AIRO COLOR LAB.</strong>
            <span>Despachado y Controlado en Taller</span>
          </div>

          <div className="remito-signature-line">
            <strong>RECIBÍ CONFORME (CLIENTE)</strong>
            <span>Firma, Aclaración y DNI del Receptor</span>
            {remito.firmado_por && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }}>
                Firmado por: {remito.firmado_por} {remito.dni_receptor ? `(DNI: ${remito.dni_receptor})` : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

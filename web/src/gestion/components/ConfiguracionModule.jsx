import { useState } from 'react';
import {
  getOperadorActual,
  setOperadorActual,
  exportarBackupCompleto,
  importarBackupCompleto,
  restablecerDatosIniciales,
  getAuditLogs,
  syncWithSupabase,
} from '../services/storageService';
import { supabaseEnabled } from '../../lib/supabase';
import { IconCheck } from './Icons';

const OPERADORES_DISPONIBLES = [
  'Admin AIRO (Taller Central)',
  'Facundo (Producción & DTF)',
  'Ezequiel (Logística & Despacho)',
  'Ventas & Atención B2B',
  'Administración & Finanzas',
];

export default function ConfiguracionModule({ onDataReload }) {
  const [operador, setOperador] = useState(getOperadorActual());
  const [auditLogs] = useState(getAuditLogs());
  const [syncStatus, setSyncStatus] = useState(null);
  const [importText, setImportText] = useState('');
  const [sqlCopied, setSqlCopied] = useState(false);

  const handleChangeOperador = (newOp) => {
    setOperador(newOp);
    setOperadorActual(newOp);
  };

  const handleExportBackup = () => {
    const jsonStr = exportarBackupCompleto();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airo_backup_completo_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = () => {
    if (!importText.trim()) return alert('Pegá el contenido JSON del respaldo.');
    try {
      importarBackupCompleto(importText);
      alert('¡Respaldo importado y restaurado con éxito!');
      setImportText('');
      if (onDataReload) onDataReload();
    } catch (e) {
      alert('Error al importar: ' + e.message);
    }
  };

  const handleResetDemo = () => {
    if (confirm('¿Restablecer los datos iniciales demostrativos de AIRO Color Lab? Se sobreescribirán los cambios no exportados.')) {
      restablecerDatosIniciales();
      alert('Datos demostrativos restablecidos.');
      if (onDataReload) onDataReload();
    }
  };

  const handleTestSync = async () => {
    setSyncStatus({ loading: true });
    const res = await syncWithSupabase();
    setSyncStatus(res);
  };

  const sqlSchemaScript = `-- Copiar y pegar en el SQL Editor de Supabase:
-- Archivo completo en: C:\\airo\\AiroColorLab\\db\\schema-gestion.sql
-- Crea tablas de inventario_productos, inventario_materiales, remitos, flujo_caja, etc. con RLS y permisos.`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaScript);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  return (
    <div>
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">11</span> Sistema & Sincronización
        </div>
        <h2 className="display section-title">Equipo y sincronización.</h2>
        <p className="section-sub">
          Operador en turno, backups JSON inmutables, base de datos en la nube y auditoría.
        </p>
      </div>

      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Operador en Turno</div>
          <div className="gestion-kpi-val" style={{ fontSize: '1.25rem' }}>{operador}</div>
          <div className="gestion-kpi-sub">Firma registrada en kardex y remitos</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Supabase Cloud Data</div>
          <div className="gestion-kpi-val" style={{ fontSize: '1.25rem' }}>
            {supabaseEnabled ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCheck size={18} /> Configurado
              </span>
            ) : (
              'Modo Offline'
            )}
          </div>
          <div className="gestion-kpi-sub">
            {supabaseEnabled ? 'URL de Supabase activa' : 'Usando persistencia reactiva local'}
          </div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Auditoría Append-Only</div>
          <div className="gestion-kpi-val">{auditLogs.length}</div>
          <div className="gestion-kpi-sub">Eventos auditados registrados</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Panel 1: Colaboración & Operador */}
        <div style={{ background: '#fff', border: '1px solid var(--g-border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--g-shadow-sm)' }}>
          <h4 style={{ margin: '0 0 0.75rem', color: 'var(--g-blue)' }}>Identidad del Operador de Equipo</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            Seleccioná quién está operando el sistema actualmente para que cada movimiento de stock, remito o registro contable quede debidamente identificado en el historial.
          </p>
          <div className="g-form-group">
            <label>Seleccionar Usuario Activo:</label>
            <select value={operador} onChange={(e) => handleChangeOperador(e.target.value)}>
              {OPERADORES_DISPONIBLES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Panel 2: Sincronización Supabase Cloud */}
        <div style={{ background: '#fff', border: '1px solid var(--g-border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--g-shadow-sm)' }}>
          <h4 style={{ margin: '0 0 0.75rem', color: 'var(--g-blue)' }}>Conexión con Supabase PostgreSQL</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            El sistema se conecta a la instancia de Supabase de AIRO Color Lab para persistencia compartida en tiempo real en la web.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="g-btn g-btn-outline" onClick={handleTestSync}>
              Verificar Conexión a Base de Datos
            </button>
            <button className="g-btn g-btn-primary" onClick={handleCopySql}>
              {sqlCopied ? 'SQL Copiado' : 'Copiar Script SQL de Tablas'}
            </button>
          </div>
          {syncStatus && (
            <div style={{ marginTop: '0.85rem', fontSize: '0.82rem', padding: '0.6rem 0.85rem', borderRadius: '6px', background: syncStatus.ok ? '#dcfce7' : '#fee2e2', color: syncStatus.ok ? '#15803d' : '#b91c1c' }}>
              {syncStatus.ok ? syncStatus.message : syncStatus.error}
            </div>
          )}
        </div>

        {/* Panel 3: Interfaces Seguras con Otros Sistemas */}
        <div style={{ background: '#fff', border: '1px solid var(--g-border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--g-shadow-sm)', gridColumn: '1 / -1' }}>
          <h4 style={{ margin: '0 0 0.75rem', color: 'var(--g-blue)' }}>Protocolo de Seguridad & Interfaces con Sistemas Externos</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.85rem' }}>
            Para garantizar la máxima seguridad en la conexión con otros sistemas (ERP contable, bots de WhatsApp, pasarelas de pago o logística externa):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.83rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--g-border)' }}>
              <strong>1. Autenticación & Control de Acceso:</strong>
              <p style={{ margin: '0.35rem 0 0', color: '#475569' }}>
                Protegido por Supabase Auth + Guardia de Inactividad (auto-cierre a los 30 min) y defensa anti-fuerza bruta (bloqueo tras 5 intentos fallidos).
              </p>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--g-border)' }}>
              <strong>2. Base de Datos Blindada (RLS):</strong>
              <p style={{ margin: '0.35rem 0 0', color: '#475569' }}>
                Acceso público revocado al 100% en PostgreSQL. Toda lectura/escritura de stock, remitos o caja exige JWT autenticado válido.
              </p>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--g-border)' }}>
              <strong>3. Conexiones Externas (API Keys & Webhooks):</strong>
              <p style={{ margin: '0.35rem 0 0', color: '#475569' }}>
                Sistemas conectados consumen vía tabla <code>api_keys_integraciones</code> con hash SHA-256 de API Key y firmas HMAC-SHA256 en webhooks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 3: Copias de Seguridad & Migración */}
      <div style={{ background: '#fff', border: '1px solid var(--g-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--g-shadow-sm)' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: 'var(--g-blue)' }}>Copia de Seguridad & Portabilidad de Datos</h4>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Podés descargar un archivo JSON completo con todo el stock de productos, insumos, clientes, proveedores, remitos y flujo de caja para resguardo o para migrar de dispositivo.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <button className="g-btn g-btn-primary" onClick={handleExportBackup}>
            Descargar Backup Completo (JSON)
          </button>
          <button className="g-btn g-btn-outline" onClick={handleResetDemo}>
            Cargar Datos Demostrativos AIRO
          </button>
        </div>

        <div className="g-form-group">
          <label>Restaurar desde Archivo o Texto JSON:</label>
          <textarea
            rows={3}
            placeholder="Pegá aquí el contenido del backup JSON para restaurar..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <button className="g-btn g-btn-outline" onClick={handleImportBackup}>
              Restaurar Base de Datos
            </button>
          </div>
        </div>
      </div>

      {/* Panel 4: Registro de Auditoría (Append-only) */}
      <div style={{ background: '#fff', border: '1px solid var(--g-border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--g-shadow-sm)' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: 'var(--g-blue)' }}>Registro de Auditoría Inmutable (Audit Log)</h4>
        <div className="gestion-table-scroll" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          <table className="gestion-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operador</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Detalles</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString('es-AR') : '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{log.operador}</td>
                  <td style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{log.accion}</td>
                  <td><span className="g-badge g-badge-neutral">{log.modulo}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{log.detalles}</td>
                  <td><span className="g-badge g-badge-success">{log.RESULT || 'SUCCESS'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

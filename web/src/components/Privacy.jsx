export default function Privacy() {
  return (
    <main className="privacy-page">
      <div className="container">
        <a href="#/" className="privacy-back">&larr; Volver al sitio</a>
        <p className="privacy-kicker">Legal · Ley 25.326</p>
        <h1>Política de Privacidad y Seguridad de Datos Personales</h1>
        <p className="privacy-date">Última actualización: Septiembre de 2026</p>

        <div className="privacy-body">
          <p>
            El presente documento establece las condiciones en las que <b>AIRO Color Lab</b> (en adelante,
            el "Responsable"), con domicilio en Ciudad Autónoma de Buenos Aires, Argentina, trata y protege
            los datos personales de los usuarios (en adelante, el "Usuario") recolectados a través de los
            formularios de contacto y cotización de este sitio web, de total conformidad con la{' '}
            <a href="https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm" target="_blank" rel="noreferrer">
              Ley Nº 25.326 de Protección de Datos Personales
            </a>, sus decretos reglamentarios y las disposiciones de la{' '}
            <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noreferrer">
              Agencia de Acceso a la Información Pública (AAIP)
            </a>.
          </p>

          <h2>1. Datos recolectados y finalidad</h2>
          <p>
            El Responsable únicamente solicita y procesa datos de contacto básicos de carácter no sensible
            mediante sus formularios web, los cuales incluyen:
          </p>
          <ul>
            <li>Nombre y apellido.</li>
            <li>Empresa u organización (opcional).</li>
            <li>Número de teléfono / WhatsApp.</li>
            <li>Dirección de correo electrónico.</li>
            <li>Ciudad de entrega y fecha objetivo del proyecto.</li>
            <li>Comentarios o detalles del pedido ingresados voluntariamente.</li>
          </ul>
          <p>
            <b>Finalidad:</b> la recolección de estos datos tiene como único objetivo procesar las consultas
            y solicitudes de cotización de los Usuarios, validar los pedidos comerciales y permitir el
            contacto posterior para perfeccionar la operación comercial. Los datos no serán utilizados para
            finalidades incompatibles con las aquí expuestas.
          </p>
          <p>
            Si incluís una previsualización en tu solicitud de cotización, AIRO recibe la imagen
            referencial y los datos de configuración para revisar tu proyecto. El archivo de arte
            original no se envía desde este visualizador. No compartas datos sensibles ni material
            de terceros sin autorización.
          </p>

          <h2>2. Almacenamiento e infraestructura tecnológica</h2>
          <p>Los datos personales recolectados se administran bajo un entorno de alta seguridad técnica:</p>
          <ul>
            <li>
              <b>Alojamiento de la aplicación:</b> el frontend se encuentra desplegado en{' '}
              <a href="https://vercel.com/docs/security/compliance" target="_blank" rel="noreferrer">Vercel</a>,
              garantizando la transmisión segura de los datos mediante protocolos cifrados HTTPS bajo
              estándares TLS (Transport Layer Security) modernos.
            </li>
            <li>
              <b>Base de datos relacional:</b> el almacenamiento de la información se realiza mediante{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a>, cuya
              infraestructura se encuentra certificada internacionalmente bajo normas ISO 27001 y SOC 2 Type 2.
            </li>
          </ul>

          <h2>3. Medidas de seguridad aplicadas</h2>
          <p>
            Para proteger los datos contra accesos no autorizados, adulteraciones o filtraciones, y siguiendo
            las recomendaciones de la Resolución AAIP Nº 47/2018, aplicamos el modelo de responsabilidad
            compartida con nuestros proveedores:
          </p>
          <ul>
            <li>
              <b>Cifrado avanzado:</b> los datos personales se encuentran encriptados en reposo utilizando el
              algoritmo estándar de la industria AES-256 dentro de los servidores de{' '}
              <a href="https://supabase.com/security" target="_blank" rel="noreferrer">Supabase</a>.
            </li>
            <li>
              <b>Controles de acceso estrictos:</b> el acceso a la base de datos está restringido al personal
              autorizado mediante políticas de mínimo privilegio y resguardo de credenciales mediante
              variables de entorno (environment variables), nunca expuestas en el código público.
            </li>
            <li>
              <b>Políticas de seguridad a nivel de fila (RLS):</b> empleamos los mecanismos nativos de
              PostgreSQL (Row Level Security) provistos por Supabase para aislar las consultas y bloquear
              accesos ilegítimos. Los datos de contacto solo pueden ser leídos por el administrador
              autenticado; el acceso público anónimo está limitado exclusivamente a la inserción de nuevas
              consultas.
            </li>
          </ul>

          <h2>4. Transferencia internacional de datos</h2>
          <p>
            Dado que las infraestructuras de Vercel Inc. y Supabase Inc. se encuentran localizadas fuera de la
            República Argentina (principalmente en los Estados Unidos de América u otras regiones globales),
            el envío de los formularios web implica una <b>Transferencia Internacional de Datos</b> bajo los
            términos del Artículo 12 de la Ley Nº 25.326.
          </p>
          <p>
            Para garantizar un nivel de protección adecuado, el Responsable opera bajo las pautas del{' '}
            <a href="https://supabase.com/legal/customer-resources/data-processing-addendum" target="_blank" rel="noreferrer">
              Data Processing Addendum (DPA) de Supabase
            </a>{' '}
            y de Vercel, los cuales incorporan Cláusulas Contractuales Estándar internacionales para el
            tratamiento seguro de datos de terceros.
          </p>

          <h2>5. Derechos de los titulares (Derechos ARCO)</h2>
          <p>
            De conformidad con la legislación argentina, el Usuario tiene pleno derecho a solicitar el{' '}
            <b>Acceso, Rectificación, Actualización y Supresión</b> de sus datos personales de forma
            totalmente gratuita. Para ejercer estos derechos, deberá enviar una comunicación fehaciente
            adjuntando acreditación de identidad (DNI o equivalente) al siguiente canal:
          </p>
          <ul>
            <li>Correo electrónico: <b>airocolorlab@gmail.com</b></li>
          </ul>
          <p>
            El Responsable se compromete a evacuar las solicitudes de Acceso dentro de los diez (10) días
            corridos, y las de Rectificación, Actualización o Supresión dentro de los cinco (5) días hábiles
            de haber sido fehacientemente solicitadas.
          </p>

          <h2>6. Autoridad de aplicación</h2>
          <p className="privacy-legal">
            "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos
            en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés
            legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
            La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, Órgano de Control de la Ley Nº 25.326, tiene la
            atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento
            de las normas sobre protección de datos personales."
          </p>
        </div>
      </div>
    </main>
  );
}

-- ============================================================
-- AIRO Color Lab — seed de packs/combos (4 packs curados)
-- Correr DESPUÉS de schema.sql + seed.sql. Idempotente:
-- borra solo los hijos de los pk* y re-inserta.
-- ============================================================

-- Padres
insert into productos (id_producto, categoria, badge, nombre, descripcion, imagen_principal, activo) values
('pk1','packs','Pack','Pack Bienvenida — Onboarding','Kit de ingreso para nuevos miembros del equipo: remera personalizada, tote bag y lanyard oficial con tu identidad de marca.','/imagenes/productos/totes.jpg',true),
('pk2','packs','Pack','Pack Evento','Todo lo que tu evento necesita en una sola producción: lanyards de acreditación, pulseras de tela y cintas para medallas.','/imagenes/productos/lanyard.jpg',true),
('pk3','packs','Pack','Pack Uniforme de Equipo','Vestí a todo tu equipo con imagen unificada: remeras y buzos personalizados con los colores y el logo de tu marca.','/imagenes/productos/remera.jpg',true),
('pk4','packs','Pack','Pack Marca Propia','Para marcas que lanzan su línea: remeras o buzos con tu etiqueta de composición tejida y tote bags de packaging.','/imagenes/productos/etiquetas.jpg',true)
on conflict (id_producto) do update set
  categoria = excluded.categoria, badge = excluded.badge,
  nombre = excluded.nombre, descripcion = excluded.descripcion,
  imagen_principal = excluded.imagen_principal, activo = excluded.activo;

-- Limpiar hijos solo de los packs (idempotente)
delete from producto_imagenes where id_producto in ('pk1','pk2','pk3','pk4');
delete from producto_colores where id_producto in ('pk1','pk2','pk3','pk4');
delete from producto_especificaciones where id_producto in ('pk1','pk2','pk3','pk4');

-- Galerías
insert into producto_imagenes (id_producto, ruta, orden) values
('pk1','/imagenes/productos/totes.jpg',0),
('pk1','/imagenes/productos/remera.jpg',1),
('pk1','/imagenes/productos/lanyard.jpg',2),
('pk2','/imagenes/productos/lanyard.jpg',0),
('pk2','/imagenes/productos/cintas.jpg',1),
('pk3','/imagenes/productos/remera.jpg',0),
('pk3','/imagenes/productos/buzo-capucha.jpg',1),
('pk4','/imagenes/productos/etiquetas.jpg',0),
('pk4','/imagenes/productos/remera.jpg',1),
('pk4','/imagenes/productos/totes.jpg',2);

-- Variantes
insert into producto_colores (id_producto, nombre, orden) values
('pk1','Identidad de marca',0),
('pk1','Edición empresa',1),
('pk2','Full color',0),
('pk2','Paleta del evento',1),
('pk3','Combinación a elección',0),
('pk4','Según colección',0);

-- Especificaciones (contenido del pack)
insert into producto_especificaciones (id_producto, detalle, orden) values
('pk1','Remera personalizada',0),
('pk1','Tote bag de lienzo',1),
('pk1','Lanyard sublimado',2),
('pk1','Etiqueta de composición opcional',3),
('pk2','Lanyards de acreditación',0),
('pk2','Pulseras de tela',1),
('pk2','Cintas para medallas',2),
('pk2','Producción coordinada por lote',3),
('pk3','Remeras o chombas',0),
('pk3','Buzos rústicos o friza',1),
('pk3','Etiquetas de composición',2),
('pk3','Talles surtidos por integrante',3),
('pk4','Prendas a medida',0),
('pk4','Etiquetas de composición propias',1),
('pk4','Tote bags de packaging',2),
('pk4','Asesoría de materiales',3);

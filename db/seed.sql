-- ============================================================
-- AIRO Color Lab — seed del catálogo (12 productos del Excel)
-- Correr DESPUÉS de schema.sql. Idempotente por id_producto
-- (borra hijos y re-inserta).
-- ============================================================

-- Productos (padre)
insert into productos (id_producto, categoria, badge, nombre, descripcion, imagen_principal, activo) values
('p1','merchandising','Top','Lanyards Oficiales','Lanyards personalizados con sublimación full color en ambas caras.','/imagenes/productos/lanyard.jpg',true),
('p2','merchandising','','Cintas para Medallas','Cintas personalizadas para eventos y competencias deportivas.','/imagenes/productos/cintas.jpg',true),
('p3','merchandising','Nuevo','Pulseras de Tela','Pulseras textiles personalizables para eventos.',null,false),
('p4','indumentaria','Indumentaria','Remeras Personalizadas','Remeras personalizadas para marcas, eventos y equipos.','/imagenes/productos/remera.jpg',true),
('p5','indumentaria','','Buzos Rústicos y Friza','Buzos personalizados con capucha en diferentes materiales y terminaciones.','/imagenes/productos/buzo-capucha.jpg',true),
('p6','merchandising','','Cintas Mochileras','Cintas textiles de alta resistencia personalizadas para aplicaciones múltiples.','/imagenes/productos/cintas.jpg',true),
('p7','merchandising','','Correas para Mascotas','Correas estampadas personalizadas para mascotas y pet shops.','/imagenes/productos/correas.jpg',true),
('p8','merchandising','Eco','Tote Bags','Bolsas de lienzo personalizadas para marcas y eventos.','/imagenes/productos/totes.jpg',true),
('p9','merchandising','Marca','Etiquetas de Composición','Etiquetas textiles para reforzar la identidad de tus prendas.','/imagenes/productos/etiquetas.jpg',true),
('p10','merchandising','Nuevo','Banderines de Argentina','Banderines textiles personalizados para eventos.',null,false),
('p11','merchandising','Insumo','Metros de Cinta Sublimada','Cinta sublimada por metro para confección.',null,false),
('p12','merchandising','','Fundas para Libros','Fundas textiles personalizadas para libros.',null,false)
on conflict (id_producto) do update set
  categoria = excluded.categoria, badge = excluded.badge,
  nombre = excluded.nombre, descripcion = excluded.descripcion,
  imagen_principal = excluded.imagen_principal, activo = excluded.activo;

-- Limpiar hijos para re-insertar idempotente
delete from producto_imagenes;
delete from producto_colores;
delete from producto_especificaciones;

-- Galerías
insert into producto_imagenes (id_producto, ruta, orden) values
('p1','/imagenes/productos/lanyard.jpg',0),
('p1','/imagenes/productos/cintas.jpg',1),
('p2','/imagenes/productos/cintas.jpg',0),
('p4','/imagenes/productos/remera.jpg',0),
('p4','/imagenes/productos/buzo-capucha.jpg',1),
('p5','/imagenes/productos/buzo-capucha.jpg',0),
('p5','/imagenes/productos/buzo-sin-capucha.jpg',1),
('p6','/imagenes/productos/cintas.jpg',0),
('p7','/imagenes/productos/correas.jpg',0),
('p8','/imagenes/productos/totes.jpg',0),
('p9','/imagenes/productos/etiquetas.jpg',0);

-- Colores / variantes
insert into producto_colores (id_producto, nombre, orden) values
('p1','Sublimado Full',0),('p1','Base Negra',1),
('p2','Sublimación Full',0),
('p3','Full Color',0),
('p4','Blanco',0),('p4','Negro',1),('p4','Gris Melange',2),('p4','Azul Marino',3),
('p5','Negro',0),('p5','Gris Topo',1),('p5','Blanco',2),('p5','Crudo',3),
('p6','Negro',0),('p6','Personalizado',1),
('p7','Sublimado Full',0),
('p8','Crudo (Lienzo natural)',0),('p8','Negro',1),
('p9','Fondo Blanco',0),('p9','Fondo Negro',1),
('p10','Celeste y Blanco',0),
('p11','Diseño a medida',0),
('p12','Sublimado Full',0);

-- Especificaciones
insert into producto_especificaciones (id_producto, detalle, orden) values
('p1','Poliéster Premium',0),('p1','Ancho 20/25mm',1),('p1','Mosquetón Metálico',2),('p1','Sublimación 360°',3),
('p2','Terminación suave',0),('p2','Corte por calor',1),('p2','Largo a medida',2),('p2','Full Color',3),
('p3','Cinta tubular',0),('p3','Cierre plástico o aluminio',1),('p3','Full Color',2),
('p4','100% Algodón Peinado',0),('p4','Moldería Clásica/Oversize',1),('p4','Estampado DTF',2),('p4','Talles S al XXL',3),
('p5','Friza Invisible',0),('p5','Costuras reforzadas',1),('p5','Capucha forrada',2),('p5','Cordón con puntera',3),
('p6','Hilo de Nylon',0),('p6','Tejido Jacquard',1),('p6','Alta resistencia',2),
('p7','Herrajes reforzados',0),('p7','Costura atraque',1),('p7','Doble cinta',2),('p7','Full Color',3),
('p8','Lienzo 100% Algodón',0),('p8','Estampado DTF',1),('p8','Manijas reforzadas',2),
('p9','Raso o Poliamida',0),('p9','Corte láser / calor',1),('p9','Resistentes a lavados',2);

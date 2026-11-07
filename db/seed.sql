-- ============================================================
--  Datos iniciales (ejecutar DESPUÉS de schema.sql)
-- ============================================================
BEGIN;

INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMIN',  'Administrador: productos, usuarios, cierres y configuración'),
  ('CAJERO', 'Cajero: ventas y manejo de su caja');

-- Usuario admin de demostración: admin@demo.com / Admin123*
-- CAMBIAR LA CONTRASEÑA EN PRODUCCIÓN.
INSERT INTO usuarios (nombre, email, password_hash, rol_id)
SELECT 'Administrador', 'admin@demo.com',
       crypt('Admin123*', gen_salt('bf')), id
FROM roles WHERE nombre = 'ADMIN';

INSERT INTO empresa (nit, dv, razon_social, nombre_comercial, direccion, ciudad, telefono, email, regimen)
VALUES ('900123456', '7', 'Mi Empresa S.A.S.', 'Mi Tienda', 'Calle 1 # 2-3', 'Bogotá', '3000000000',
        'contacto@miempresa.com', 'Responsable de IVA');

INSERT INTO cajas (nombre) VALUES ('Caja 1'), ('Caja 2');

INSERT INTO resoluciones (prefijo, rango_desde, rango_hasta, siguiente, vigencia_desde, vigencia_hasta, clave_tecnica)
VALUES ('SETP', 1, 5000, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 'CLAVE-TECNICA-DEMO');

INSERT INTO productos (codigo, nombre, precio_venta, costo, iva_pct, stock, stock_minimo) VALUES
  ('X01', 'Producto X01', 5000,  3000, 19, 100, 10),
  ('X02', 'Producto X02', 12000, 8000, 19, 50,  5),
  ('P01', 'Producto P01', 2500,  1500, 0,  200, 20);

COMMIT;

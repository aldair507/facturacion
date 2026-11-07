-- ============================================================
--  Sistema de facturación - PostgreSQL
--  Stack: Node.js + Express + PostgreSQL
--  Alcance: 1 tienda, varias cajas, roles ADMIN/CAJERO
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
CREATE TYPE tipo_documento      AS ENUM ('CC', 'NIT', 'CE', 'PP', 'TI');
CREATE TYPE tipo_mov_inventario AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');
CREATE TYPE estado_factura      AS ENUM ('BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA');
CREATE TYPE metodo_pago         AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'CREDITO');
CREATE TYPE estado_cierre       AS ENUM ('ABIERTO', 'CERRADO');
CREATE TYPE estado_dian         AS ENUM ('PENDIENTE', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'ERROR');

-- ------------------------------------------------------------
-- Empresa (una sola fila)
-- ------------------------------------------------------------
CREATE TABLE empresa (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nit             VARCHAR(20)  NOT NULL,
  dv              CHAR(1),
  razon_social    VARCHAR(200) NOT NULL,
  nombre_comercial VARCHAR(200),
  direccion       VARCHAR(200),
  ciudad          VARCHAR(100),
  telefono        VARCHAR(30),
  email           VARCHAR(120),
  regimen         VARCHAR(50),
  logo_url        TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Seguridad
-- ------------------------------------------------------------
CREATE TABLE roles (
  id     SMALLSERIAL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(120)
);

CREATE TABLE usuarios (
  id            BIGSERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  token_version INTEGER      NOT NULL DEFAULT 0,
  rol_id        SMALLINT     NOT NULL REFERENCES roles(id),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
CREATE TABLE clientes (
  id                     BIGSERIAL PRIMARY KEY,
  tipo_doc               tipo_documento NOT NULL DEFAULT 'CC',
  num_doc                VARCHAR(20)   NOT NULL,
  razon_social           VARCHAR(200)  NOT NULL,
  email                  VARCHAR(120),
  direccion              VARCHAR(200),
  telefono               VARCHAR(30),
  regimen                VARCHAR(50),
  responsabilidad_fiscal VARCHAR(50),
  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_doc, num_doc)
);

-- ------------------------------------------------------------
-- Productos e inventario
-- ------------------------------------------------------------
CREATE TABLE productos (
  id            BIGSERIAL PRIMARY KEY,
  codigo        VARCHAR(40)  NOT NULL UNIQUE,
  nombre        VARCHAR(200) NOT NULL,
  descripcion   TEXT,
  precio_venta  NUMERIC(14,2) NOT NULL CHECK (precio_venta >= 0),
  costo         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  iva_pct       NUMERIC(5,2)  NOT NULL DEFAULT 19 CHECK (iva_pct >= 0 AND iva_pct <= 100),
  unidad        VARCHAR(20)   NOT NULL DEFAULT 'UND',
  stock         NUMERIC(14,3) NOT NULL DEFAULT 0
                CONSTRAINT productos_stock_no_negativo CHECK (stock >= 0),
  stock_minimo  NUMERIC(14,3) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventario_movimientos (
  id             BIGSERIAL PRIMARY KEY,
  producto_id    BIGINT NOT NULL REFERENCES productos(id),
  tipo           tipo_mov_inventario NOT NULL,
  cantidad       NUMERIC(14,3) NOT NULL CHECK (cantidad <> 0),
  costo_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  motivo         VARCHAR(200),
  referencia     VARCHAR(100),
  usuario_id     BIGINT REFERENCES usuarios(id),
  factura_id     BIGINT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Cajas y cierres
-- ------------------------------------------------------------
CREATE TABLE cajas (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cierres_caja (
  id               BIGSERIAL PRIMARY KEY,
  caja_id          INT    NOT NULL REFERENCES cajas(id),
  usuario_id       BIGINT NOT NULL REFERENCES usuarios(id),
  fecha_apertura   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre     TIMESTAMPTZ,
  base_inicial     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ventas     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_efectivo   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_otros      NUMERIC(14,2) NOT NULL DEFAULT 0,
  efectivo_contado NUMERIC(14,2),
  diferencia       NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado           estado_cierre NOT NULL DEFAULT 'ABIERTO',
  observaciones    TEXT
);

CREATE UNIQUE INDEX cierres_caja_abierto_unico
  ON cierres_caja(caja_id)
  WHERE estado = 'ABIERTO';

-- ------------------------------------------------------------
-- Resoluciones (numeración DIAN)
-- ------------------------------------------------------------
CREATE TABLE resoluciones (
  id             SERIAL PRIMARY KEY,
  prefijo        VARCHAR(10) NOT NULL,
  rango_desde    INTEGER NOT NULL,
  rango_hasta    INTEGER NOT NULL,
  siguiente      INTEGER NOT NULL,
  vigencia_desde DATE NOT NULL,
  vigencia_hasta DATE NOT NULL,
  clave_tecnica  TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (rango_desde <= rango_hasta),
  CHECK (siguiente >= rango_desde AND siguiente <= rango_hasta + 1)
);

-- ------------------------------------------------------------
-- Facturas
-- ------------------------------------------------------------
CREATE TABLE facturas (
  id              BIGSERIAL PRIMARY KEY,
  prefijo         VARCHAR(10) NOT NULL,
  numero          INTEGER     NOT NULL,
  cliente_id      BIGINT REFERENCES clientes(id),
  usuario_id      BIGINT NOT NULL REFERENCES usuarios(id),
  caja_id         INT REFERENCES cajas(id),
  cierre_id       BIGINT REFERENCES cierres_caja(id),
  idempotency_key VARCHAR(80),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado          estado_factura NOT NULL DEFAULT 'BORRADOR',
  fecha_emision   TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulada_en      TIMESTAMPTZ,
  motivo_anulacion VARCHAR(200),
  UNIQUE (prefijo, numero),
  CONSTRAINT facturas_usuario_idempotency_key_unico
    UNIQUE (usuario_id, idempotency_key)
);

CREATE TABLE detalle_factura (
  id              BIGSERIAL PRIMARY KEY,
  factura_id      BIGINT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  producto_id     BIGINT REFERENCES productos(id),
  codigo          VARCHAR(40)  NOT NULL,
  descripcion     VARCHAR(200) NOT NULL,
  cantidad        NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
  descuento       NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  subtotal        NUMERIC(14,2) NOT NULL,
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL
);

CREATE TABLE pagos (
  id         BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  metodo     metodo_pago NOT NULL,
  monto      NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  referencia VARCHAR(100),
  idempotency_key VARCHAR(80),
  fecha      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pagos_factura_idempotency_key_unico
    UNIQUE (factura_id, idempotency_key)
);

ALTER TABLE inventario_movimientos
  ADD CONSTRAINT fk_mov_factura
  FOREIGN KEY (factura_id) REFERENCES facturas(id);

-- ------------------------------------------------------------
-- Facturación electrónica (DIAN / PAC)
-- ------------------------------------------------------------
CREATE TABLE facturas_electronicas (
  id             BIGSERIAL PRIMARY KEY,
  factura_id     BIGINT NOT NULL UNIQUE REFERENCES facturas(id) ON DELETE CASCADE,
  cufe           VARCHAR(120),
  estado         estado_dian NOT NULL DEFAULT 'PENDIENTE',
  xml_url        TEXT,
  pdf_url        TEXT,
  respuesta_dian JSONB,
  enviado_en     TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Auditoría
-- ------------------------------------------------------------
CREATE TABLE auditoria (
  id         BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id),
  accion     VARCHAR(50) NOT NULL,
  tabla      VARCHAR(50),
  registro_id TEXT,
  detalle    JSONB,
  ip         INET,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX idx_usuarios_rol        ON usuarios(rol_id);
CREATE INDEX idx_productos_codigo    ON productos(codigo);
CREATE INDEX idx_productos_activo    ON productos(activo);
CREATE INDEX idx_mov_producto        ON inventario_movimientos(producto_id, creado_en);
CREATE INDEX idx_facturas_fecha      ON facturas(fecha_emision);
CREATE INDEX idx_facturas_estado     ON facturas(estado);
CREATE INDEX idx_facturas_cliente    ON facturas(cliente_id);
CREATE INDEX idx_facturas_cierre     ON facturas(cierre_id);
CREATE INDEX idx_facturas_usuario    ON facturas(usuario_id, id DESC);
CREATE INDEX idx_facturas_caja_fecha ON facturas(caja_id, fecha_emision);
CREATE INDEX idx_facturas_estado_fecha ON facturas(estado, fecha_emision);
CREATE INDEX idx_cierres_caja_estado ON cierres_caja(caja_id, estado);
CREATE INDEX idx_cierres_fecha       ON cierres_caja(fecha_apertura);
CREATE INDEX idx_detalle_factura     ON detalle_factura(factura_id);
CREATE INDEX idx_pagos_factura       ON pagos(factura_id);
CREATE INDEX idx_pagos_fecha         ON pagos(fecha);
CREATE INDEX idx_mov_factura         ON inventario_movimientos(factura_id);
CREATE INDEX idx_mov_tipo_fecha      ON inventario_movimientos(tipo, creado_en);
CREATE INDEX idx_auditoria_fecha     ON auditoria(creado_en);
CREATE INDEX idx_auditoria_usuario   ON auditoria(usuario_id, creado_en);

-- ------------------------------------------------------------
-- Trigger: actualizar updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_productos_updated
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------------------------------
-- Trigger: mantener stock desde movimientos
--   ENTRADA suma, SALIDA resta, AJUSTE suma el delta (puede ser negativo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_mov_inventario_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'ENTRADA' THEN
    UPDATE productos SET stock = stock + NEW.cantidad WHERE id = NEW.producto_id;
  ELSIF NEW.tipo = 'SALIDA' THEN
    UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
  ELSE
    UPDATE productos SET stock = stock + NEW.cantidad WHERE id = NEW.producto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mov_inventario_stock
  AFTER INSERT ON inventario_movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_mov_inventario_stock();

-- Al anular la factura se revierte el stock (movimiento ENTRADA)
CREATE OR REPLACE FUNCTION fn_revertir_stock_anulacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'ANULADA' AND OLD.estado <> 'ANULADA' THEN
    INSERT INTO inventario_movimientos
      (producto_id, tipo, cantidad, motivo, referencia, usuario_id, factura_id)
    SELECT d.producto_id, 'ENTRADA', d.cantidad, 'Anulación de factura',
           NEW.prefijo || '-' || NEW.numero, NEW.usuario_id, NEW.id
    FROM detalle_factura d
    WHERE d.factura_id = NEW.id AND d.producto_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_factura_anulacion
  AFTER UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION fn_revertir_stock_anulacion();

-- ------------------------------------------------------------
-- Vistas de cierre / reportes
-- ------------------------------------------------------------
CREATE VIEW v_ventas_diarias AS
SELECT DATE(fecha_emision) AS dia,
       COUNT(*)                        AS facturas,
       COALESCE(SUM(subtotal), 0)      AS subtotal,
       COALESCE(SUM(descuento), 0)     AS descuento,
       COALESCE(SUM(iva_total), 0)     AS iva,
       COALESCE(SUM(total), 0)         AS total
FROM facturas
WHERE estado IN ('EMITIDA', 'PAGADA')
GROUP BY DATE(fecha_emision);

CREATE VIEW v_ventas_mensuales AS
SELECT date_trunc('month', fecha_emision) AS mes,
       COUNT(*)                        AS facturas,
       COALESCE(SUM(subtotal), 0)      AS subtotal,
       COALESCE(SUM(descuento), 0)     AS descuento,
       COALESCE(SUM(iva_total), 0)     AS iva,
       COALESCE(SUM(total), 0)         AS total
FROM facturas
WHERE estado IN ('EMITIDA', 'PAGADA')
GROUP BY date_trunc('month', fecha_emision);

CREATE VIEW v_ventas_anuales AS
SELECT date_trunc('year', fecha_emision) AS anio,
       COUNT(*)                        AS facturas,
       COALESCE(SUM(subtotal), 0)      AS subtotal,
       COALESCE(SUM(descuento), 0)     AS descuento,
       COALESCE(SUM(iva_total), 0)     AS iva,
       COALESCE(SUM(total), 0)         AS total
FROM facturas
WHERE estado IN ('EMITIDA', 'PAGADA')
GROUP BY date_trunc('year', fecha_emision);

-- Resumen para un rango arbitrario (cierre diario / mensual / anual)
CREATE OR REPLACE FUNCTION fn_resumen_ventas(p_desde DATE, p_hasta DATE)
RETURNS TABLE (
  facturas  BIGINT,
  subtotal  NUMERIC,
  descuento NUMERIC,
  iva       NUMERIC,
  total     NUMERIC
) AS $$
  SELECT COUNT(*),
         COALESCE(SUM(subtotal), 0),
         COALESCE(SUM(descuento), 0),
         COALESCE(SUM(iva_total), 0),
         COALESCE(SUM(total), 0)
  FROM facturas
  WHERE estado IN ('EMITIDA', 'PAGADA')
    AND fecha_emision >= p_desde
    AND fecha_emision < (p_hasta + INTERVAL '1 day');
$$ LANGUAGE sql STABLE;

COMMIT;

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM productos WHERE stock < 0) THEN
    RAISE EXCEPTION 'Existen productos con stock negativo; corrígelos antes de aplicar el CHECK';
  END IF;
END $$;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_usuario_idempotency_key_unico'
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_usuario_idempotency_key_unico
      UNIQUE (usuario_id, idempotency_key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_factura_idempotency_key_unico'
  ) THEN
    ALTER TABLE pagos
      ADD CONSTRAINT pagos_factura_idempotency_key_unico
      UNIQUE (factura_id, idempotency_key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_stock_no_negativo'
  ) THEN
    ALTER TABLE productos
      ADD CONSTRAINT productos_stock_no_negativo CHECK (stock >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facturas_usuario
  ON facturas(usuario_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_caja_fecha
  ON facturas(caja_id, fecha_emision);
CREATE INDEX IF NOT EXISTS idx_facturas_estado_fecha
  ON facturas(estado, fecha_emision);
CREATE INDEX IF NOT EXISTS idx_mov_factura
  ON inventario_movimientos(factura_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
  ON auditoria(usuario_id, creado_en);

COMMIT;

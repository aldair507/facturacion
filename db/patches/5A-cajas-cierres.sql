BEGIN;

ALTER TABLE cierres_caja
  ADD COLUMN IF NOT EXISTS efectivo_contado NUMERIC(14,2);

CREATE UNIQUE INDEX IF NOT EXISTS cierres_caja_abierto_unico
  ON cierres_caja(caja_id)
  WHERE estado = 'ABIERTO';

CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado
  ON cierres_caja(caja_id, estado);
CREATE INDEX IF NOT EXISTS idx_cierres_fecha
  ON cierres_caja(fecha_apertura);

COMMIT;

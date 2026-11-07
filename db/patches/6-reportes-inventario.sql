BEGIN;

CREATE INDEX IF NOT EXISTS idx_pagos_fecha
  ON pagos(fecha);

CREATE INDEX IF NOT EXISTS idx_mov_tipo_fecha
  ON inventario_movimientos(tipo, creado_en);

COMMIT;

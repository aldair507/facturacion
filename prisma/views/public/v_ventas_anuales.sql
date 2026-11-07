SELECT
  date_trunc('year' :: text, facturas.fecha_emision) AS anio,
  count(*) AS facturas,
  COALESCE(sum(facturas.subtotal), (0) :: numeric) AS subtotal,
  COALESCE(sum(facturas.descuento), (0) :: numeric) AS descuento,
  COALESCE(sum(facturas.iva_total), (0) :: numeric) AS iva,
  COALESCE(sum(facturas.total), (0) :: numeric) AS total
FROM
  facturas
WHERE
  (
    facturas.estado = ANY (
      ARRAY ['EMITIDA'::estado_factura, 'PAGADA'::estado_factura]
    )
  )
GROUP BY
  (date_trunc('year' :: text, facturas.fecha_emision));
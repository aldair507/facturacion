import type { Response } from 'express'

export interface ColumnaCsv<T> {
  encabezado: string
  valor: (fila: T) => unknown
}

function neutralizarFormula(texto: string): string {
  if (/^[=+@]/.test(texto)) {
    return `'${texto}`
  }

  if (/^-/.test(texto) && Number.isNaN(Number(texto))) {
    return `'${texto}`
  }

  return texto
}

function escaparValor(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return ''
  }

  const texto = neutralizarFormula(String(valor))

  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`
  }

  return texto
}

export function generarCsv<T>(filas: T[], columnas: ColumnaCsv<T>[]): string {
  const encabezado = columnas.map((columna) => escaparValor(columna.encabezado)).join(',')
  const cuerpo = filas.map((fila) =>
    columnas.map((columna) => escaparValor(columna.valor(fila))).join(','),
  )

  return `\uFEFF${[encabezado, ...cuerpo].join('\r\n')}\r\n`
}

export function enviarCsv(res: Response, nombre: string, contenido: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
  res.send(contenido)
}

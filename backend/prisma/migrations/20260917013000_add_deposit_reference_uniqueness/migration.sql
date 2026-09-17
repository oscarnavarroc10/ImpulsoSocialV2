CREATE UNIQUE INDEX `depositos_tienda_proveedor_referencia_key`
ON `depositos`(`tiendaId`, `proveedorPago`, `referenciaExterna`);

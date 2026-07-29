-- CreateTable
CREATE TABLE `tiendas` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tiendas_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `tiendaId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `rol` ENUM('cliente', 'administradorTienda', 'administradorPlataforma') NOT NULL DEFAULT 'cliente',
    `estado` ENUM('activo', 'bloqueado', 'eliminado') NOT NULL DEFAULT 'activo',
    `ultimoAccesoEn` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    INDEX `usuarios_tiendaId_estado_idx`(`tiendaId`, `estado`),
    UNIQUE INDEX `usuarios_tiendaId_email_key`(`tiendaId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesiones_usuario` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `revocadaEn` DATETIME(3) NULL,
    `direccionIp` VARCHAR(191) NULL,
    `dispositivo` VARCHAR(191) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sesiones_usuario_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `sesiones_usuario_usuarioId_expiraEn_idx`(`usuarioId`, `expiraEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billeteras` (
    `id` VARCHAR(191) NOT NULL,
    `tiendaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `saldoDisponible` INTEGER NOT NULL DEFAULT 0,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    INDEX `billeteras_tiendaId_idx`(`tiendaId`),
    UNIQUE INDEX `billeteras_usuarioId_moneda_key`(`usuarioId`, `moneda`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientos_saldo` (
    `id` VARCHAR(191) NOT NULL,
    `billeteraId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('deposito', 'compra', 'reembolso', 'ajusteCredito', 'ajusteDebito') NOT NULL,
    `monto` INTEGER NOT NULL,
    `saldoAnterior` INTEGER NOT NULL,
    `saldoPosterior` INTEGER NOT NULL,
    `referencia` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `creadoPorId` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimientos_saldo_billeteraId_creadoEn_idx`(`billeteraId`, `creadoEn`),
    INDEX `movimientos_saldo_referencia_idx`(`referencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `depositos` (
    `id` VARCHAR(191) NOT NULL,
    `tiendaId` VARCHAR(191) NOT NULL,
    `billeteraId` VARCHAR(191) NOT NULL,
    `monto` INTEGER NOT NULL,
    `moneda` VARCHAR(191) NOT NULL,
    `metodo` ENUM('transferencia', 'tarjeta', 'criptomoneda', 'saldoManual', 'otro') NOT NULL,
    `estado` ENUM('pendiente', 'aprobado', 'rechazado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    `proveedorPago` VARCHAR(191) NULL,
    `referenciaExterna` VARCHAR(191) NULL,
    `comprobanteUrl` VARCHAR(191) NULL,
    `datosProveedor` JSON NULL,
    `aprobadoPorId` VARCHAR(191) NULL,
    `aprobadoEn` DATETIME(3) NULL,
    `rechazadoEn` DATETIME(3) NULL,
    `motivoRechazo` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    INDEX `depositos_tiendaId_estado_idx`(`tiendaId`, `estado`),
    INDEX `depositos_billeteraId_creadoEn_idx`(`billeteraId`, `creadoEn`),
    INDEX `depositos_proveedorPago_referenciaExterna_idx`(`proveedorPago`, `referenciaExterna`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordenes` (
    `id` VARCHAR(191) NOT NULL,
    `tiendaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `servicioId` VARCHAR(191) NOT NULL,
    `enlace` VARCHAR(191) NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precioTotal` INTEGER NOT NULL,
    `monedaVenta` VARCHAR(191) NOT NULL,
    `costoProveedor` INTEGER NULL,
    `monedaProveedor` VARCHAR(191) NULL,
    `estado` ENUM('pendiente', 'enviando', 'enviadaProveedor', 'enProgreso', 'parcial', 'completada', 'cancelada', 'fallida', 'reembolsada') NOT NULL DEFAULT 'pendiente',
    `conteoInicial` INTEGER NULL,
    `restante` INTEGER NULL,
    `mensajeError` VARCHAR(191) NULL,
    `enviadaProveedorEn` DATETIME(3) NULL,
    `completadaEn` DATETIME(3) NULL,
    `canceladaEn` DATETIME(3) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    INDEX `ordenes_tiendaId_estado_idx`(`tiendaId`, `estado`),
    INDEX `ordenes_usuarioId_creadaEn_idx`(`usuarioId`, `creadaEn`),
    INDEX `ordenes_servicioId_idx`(`servicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordenes_proveedor` (
    `id` VARCHAR(191) NOT NULL,
    `ordenId` VARCHAR(191) NOT NULL,
    `proveedor` VARCHAR(191) NOT NULL,
    `idExterno` VARCHAR(191) NULL,
    `estadoExterno` VARCHAR(191) NULL,
    `cargoProveedor` INTEGER NULL,
    `moneda` VARCHAR(191) NULL,
    `solicitudOriginal` JSON NULL,
    `respuestaOriginal` JSON NULL,
    `ultimaConsultaEn` DATETIME(3) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ordenes_proveedor_ordenId_key`(`ordenId`),
    INDEX `ordenes_proveedor_proveedor_estadoExterno_idx`(`proveedor`, `estadoExterno`),
    UNIQUE INDEX `ordenes_proveedor_proveedor_idExterno_key`(`proveedor`, `idExterno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_ordenes` (
    `id` VARCHAR(191) NOT NULL,
    `ordenId` VARCHAR(191) NOT NULL,
    `estadoAnterior` ENUM('pendiente', 'enviando', 'enviadaProveedor', 'enProgreso', 'parcial', 'completada', 'cancelada', 'fallida', 'reembolsada') NULL,
    `estadoNuevo` ENUM('pendiente', 'enviando', 'enviadaProveedor', 'enProgreso', 'parcial', 'completada', 'cancelada', 'fallida', 'reembolsada') NOT NULL,
    `origen` VARCHAR(191) NOT NULL,
    `comentario` VARCHAR(191) NULL,
    `datosProveedor` JSON NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historial_ordenes_ordenId_creadoEn_idx`(`ordenId`, `creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitudes_reposicion` (
    `id` VARCHAR(191) NOT NULL,
    `ordenId` VARCHAR(191) NOT NULL,
    `estado` ENUM('pendiente', 'enviada', 'completada', 'rechazada', 'fallida') NOT NULL DEFAULT 'pendiente',
    `idExterno` VARCHAR(191) NULL,
    `respuestaProveedor` JSON NULL,
    `mensajeError` VARCHAR(191) NULL,
    `solicitadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,
    `completadaEn` DATETIME(3) NULL,

    INDEX `solicitudes_reposicion_ordenId_estado_idx`(`ordenId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitudes_cancelacion` (
    `id` VARCHAR(191) NOT NULL,
    `ordenId` VARCHAR(191) NOT NULL,
    `estado` ENUM('pendiente', 'enviada', 'completada', 'rechazada', 'fallida') NOT NULL DEFAULT 'pendiente',
    `respuestaProveedor` JSON NULL,
    `mensajeError` VARCHAR(191) NULL,
    `solicitadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,
    `completadaEn` DATETIME(3) NULL,

    INDEX `solicitudes_cancelacion_ordenId_estado_idx`(`ordenId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saldos_proveedor` (
    `id` VARCHAR(191) NOT NULL,
    `proveedor` VARCHAR(191) NOT NULL,
    `saldo` INTEGER NOT NULL,
    `moneda` VARCHAR(191) NOT NULL,
    `respuestaOriginal` JSON NULL,
    `consultadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `saldos_proveedor_proveedor_consultadoEn_idx`(`proveedor`, `consultadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenantServiceOverride` ADD CONSTRAINT `TenantServiceOverride_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tiendas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantServiceOverride` ADD CONSTRAINT `TenantServiceOverride_masterServiceId_fkey` FOREIGN KEY (`masterServiceId`) REFERENCES `MasterService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_tiendaId_fkey` FOREIGN KEY (`tiendaId`) REFERENCES `tiendas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesiones_usuario` ADD CONSTRAINT `sesiones_usuario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billeteras` ADD CONSTRAINT `billeteras_tiendaId_fkey` FOREIGN KEY (`tiendaId`) REFERENCES `tiendas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billeteras` ADD CONSTRAINT `billeteras_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_saldo` ADD CONSTRAINT `movimientos_saldo_billeteraId_fkey` FOREIGN KEY (`billeteraId`) REFERENCES `billeteras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depositos` ADD CONSTRAINT `depositos_tiendaId_fkey` FOREIGN KEY (`tiendaId`) REFERENCES `tiendas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depositos` ADD CONSTRAINT `depositos_billeteraId_fkey` FOREIGN KEY (`billeteraId`) REFERENCES `billeteras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes` ADD CONSTRAINT `ordenes_tiendaId_fkey` FOREIGN KEY (`tiendaId`) REFERENCES `tiendas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes` ADD CONSTRAINT `ordenes_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes` ADD CONSTRAINT `ordenes_servicioId_fkey` FOREIGN KEY (`servicioId`) REFERENCES `MasterService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes_proveedor` ADD CONSTRAINT `ordenes_proveedor_ordenId_fkey` FOREIGN KEY (`ordenId`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_ordenes` ADD CONSTRAINT `historial_ordenes_ordenId_fkey` FOREIGN KEY (`ordenId`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_reposicion` ADD CONSTRAINT `solicitudes_reposicion_ordenId_fkey` FOREIGN KEY (`ordenId`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_cancelacion` ADD CONSTRAINT `solicitudes_cancelacion_ordenId_fkey` FOREIGN KEY (`ordenId`) REFERENCES `ordenes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

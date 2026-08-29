-- AlterTable
ALTER TABLE `ordenes`
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD COLUMN `requestFingerprint` CHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ordenes_tiendaId_usuarioId_idempotencyKey_key`
    ON `ordenes`(`tiendaId`, `usuarioId`, `idempotencyKey`);

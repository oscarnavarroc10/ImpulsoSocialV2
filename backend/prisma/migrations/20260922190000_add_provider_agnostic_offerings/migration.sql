-- Feature 013: additive provider-offering foundation.
-- Intentionally preserves the legacy ordenes_proveedor.moneda column, which is
-- present in the database but no longer modeled by Prisma.

-- AlterTable
ALTER TABLE `ordenes`
    ADD COLUMN `datosEntradaPrivada` JSON NULL;

-- AlterTable
ALTER TABLE `ordenes_proveedor`
    ADD COLUMN `capabilityContractVersionSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `capabilityKeySnapshot` VARCHAR(191) NULL,
    ADD COLUMN `offeringId` VARCHAR(191) NULL,
    ADD COLUMN `offeringSnapshot` JSON NULL,
    ADD COLUMN `providerServiceId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MasterServiceProviderOffering` (
    `id` VARCHAR(191) NOT NULL,
    `masterServiceId` VARCHAR(191) NOT NULL,
    `providerServiceId` VARCHAR(191) NOT NULL,
    `capabilityKey` ENUM('STANDARD', 'CUSTOM_COMMENTS') NOT NULL,
    `contractVersion` VARCHAR(191) NOT NULL,
    `contract` JSON NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `isSelected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MasterServiceProviderOffering_masterServiceId_isEnabled_isAv_idx`(`masterServiceId`, `isEnabled`, `isAvailable`, `isSelected`),
    INDEX `MasterServiceProviderOffering_providerServiceId_isEnabled_is_idx`(`providerServiceId`, `isEnabled`, `isAvailable`),
    UNIQUE INDEX `MasterServiceProviderOffering_masterServiceId_providerServic_key`(`masterServiceId`, `providerServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ordenes_proveedor_offeringId_estadoExterno_idx`
    ON `ordenes_proveedor`(`offeringId`, `estadoExterno`);

-- CreateIndex
CREATE INDEX `ordenes_proveedor_providerServiceId_idExterno_idx`
    ON `ordenes_proveedor`(`providerServiceId`, `idExterno`);

-- AddForeignKey
ALTER TABLE `MasterServiceProviderOffering`
    ADD CONSTRAINT `MasterServiceProviderOffering_masterServiceId_fkey`
    FOREIGN KEY (`masterServiceId`) REFERENCES `MasterService`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MasterServiceProviderOffering`
    ADD CONSTRAINT `MasterServiceProviderOffering_providerServiceId_fkey`
    FOREIGN KEY (`providerServiceId`) REFERENCES `ProviderService`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes_proveedor`
    ADD CONSTRAINT `ordenes_proveedor_offeringId_fkey`
    FOREIGN KEY (`offeringId`) REFERENCES `MasterServiceProviderOffering`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes_proveedor`
    ADD CONSTRAINT `ordenes_proveedor_providerServiceId_fkey`
    FOREIGN KEY (`providerServiceId`) REFERENCES `ProviderService`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

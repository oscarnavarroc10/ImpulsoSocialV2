-- DropForeignKey
ALTER TABLE `StagedService`
DROP FOREIGN KEY `StagedService_providerServiceId_fkey`;

-- DropIndex
DROP INDEX `StagedService_providerServiceId_key`
ON `StagedService`;

-- CreateIndex
CREATE INDEX `StagedService_providerServiceId_reviewStatus_idx`
ON `StagedService`(`providerServiceId`, `reviewStatus`);

-- AddForeignKey
ALTER TABLE `StagedService`
ADD CONSTRAINT `StagedService_providerServiceId_fkey`
FOREIGN KEY (`providerServiceId`)
REFERENCES `ProviderService`(`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;
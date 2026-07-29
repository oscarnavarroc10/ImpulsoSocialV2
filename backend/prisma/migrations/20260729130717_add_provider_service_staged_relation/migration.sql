/*
  Warnings:

  - A unique constraint covering the columns `[providerServiceId]` on the table `StagedService` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `StagedService_providerServiceId_key` ON `StagedService`(`providerServiceId`);

-- AddForeignKey
ALTER TABLE `StagedService` ADD CONSTRAINT `StagedService_providerServiceId_fkey` FOREIGN KEY (`providerServiceId`) REFERENCES `ProviderService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

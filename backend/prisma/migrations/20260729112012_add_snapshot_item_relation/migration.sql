/*
  Warnings:

  - Added the required column `snapshotId` to the `MasterCatalogSnapshotItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `MasterCatalogSnapshotItem` ADD COLUMN `snapshotId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `MasterCatalogSnapshotItem_snapshotId_idx` ON `MasterCatalogSnapshotItem`(`snapshotId`);

-- AddForeignKey
ALTER TABLE `MasterCatalogSnapshotItem` ADD CONSTRAINT `MasterCatalogSnapshotItem_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `MasterCatalogSnapshot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

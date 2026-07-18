-- CreateTable
CREATE TABLE `MasterService` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `socialNetwork` VARCHAR(191) NOT NULL,
    `providerCostAmount` INTEGER NOT NULL,
    `providerCostCurrency` VARCHAR(191) NOT NULL,
    `defaultSellingPriceAmount` INTEGER NOT NULL,
    `defaultSellingPriceCurrency` VARCHAR(191) NOT NULL,
    `isVisible` BOOLEAN NOT NULL,
    `status` ENUM('draft', 'active', 'deprecated') NOT NULL,
    `provenanceRef` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderService` (
    `id` VARCHAR(191) NOT NULL,
    `providerOrigin` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `rawPayload` JSON NOT NULL,
    `importTimestamp` DATETIME(3) NOT NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `ProviderService_providerOrigin_externalId_key`(`providerOrigin`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StagedService` (
    `id` VARCHAR(191) NOT NULL,
    `providerServiceId` VARCHAR(191) NOT NULL,
    `ingestedAt` DATETIME(3) NOT NULL,
    `reviewStatus` VARCHAR(191) NOT NULL,
    `proposedTitle` VARCHAR(191) NULL,
    `proposedDescription` VARCHAR(191) NULL,
    `proposedCategoryId` VARCHAR(191) NULL,
    `proposedSocialNetwork` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantServiceOverride` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `masterServiceId` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL,
    `sellingPriceAmount` INTEGER NULL,
    `sellingPriceCurrency` VARCHAR(191) NULL,

    UNIQUE INDEX `TenantServiceOverride_tenantId_masterServiceId_key`(`tenantId`, `masterServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MasterCatalogSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MasterCatalogSnapshotItem` (
    `id` VARCHAR(191) NOT NULL,
    `masterServiceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `categoryName` VARCHAR(191) NOT NULL,
    `socialNetwork` VARCHAR(191) NOT NULL,
    `sellingPriceAmount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `serviceStatus` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncJob` (
    `id` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `summary` JSON NULL,
    `source` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `details` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

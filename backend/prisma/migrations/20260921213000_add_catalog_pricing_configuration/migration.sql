-- CreateTable
CREATE TABLE `CatalogPricingConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `sellingPriceMultiplier` DECIMAL(10, 4) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the singleton catalog pricing configuration with the neutral multiplier.
INSERT INTO `CatalogPricingConfiguration` (`id`, `sellingPriceMultiplier`, `updatedAt`)
VALUES ('default', 1.0000, CURRENT_TIMESTAMP(3));

-- CreateTable
CREATE TABLE "CEO" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "dailyRatePercent" DECIMAL(5,4) NOT NULL,
    "cycleHours" INTEGER NOT NULL DEFAULT 4,
    "energyCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CEO_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CEO_slug_key" ON "CEO"("slug");

-- Seed CEOs idempotently (simulation-only rates; no real earnings)
INSERT INTO "CEO" ("name", "slug", "rarity", "priceUsd", "dailyRatePercent", "cycleHours", "energyCost", "isActive")
VALUES
    ('Junior Developer', 'junior-developer', 'Common', 5.00, 0.1500, 4, 10, true),
    ('Product Manager', 'product-manager', 'Common', 15.00, 0.1800, 4, 12, true),
    ('Marketing Director', 'marketing-director', 'Rare', 30.00, 0.2000, 4, 15, true),
    ('Startup Founder', 'startup-founder', 'Rare', 50.00, 0.2200, 4, 18, true),
    ('AI Architect', 'ai-architect', 'Epic', 100.00, 0.2500, 4, 22, true),
    ('Cloud Executive', 'cloud-executive', 'Epic', 200.00, 0.2800, 4, 25, true),
    ('Tech Billionaire', 'tech-billionaire', 'Legendary', 500.00, 0.3000, 4, 30, true),
    ('Crypto Whale', 'crypto-whale', 'Mythic', 1000.00, 0.3500, 4, 40, true)
ON CONFLICT ("slug") DO NOTHING;

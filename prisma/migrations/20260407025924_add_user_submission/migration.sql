-- CreateTable
CREATE TABLE "UserSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appName" TEXT NOT NULL,
    "privacyUrl" TEXT NOT NULL,
    "termsUrl" TEXT,
    "submitterEmail" TEXT,
    "ipHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "appId" TEXT,
    "appStoreTrackId" INTEGER,
    "normalizedUrlFingerprint" TEXT NOT NULL,
    "reviewPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "approvedAt" DATETIME,
    CONSTRAINT "UserSubmission_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSubmission_appId_key" ON "UserSubmission"("appId");

-- CreateIndex
CREATE INDEX "UserSubmission_status_idx" ON "UserSubmission"("status");

-- CreateIndex
CREATE INDEX "UserSubmission_createdAt_idx" ON "UserSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "UserSubmission_normalizedUrlFingerprint_idx" ON "UserSubmission"("normalizedUrlFingerprint");

-- CreateIndex
CREATE INDEX "UserSubmission_ipHash_createdAt_idx" ON "UserSubmission"("ipHash", "createdAt");

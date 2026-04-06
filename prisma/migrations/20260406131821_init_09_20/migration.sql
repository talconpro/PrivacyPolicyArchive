-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "bundleId" TEXT,
    "category" TEXT,
    "developer" TEXT,
    "iconUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'PRIVACY_POLICY',
    "sourceUrl" TEXT NOT NULL,
    "checksum" TEXT,
    "contentHash" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "contentType" TEXT,
    "fetchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "PolicyVersion_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyVersionId" TEXT NOT NULL,
    "oneLineSummary" TEXT,
    "summary" TEXT,
    "riskScore" REAL,
    "riskLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "riskReasons" TEXT,
    "confidence" REAL,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewPriority" INTEGER,
    "normalizedPayload" TEXT,
    "modelName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "fromVersionId" TEXT NOT NULL,
    "toVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyChange_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyChange_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "PolicyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyChange_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "PolicyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyChangeSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "fromVersionId" TEXT NOT NULL,
    "toVersionId" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "changeHighlights" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyChangeSummary_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyChangeSummary_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "PolicyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyChangeSummary_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "PolicyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "App_bundleId_key" ON "App"("bundleId");

-- CreateIndex
CREATE INDEX "App_name_idx" ON "App"("name");

-- CreateIndex
CREATE INDEX "App_category_idx" ON "App"("category");

-- CreateIndex
CREATE INDEX "PolicyVersion_appId_isCurrent_idx" ON "PolicyVersion"("appId", "isCurrent");

-- CreateIndex
CREATE INDEX "PolicyVersion_appId_fetchedAt_idx" ON "PolicyVersion"("appId", "fetchedAt");

-- CreateIndex
CREATE INDEX "PolicyVersion_fetchStatus_idx" ON "PolicyVersion"("fetchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_appId_contentHash_key" ON "PolicyVersion"("appId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_appId_documentType_versionNo_key" ON "PolicyVersion"("appId", "documentType", "versionNo");

-- CreateIndex
CREATE INDEX "Analysis_policyVersionId_riskLevel_idx" ON "Analysis"("policyVersionId", "riskLevel");

-- CreateIndex
CREATE INDEX "Analysis_riskLevel_needsHumanReview_idx" ON "Analysis"("riskLevel", "needsHumanReview");

-- CreateIndex
CREATE INDEX "Analysis_reviewStatus_reviewPriority_idx" ON "Analysis"("reviewStatus", "reviewPriority");

-- CreateIndex
CREATE INDEX "PolicyChange_appId_createdAt_idx" ON "PolicyChange"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyChange_riskLevel_idx" ON "PolicyChange"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyChange_fromVersionId_toVersionId_title_key" ON "PolicyChange"("fromVersionId", "toVersionId", "title");

-- CreateIndex
CREATE INDEX "PolicyChangeSummary_appId_createdAt_idx" ON "PolicyChangeSummary"("appId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyChangeSummary_fromVersionId_toVersionId_key" ON "PolicyChangeSummary"("fromVersionId", "toVersionId");

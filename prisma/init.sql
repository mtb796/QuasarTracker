-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "tenantId" TEXT,
    "ownerId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handoff" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "propertyId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Handoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "appfolioId" TEXT,
    "name" TEXT NOT NULL,
    "address1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "propertyType" TEXT,
    "workStatus" TEXT,
    "ownerId" TEXT,
    "raw" TEXT,
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "appfolioId" TEXT,
    "name" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bedrooms" DOUBLE PRECISION,
    "bathrooms" DOUBLE PRECISION,
    "squareFeet" INTEGER,
    "marketRent" DOUBLE PRECISION,
    "occupancy" TEXT NOT NULL DEFAULT 'unknown',
    "workStatus" TEXT,
    "raw" TEXT,
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "appfolioId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "unitId" TEXT,
    "propertyId" TEXT,
    "leaseStart" TIMESTAMP(3),
    "leaseEnd" TIMESTAMP(3),
    "rent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "raw" TEXT,
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseEnd" TIMESTAMP(3) NOT NULL,
    "proposedRent" DOUBLE PRECISION,
    "decision" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalStep" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT,

    CONSTRAINT "RenewalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "appfolioId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "raw" TEXT,
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "rowsFetched" INTEGER NOT NULL DEFAULT 0,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "columns" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Note_propertyId_createdAt_idx" ON "Note"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_unitId_createdAt_idx" ON "Note"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Handoff_status_dueDate_idx" ON "Handoff"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Handoff_assigneeId_status_idx" ON "Handoff"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Property_appfolioId_key" ON "Property"("appfolioId");

-- CreateIndex
CREATE INDEX "Property_name_idx" ON "Property"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_appfolioId_key" ON "Unit"("appfolioId");

-- CreateIndex
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

-- CreateIndex
CREATE INDEX "Unit_occupancy_idx" ON "Unit"("occupancy");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_appfolioId_key" ON "Tenant"("appfolioId");

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_leaseEnd_idx" ON "Tenant"("leaseEnd");

-- CreateIndex
CREATE INDEX "Renewal_leaseEnd_idx" ON "Renewal"("leaseEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Renewal_tenantId_leaseEnd_key" ON "Renewal"("tenantId", "leaseEnd");

-- CreateIndex
CREATE INDEX "RenewalStep_status_dueOn_idx" ON "RenewalStep"("status", "dueOn");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalStep_renewalId_milestone_key" ON "RenewalStep"("renewalId", "milestone");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_appfolioId_key" ON "Owner"("appfolioId");

-- CreateIndex
CREATE INDEX "Owner_name_idx" ON "Owner"("name");

-- CreateIndex
CREATE INDEX "EmailLog_to_kind_day_idx" ON "EmailLog"("to", "kind", "day");

-- CreateIndex
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalStep" ADD CONSTRAINT "RenewalStep_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "Renewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalStep" ADD CONSTRAINT "RenewalStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


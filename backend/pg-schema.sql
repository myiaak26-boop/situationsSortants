-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "avatar" TEXT,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signataire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courrier" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL,
    "destinataire" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "signataire" TEXT NOT NULL,
    "signataireId" TEXT,
    "numeroEntrant" TEXT,
    "dateArriveeEntrant" TIMESTAMP(3),
    "nombrePages" INTEGER,
    "expediteur" TEXT,
    "dateObservation" TIMESTAMP(3),
    "dureeTraitement" DOUBLE PRECISION,
    "situationId" TEXT NOT NULL,
    "observation" TEXT,
    "modeTransmissionId" TEXT,
    "modeEnvoi" TEXT,
    "nbrRappels" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "couleur" TEXT NOT NULL DEFAULT 'gray',
    "icone" TEXT,
    "estInitial" BOOLEAN NOT NULL DEFAULT false,
    "estFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Situation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL,
    "modeTransmissionId" TEXT,
    "fromSituationId" TEXT NOT NULL,
    "toSituationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "alerte" BOOLEAN NOT NULL DEFAULT false,
    "demandeRetrait" BOOLEAN NOT NULL DEFAULT false,
    "estRappel" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeTransmission" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "couleur" TEXT NOT NULL DEFAULT '#6B7280',
    "icone" TEXT,
    "cle" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeTransmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueAction" (
    "id" TEXT NOT NULL,
    "courrierId" TEXT NOT NULL,
    "transitionId" TEXT,
    "fromSituationId" TEXT,
    "toSituationId" TEXT,
    "action" TEXT NOT NULL,
    "commentaire" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriqueAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retrait" (
    "id" TEXT NOT NULL,
    "courrierId" TEXT NOT NULL,
    "nomRetraitant" TEXT NOT NULL,
    "telephone" TEXT,
    "observation" TEXT,
    "retireParId" TEXT NOT NULL,
    "dateRetrait" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "ancienneValeur" TEXT,
    "nouvelleValeur" TEXT,
    "ip" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "situationType" TEXT NOT NULL DEFAULT 'Générale',
    "periode" TEXT NOT NULL,
    "filtres" TEXT NOT NULL,
    "params" TEXT NOT NULL DEFAULT '',
    "nbCourriers" INTEGER NOT NULL,
    "taille" INTEGER NOT NULL DEFAULT 0,
    "userNom" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "nbLignes" INTEGER NOT NULL,
    "nbImportes" INTEGER NOT NULL,
    "nbIgnores" INTEGER NOT NULL,
    "nbMaj" INTEGER NOT NULL,
    "nbErreurs" INTEGER NOT NULL,
    "dureeMs" INTEGER NOT NULL,
    "resultat" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Signataire_code_key" ON "Signataire"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Courrier_numero_key" ON "Courrier"("numero");

-- CreateIndex
CREATE INDEX "Courrier_dateEnvoi_idx" ON "Courrier"("dateEnvoi");

-- CreateIndex
CREATE INDEX "Courrier_signataire_idx" ON "Courrier"("signataire");

-- CreateIndex
CREATE INDEX "Courrier_situationId_idx" ON "Courrier"("situationId");

-- CreateIndex
CREATE INDEX "Courrier_modeTransmissionId_idx" ON "Courrier"("modeTransmissionId");

-- CreateIndex
CREATE INDEX "Courrier_signataireId_idx" ON "Courrier"("signataireId");

-- CreateIndex
CREATE INDEX "Courrier_deletedAt_idx" ON "Courrier"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Situation_nom_key" ON "Situation"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Transition_modeTransmissionId_fromSituationId_toSituationId_key" ON "Transition"("modeTransmissionId", "fromSituationId", "toSituationId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeTransmission_nom_key" ON "ModeTransmission"("nom");

-- CreateIndex
CREATE INDEX "HistoriqueAction_courrierId_idx" ON "HistoriqueAction"("courrierId");

-- CreateIndex
CREATE INDEX "HistoriqueAction_createdAt_idx" ON "HistoriqueAction"("createdAt");

-- CreateIndex
CREATE INDEX "HistoriqueAction_userId_idx" ON "HistoriqueAction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Retrait_courrierId_key" ON "Retrait"("courrierId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Parametre_cle_key" ON "Parametre"("cle");

-- CreateIndex
CREATE INDEX "SituationLog_createdAt_idx" ON "SituationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_createdAt_idx" ON "ImportLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_modeTransmissionId_fkey" FOREIGN KEY ("modeTransmissionId") REFERENCES "ModeTransmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_signataireId_fkey" FOREIGN KEY ("signataireId") REFERENCES "Signataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_fromSituationId_fkey" FOREIGN KEY ("fromSituationId") REFERENCES "Situation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_toSituationId_fkey" FOREIGN KEY ("toSituationId") REFERENCES "Situation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_modeTransmissionId_fkey" FOREIGN KEY ("modeTransmissionId") REFERENCES "ModeTransmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueAction" ADD CONSTRAINT "HistoriqueAction_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "Courrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueAction" ADD CONSTRAINT "HistoriqueAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueAction" ADD CONSTRAINT "HistoriqueAction_fromSituationId_fkey" FOREIGN KEY ("fromSituationId") REFERENCES "Situation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueAction" ADD CONSTRAINT "HistoriqueAction_toSituationId_fkey" FOREIGN KEY ("toSituationId") REFERENCES "Situation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrait" ADD CONSTRAINT "Retrait_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "Courrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrait" ADD CONSTRAINT "Retrait_retireParId_fkey" FOREIGN KEY ("retireParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


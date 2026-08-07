-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "avatar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Signataire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Courrier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "dateEnvoi" DATETIME NOT NULL,
    "destinataire" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "signataire" TEXT NOT NULL,
    "signataireId" TEXT,
    "numeroEntrant" TEXT,
    "dateArriveeEntrant" DATETIME,
    "situationId" TEXT NOT NULL,
    "observation" TEXT,
    "modeTransmissionId" TEXT,
    "modeEnvoi" TEXT,
    "nbrRappels" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Courrier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Courrier_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Courrier_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Courrier_modeTransmissionId_fkey" FOREIGN KEY ("modeTransmissionId") REFERENCES "ModeTransmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Courrier_signataireId_fkey" FOREIGN KEY ("signataireId") REFERENCES "Signataire" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "couleur" TEXT NOT NULL DEFAULT 'gray',
    "icone" TEXT,
    "estInitial" BOOLEAN NOT NULL DEFAULT false,
    "estFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transition_fromSituationId_fkey" FOREIGN KEY ("fromSituationId") REFERENCES "Situation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transition_toSituationId_fkey" FOREIGN KEY ("toSituationId") REFERENCES "Situation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transition_modeTransmissionId_fkey" FOREIGN KEY ("modeTransmissionId") REFERENCES "ModeTransmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeTransmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "couleur" TEXT NOT NULL DEFAULT '#6B7280',
    "icone" TEXT,
    "cle" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HistoriqueAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courrierId" TEXT NOT NULL,
    "transitionId" TEXT,
    "fromSituationId" TEXT,
    "toSituationId" TEXT,
    "action" TEXT NOT NULL,
    "commentaire" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoriqueAction_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "Courrier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoriqueAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistoriqueAction_fromSituationId_fkey" FOREIGN KEY ("fromSituationId") REFERENCES "Situation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HistoriqueAction_toSituationId_fkey" FOREIGN KEY ("toSituationId") REFERENCES "Situation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Retrait" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courrierId" TEXT NOT NULL,
    "nomRetraitant" TEXT NOT NULL,
    "telephone" TEXT,
    "observation" TEXT,
    "retireParId" TEXT NOT NULL,
    "dateRetrait" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Retrait_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "Courrier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retrait_retireParId_fkey" FOREIGN KEY ("retireParId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "ancienneValeur" TEXT,
    "nouvelleValeur" TEXT,
    "ip" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Parametre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SituationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "filtres" TEXT NOT NULL,
    "nbCourriers" INTEGER NOT NULL,
    "userNom" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "Situation_nom_key" ON "Situation"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Transition_modeTransmissionId_fromSituationId_toSituationId_key" ON "Transition"("modeTransmissionId", "fromSituationId", "toSituationId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeTransmission_nom_key" ON "ModeTransmission"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Retrait_courrierId_key" ON "Retrait"("courrierId");

-- CreateIndex
CREATE UNIQUE INDEX "Parametre_cle_key" ON "Parametre"("cle");

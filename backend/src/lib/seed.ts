import type { PrismaClient } from '@prisma/client'
import { hashPassword } from './password.js'

export async function seedDatabase(db: PrismaClient) {
  const defaultPassword = process.env.DEX_ADMIN_PASSWORD || 'admin123'
  const userDefaultPassword = process.env.DEX_USER_DEFAULT_PASSWORD || 'Dex1234'
  const adminRole = await db.role.upsert({
    where: { name: 'Administrateur' },
    update: {},
    create: {
      name: 'Administrateur',
      description: 'Accès complet à toutes les fonctionnalités',
      permissions: JSON.stringify(['*']),
    },
  })

  await db.role.upsert({
    where: { name: 'Super Administrateur' },
    update: {},
    create: {
      name: 'Super Administrateur',
      description: 'Accès total, y compris la suppression des courriers',
      permissions: JSON.stringify(['*']),
    },
  })

  const userRolePerms = JSON.stringify([
    'courrier:read',
    'courrier:write',
    'courrier:history',
    'courrier:update-situation',
    'courrier:print',
    'import',
    'situation:read',
    'situation:export',
    'statistique:read',
  ])

  const userRole = await db.role.upsert({
    where: { name: 'Utilisateur' },
    update: { permissions: userRolePerms },
    create: {
      name: 'Utilisateur',
      description: 'Import, suivi et consultation',
      permissions: userRolePerms,
    },
  })

  await db.user.upsert({
    where: { email: 'admin@dex.local' },
    update: {},
    create: {
      email: 'admin@dex.local',
      name: 'Admin DEX',
      roleId: adminRole.id,
      active: true,
      passwordHash: hashPassword(defaultPassword),
    },
  })

  await db.user.updateMany({
    where: { email: 'admin@dex.local', passwordHash: null },
    data: { passwordHash: hashPassword(defaultPassword) },
  })

  await db.user.updateMany({
    where: { passwordHash: null },
    data: { passwordHash: hashPassword(userDefaultPassword) },
  })

  console.log(`🔑 Mot de passe par défaut du compte admin@dex.local : ${defaultPassword}`)
  console.log(`🔑 Mot de passe par défaut des nouveaux utilisateurs : ${userDefaultPassword}`)

  const situations = [
    { nom: 'Nouveau', ordre: 0, couleur: '#6B7280', icone: 'FileText', estInitial: true, estFinal: false },
    { nom: 'Appel effectué', ordre: 10, couleur: '#3B82F6', icone: 'Phone', estInitial: false, estFinal: false },
    { nom: 'Injoignable', ordre: 20, couleur: '#F59E0B', icone: 'PhoneOff', estInitial: false, estFinal: false },
    { nom: 'Destinataire joint', ordre: 30, couleur: '#10B981', icone: 'PhoneCall', estInitial: false, estFinal: false },
    { nom: 'Retiré', ordre: 50, couleur: '#059669', icone: 'PackageCheck', estInitial: false, estFinal: true },
    { nom: 'Auprès du coursier', ordre: 80, couleur: '#F59E0B', icone: 'Truck', estInitial: false, estFinal: false },
    { nom: 'Livré', ordre: 90, couleur: '#059669', icone: 'PackageCheck', estInitial: false, estFinal: true },
  ]

  const createdSituations: Record<string, string> = {}
  for (const s of situations) {
    const created = await db.situation.upsert({
      where: { nom: s.nom },
      update: { ordre: s.ordre, couleur: s.couleur, icone: s.icone ?? null, estInitial: s.estInitial, estFinal: s.estFinal },
      create: s,
    })
    createdSituations[s.nom] = created.id
  }

  const modes = [
    {
      nom: 'Retrait au Secrétariat',
      description: 'Le destinataire est appelé, puis le courrier est retiré au secrétariat.',
      couleur: '#3B82F6',
      icone: 'Phone',
      cle: 'RETRAIT',
      ordre: 0,
    },
    {
      nom: 'Envoi par E-mail',
      description: 'Le courrier est envoyé par e-mail, ce qui clôt son suivi.',
      couleur: '#8B5CF6',
      icone: 'Mail',
      cle: 'MAIL',
      ordre: 1,
    },
    {
      nom: 'Remise au Coursier',
      description: 'Le courrier est transmis à un coursier puis livré.',
      couleur: '#F59E0B',
      icone: 'Truck',
      cle: 'COURSIER',
      ordre: 2,
    },
  ]

  const createdModes: Record<string, string> = {}
  for (const m of modes) {
    const created = await db.modeTransmission.upsert({
      where: { nom: m.nom },
      update: { description: m.description, couleur: m.couleur, icone: m.icone, cle: m.cle, ordre: m.ordre, actif: true },
      create: { ...m, actif: true },
    })
    createdModes[m.nom] = created.id
  }

  type TransitionSeed = {
    mode: string
    from: string
    to: string
    nom: string
    type?: 'MANUAL'
    demandeRetrait?: boolean
    estRappel?: boolean
    ordre?: number
  }

  const transitions: TransitionSeed[] = [
    // ── Retrait au Secrétariat
    { mode: 'Retrait au Secrétariat', from: 'Nouveau', to: 'Appel effectué', nom: 'Appeler', ordre: 0 },
    { mode: 'Retrait au Secrétariat', from: 'Appel effectué', to: 'Destinataire joint', nom: 'Destinataire joint', ordre: 0 },
    { mode: 'Retrait au Secrétariat', from: 'Appel effectué', to: 'Injoignable', nom: 'Injoignable', ordre: 1 },
    { mode: 'Retrait au Secrétariat', from: 'Injoignable', to: 'Appel effectué', nom: 'Rappeler', estRappel: true, ordre: 0 },
    { mode: 'Retrait au Secrétariat', from: 'Destinataire joint', to: 'Retiré', nom: 'Retiré', demandeRetrait: true, ordre: 0 },

    // ── Envoi par E-mail — le statut de suivi est « Livré » (fix #2 :
    //    « E-mail envoyé » n'est pas un statut mais un mode de transmission)
    { mode: 'Envoi par E-mail', from: 'Nouveau', to: 'Livré', nom: 'Envoyer par e-mail', ordre: 0 },

    // ── Remise au Coursier
    { mode: 'Remise au Coursier', from: 'Nouveau', to: 'Auprès du coursier', nom: 'Transmettre au coursier', ordre: 0 },
    { mode: 'Remise au Coursier', from: 'Auprès du coursier', to: 'Livré', nom: 'Livré', ordre: 0 },
  ]

  for (const t of transitions) {
    const modeId = createdModes[t.mode]
    const fromId = createdSituations[t.from]
    const toId = createdSituations[t.to]
    if (modeId && fromId && toId) {
      await db.transition.upsert({
        where: {
          modeTransmissionId_fromSituationId_toSituationId: {
            modeTransmissionId: modeId,
            fromSituationId: fromId,
            toSituationId: toId,
          },
        },
        update: {
          nom: t.nom,
          type: t.type ?? 'MANUAL',
          demandeRetrait: t.demandeRetrait ?? false,
          estRappel: t.estRappel ?? false,
          ordre: t.ordre ?? 0,
        },
        create: {
          modeTransmissionId: modeId,
          fromSituationId: fromId,
          toSituationId: toId,
          nom: t.nom,
          type: t.type ?? 'MANUAL',
          demandeRetrait: t.demandeRetrait ?? false,
          estRappel: t.estRappel ?? false,
          ordre: t.ordre ?? 0,
        },
      })
    }
  }

  // Synchronise le champ hérité « modeEnvoi » sur les courriers existants
  const syncModes = await db.modeTransmission.findMany({ select: { id: true, cle: true } })
  for (const m of syncModes) {
    if (!m.cle) continue
    await db.courrier.updateMany({
      where: { modeTransmissionId: m.id, modeEnvoi: null },
      data: { modeEnvoi: m.cle },
    })
  }

  // ── Signataires officiels
  const signataires = [
    { code: 'PM', nom: 'Premier Ministre', ordre: 0 },
    { code: 'MDC', nom: 'Ministre Directeur de Cabinet', ordre: 1 },
    { code: 'DCA', nom: 'Directeur de Cabinet Adjoint', ordre: 2 },
    { code: 'CCAB', nom: 'Chef de Cabinet', ordre: 3 },
  ]

  for (const s of signataires) {
    await db.signataire.upsert({
      where: { code: s.code },
      update: { nom: s.nom, ordre: s.ordre, actif: true },
      create: { ...s, actif: true },
    })
  }

  const seuils = [
    { cle: 'alerte.normal.jours', valeur: '7' },
    { cle: 'alerte.attention.jours', valeur: '14' },
    { cle: 'alerte.urgent.jours', valeur: '21' },
    { cle: 'delai.vert.jours', valeur: '3' },
    { cle: 'delai.orange.jours', valeur: '7' },
    { cle: 'import.maxSizeMo', valeur: '20' },
    { cle: 'import.batchSize', valeur: '250' },
    { cle: 'situation.institutionNom', valeur: 'Secrétariat Central et Documentation' },
    { cle: 'situation.titre', valeur: 'Situation des Courriers Sortants' },
    { cle: 'situation.logo', valeur: '' },
    { cle: 'situation.republique', valeur: 'République de Guinée' },
    { cle: 'situation.devise', valeur: 'Travail - Justice - Solidarité' },
    { cle: 'situation.signataireNom', valeur: 'Aboubacar BANGOURA' },
    { cle: 'courrier.creationManuelle', valeur: 'true' },
  ]

  for (const s of seuils) {
    await db.parametre.upsert({
      where: { cle: s.cle },
      update: { valeur: s.valeur },
      create: s,
    })
  }

  console.log('✅ Base de données initialisée avec signataires')
}

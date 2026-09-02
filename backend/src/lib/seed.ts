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
    'courrier:print',
    'import',
    'situation:read',
    'situation:export',
    'statistique:read',
  ])

  const userRole = await db.role.upsert({
    where: { name: 'Utilisateur' },
    update: {},
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
    { cle: 'import.batchSize', valeur: '100' },
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

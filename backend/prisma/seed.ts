import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'
import 'dotenv/config'
import { seedDatabase } from '../src/lib/seed.js'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  seedDatabase(prisma)
    .catch(console.error)
    .finally(() => prisma.$disconnect())
}

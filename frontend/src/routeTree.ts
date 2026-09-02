import { createRouter } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { Route as indexRoute } from '@/routes/index'
import { Route as importRoute } from '@/routes/import'
import { Route as courriersRoute } from '@/routes/courriers'
import { Route as courriersIdRoute } from '@/routes/courriers.$id'
import { Route as courriersIdFicheRoute } from '@/routes/courriers.$id.fiche'
import { Route as courriersNouveauRoute } from '@/routes/courriers.nouveau'
import { Route as historiqueRoute } from '@/routes/historique'
import { Route as situationsRoute } from '@/routes/situations'
import { Route as statistiquesRoute } from '@/routes/statistiques'
import { Route as utilisateursRoute } from '@/routes/utilisateurs'
import { Route as rolesRoute } from '@/routes/roles'
import { Route as permissionsRoute } from '@/routes/permissions'
import { Route as parametresRoute } from '@/routes/parametres'
import { Route as profilRoute } from '@/routes/profil'
import { Route as journalRoute } from '@/routes/journal'

const routeTree = rootRoute.addChildren([
  indexRoute,
  importRoute,
  courriersRoute,
  courriersIdRoute,
  courriersIdFicheRoute,
  courriersNouveauRoute,
  historiqueRoute,
  situationsRoute,
  statistiquesRoute,
  utilisateursRoute,
  rolesRoute,
  permissionsRoute,
  parametresRoute,
  profilRoute,
  journalRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

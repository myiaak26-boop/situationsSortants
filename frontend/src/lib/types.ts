export interface Signataire {
  id: string
  code: string
  nom: string
  actif: boolean
  ordre: number
}

export interface Retrait {
  id: string
  courrierId: string
  nomRetraitant: string
  telephone: string | null
  observation: string | null
  retireParId: string
  dateRetrait: string
}

export interface Courrier {
  id: string
  numero: string
  dateEnvoi: string
  destinataire: string
  objet: string
  signataire: string
  signataireId: string | null
  numeroEntrant: string | null
  dateArriveeEntrant: string | null
  nombrePages: number | null
  expediteur: string | null
  dateObservation: string | null
  dureeTraitement: number | null
  observation: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  retrait: Retrait | null
  createdBy: { id: string; name: string }
  historiqueActions?: HistoriqueAction[]
}

export interface HistoriqueAction {
  id: string
  courrierId: string
  action: string
  commentaire: string | null
  userId: string
  createdAt: string
  user: { id: string; name: string }
}

export interface WorkflowModeTransmission {
  id: string
  nom: string
  description: string | null
  couleur: string
  icone: string | null
  actif: boolean
  _count?: { courriers: number; transitions: number }
}

export interface WorkflowSituation {
  id: string
  nom: string
  couleur: string
  ordre: number
  estInitial: boolean
  estFinal: boolean
}

export interface WorkflowTransition {
  id: string
  nom: string
  fromSituationId: string
  toSituationId: string
  modeTransmissionId: string
  demandeRetrait: boolean
  estRappel: boolean
}

export interface WorkflowAdminData {
  modes: WorkflowModeTransmission[]
  situations: WorkflowSituation[]
  transitions: WorkflowTransition[]
}

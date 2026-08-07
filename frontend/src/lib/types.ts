export interface Situation {
  id: string
  nom: string
  ordre: number
  couleur: string
  icone: string | null
  estInitial: boolean
  estFinal: boolean
}

export interface Signataire {
  id: string
  code: string
  nom: string
  actif: boolean
  ordre: number
}

export interface ModeTransmission {
  id: string
  nom: string
  description: string | null
  couleur: string
  icone: string | null
  cle: string | null
  ordre: number
  actif: boolean
  _count?: { courriers: number; transitions: number }
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
  situationId: string
  observation: string | null
  modeTransmissionId: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  situation: Situation
  modeTransmission: ModeTransmission | null
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
  fromSituationId: string | null
  toSituationId: string | null
  user: { id: string; name: string }
}

export interface Transition {
  id: string
  modeTransmissionId: string | null
  fromSituationId: string
  toSituationId: string
  nom: string
  description: string | null
  type: string
  alerte: boolean
  demandeRetrait: boolean
  estRappel: boolean
  ordre: number
}

export interface AvailableTransition {
  id: string
  nom: string
  description: string | null
  toSituationNom: string
  toSituationCouleur: string
  toSituationEstFinal: boolean
  demandeRetrait: boolean
  estRappel: boolean
  modeNom: string | null
}

export interface WorkflowAdminData {
  modes: ModeTransmission[]
  situations: Situation[]
  transitions: Transition[]
}

export interface WorkflowModeStats {
  mode: { id: string; nom: string; couleur: string; icone: string | null }
  total: number
  finalises: number
  enCours: number
  retires: number
  rappels: number
  tempsMoyenJours: number | null
  distribution: Record<string, number>
  situationsDuMode: { id: string; nom: string; couleur: string; estFinal: boolean }[]
}

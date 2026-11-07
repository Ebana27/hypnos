/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react'
import { Mail, Globe, MessageCircle, Phone, Search } from 'lucide-react'
import Header from '../components/base/Header'
import injecterStyles from '../components/base/injecterStyles'

const STYLES = `
.boite-reception { display: flex; flex-direction: column; gap: 20px; font-family: var(--font-ui, 'Inter', sans-serif); color: var(--color-text); }
.boite-reception__barre { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.boite-reception__recherche { position: relative; flex: 1; max-width: 320px; }
.boite-reception__recherche input { width: 100%; padding: 10px 14px 10px 38px; border: 1px solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text); font-size: 13px; outline: none; transition: border-color 0.2s; }
.boite-reception__recherche input:focus { border-color: var(--color-accent); }
.boite-reception__recherche svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }

.boite-reception__table-conteneur { border: 1px solid var(--color-border); border-radius: var(--radius-m); background: var(--color-surface); overflow-x: auto; }
.boite-reception__table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
.boite-reception__table th { padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-weight: 600; color: var(--color-text-muted); background: var(--color-background-soft, #f9f9f9); }
.boite-reception__table td { padding: 16px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
.boite-reception__table tr:last-child td { border-bottom: none; }
.boite-reception__table tr:hover td { background: var(--color-background-soft, #fafafa); }

.boite-reception__expediteur { font-weight: 600; color: var(--color-text); display: block; margin-bottom: 2px; }
.boite-reception__contact-info { font-size: 11px; color: var(--color-text-muted); }
.boite-reception__texte { color: var(--color-text); line-height: 1.5; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.boite-reception__source { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-pill); background: var(--color-background-soft); font-size: 11px; font-weight: 500; color: var(--color-text); }
.boite-reception__badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: var(--color-accent-wash, #eef2ff); color: var(--color-accent); margin-bottom: 4px; }
.boite-reception__vide { padding: 48px; text-align: center; color: var(--color-text-muted); font-size: 13px; }
`
injecterStyles('hypnos-boite-reception-simple', STYLES)

// Données d'exemple épurées
const MESSAGES_INITIALAUX = [
  {
    id: 1,
    source: 'site',
    sourceNom: 'Formulaire du site',
    nom: 'Amina Mavoungou',
    contact: 'amina.exemple@email.test · +242 06 000 00 01',
    date: 'Aujourd’hui, 09:18',
    sujet: 'Demande de disponibilité',
    texte: 'Bonjour, avez-vous une chambre disponible pour deux personnes ce week-end ? Je peux vous préciser les dates si nécessaire.',
    nouveau: true
  },
  {
    id: 2,
    source: 'whatsapp',
    sourceNom: 'WhatsApp',
    nom: 'Patrick Nsimba',
    contact: 'patrick.exemple@email.test · +242 06 000 00 02',
    date: 'Hier, 16:42',
    sujet: 'Heure d’arrivée',
    texte: 'Bonsoir, je pense arriver vers 19 h. Est-ce que la réception sera encore ouverte ?',
    nouveau: false
  },
  {
    id: 3,
    source: 'email',
    sourceNom: 'E-mail',
    nom: 'Chantal Okemba',
    contact: 'chantal.exemple@email.test · +242 05 000 00 03',
    date: 'Lundi, 11:07',
    sujet: 'Facture du séjour',
    texte: 'Bonjour, pourriez-vous me renvoyer la facture de mon séjour ? Merci.',
    nouveau: false
  },
  {
    id: 4,
    source: 'ota',
    sourceNom: 'Plateforme de réservation',
    nom: 'Jean Bissanga',
    contact: 'jean.exemple@email.test · +242 06 000 00 04',
    date: 'Aujourd’hui, 08:32',
    sujet: 'Question avant réservation',
    texte: 'Bonjour, le petit-déjeuner est-il inclus dans le tarif affiché ?',
    nouveau: true
  }
]

export default function CommunicationPage() {
  const [messages] = useState(MESSAGES_INITIALAUX)
  const [recherche, setRecherche] = useState('')

  const messagesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(m => 
      m.nom.toLowerCase().includes(q) || 
      m.sujet.toLowerCase().includes(q) || 
      m.texte.toLowerCase().includes(q)
    )
  }, [messages, recherche])

  const getSourceIcon = (source) => {
    switch(source) {
      case 'whatsapp': return <MessageCircle size={13} />
      case 'email': return <Mail size={13} />
      case 'telephone': return <Phone size={13} />
      default: return <Globe size={13} />
    }
  }

  return (
    <div className="boite-reception">
      <Header titre="Messages reçus" description="Consultation simple des messages et demandes de contact" />

      <div className="boite-reception__barre">
        <div className="boite-reception__recherche">
          <Search size={15} />
          <input 
            type="text" 
            placeholder="Rechercher par nom, sujet..." 
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {messagesFiltres.length} message{messagesFiltres.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="boite-reception__table-conteneur">
        <table className="boite-reception__table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Expéditeur</th>
              <th style={{ width: '15%' }}>Source</th>
              <th style={{ width: '45%' }}>Sujet & Message</th>
              <th style={{ width: '18%' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {messagesFiltres.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.nouveau && <span className="boite-reception__badge">Nouveau</span>}
                  <span className="boite-reception__expediteur">{m.nom}</span>
                  <span className="boite-reception__contact-info">{m.contact}</span>
                </td>
                <td>
                  <span className="boite-reception__source">
                    {getSourceIcon(m.source)} {m.sourceNom}
                  </span>
                </td>
                <td>
                  <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>{m.sujet}</strong>
                  <p className="boite-reception__texte">{m.texte}</p>
                </td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {m.date}
                </td>
              </tr>
            ))}
            {!messagesFiltres.length && (
              <tr>
                <td colSpan="4" className="boite-reception__vide">
                  Aucun message ne correspond à votre recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
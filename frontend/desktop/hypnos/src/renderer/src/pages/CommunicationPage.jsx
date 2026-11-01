/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { Globe, Mail, MessageCircle, Phone, UserRound, Inbox, CalendarDays } from 'lucide-react'
import Header from '../components/base/Header'
import InputSearch from '../components/base/InputSearch'
import injecterStyles from '../components/base/injecterStyles'

const SOURCES = {
  site: { label: 'Formulaire du site', Icon: Globe, tone: 'site' },
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle, tone: 'whatsapp' },
  email: { label: 'E-mail', Icon: Mail, tone: 'email' },
  ota: { label: 'Plateforme de réservation', Icon: Globe, tone: 'ota' },
  telephone: { label: 'Appel téléphonique', Icon: Phone, tone: 'telephone' }
}
const FILTRES = [
  { valeur: 'tous', libelle: 'Tous les messages' },
  { valeur: 'nouveau', libelle: 'Nouveaux' },
  { valeur: 'reservation', libelle: 'Demandes de réservation' }
]

// Exemples fictifs pour montrer la page avant le branchement des sources réelles.
const EXEMPLES = [
  {
    id: 1, source: 'site', origine: 'Formulaire « Contact » du site de l’hôtel', nom: 'Amina Mavoungou',
    email: 'amina.exemple@email.test', telephone: '+242 06 000 00 01', date: 'Aujourd’hui, 09:18',
    sujet: 'Demande de disponibilité', nouveau: true, demandeReservation: true,
    reservation: 'À examiner dans le module Réservations',
    messages: [{ id: 11, auteur: 'Amina Mavoungou', date: 'Aujourd’hui, 09:18', texte: 'Bonjour, avez-vous une chambre disponible pour deux personnes ce week-end ? Je peux vous préciser les dates si nécessaire.' }]
  },
  {
    id: 2, source: 'whatsapp', origine: 'Compte WhatsApp de l’hôtel', nom: 'Patrick Nsimba',
    email: 'patrick.exemple@email.test', telephone: '+242 06 000 00 02', date: 'Hier, 16:42',
    sujet: 'Heure d’arrivée', nouveau: false, demandeReservation: false,
    reservation: 'Réservation #104 · Chambre 203',
    messages: [{ id: 21, auteur: 'Patrick Nsimba', date: 'Hier, 16:42', texte: 'Bonsoir, je pense arriver vers 19 h. Est-ce que la réception sera encore ouverte ?' }]
  },
  {
    id: 3, source: 'email', origine: 'Adresse e-mail de contact de l’hôtel', nom: 'Chantal Okemba',
    email: 'chantal.exemple@email.test', telephone: '+242 05 000 00 03', date: 'Lundi, 11:07',
    sujet: 'Facture du séjour', nouveau: false, demandeReservation: false,
    reservation: 'Séjour terminé · Chambre 101',
    messages: [{ id: 31, auteur: 'Chantal Okemba', date: 'Lundi, 11:07', texte: 'Bonjour, pourriez-vous me renvoyer la facture de mon séjour ? Merci.' }]
  },
  {
    id: 4, source: 'ota', origine: 'Messagerie d’une plateforme de réservation', nom: 'Jean Bissanga',
    email: 'jean.exemple@email.test', telephone: '+242 06 000 00 04', date: 'Aujourd’hui, 08:32',
    sujet: 'Question avant réservation', nouveau: true, demandeReservation: true,
    reservation: 'À examiner dans le module Réservations',
    messages: [{ id: 41, auteur: 'Jean Bissanga', date: 'Aujourd’hui, 08:32', texte: 'Bonjour, le petit-déjeuner est-il inclus dans le tarif affiché ?' }]
  }
]

const STYLES = `
.communication-page { display:flex; flex-direction:column; gap:22px; min-width:0; height:100%; font-family:var(--font-ui, 'Inter', sans-serif); color:var(--color-text); }
.communication-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); color:var(--color-text-muted); font-size:13px; line-height:1.55; }
.communication-intro strong { color:var(--color-text); }
.communication-intro__icon { display:grid; place-items:center; flex:0 0 36px; width:36px; height:36px; border-radius:11px; background:var(--color-accent-wash); color:var(--color-accent); }
.communication-toolbar { display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
.communication-toolbar__summary { display:flex; align-items:center; gap:8px; color:var(--color-text-muted); font-size:13px; }
.communication-toolbar__summary strong { color:var(--color-text); font-size:15px; }
.communication-toolbar__search { width:min(390px,100%); }
.communication-filterbar { display:flex; gap:8px; flex-wrap:wrap; }
.communication-filter { padding:9px 13px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); color:var(--color-text-muted); font:inherit; font-size:12px; cursor:pointer; transition:background .15s,color .15s,border-color .15s; }
.communication-filter:hover { border-color:var(--color-accent); color:var(--color-accent); }
.communication-filter[aria-pressed='true'] { border-color:var(--color-accent); background:var(--color-accent); color:var(--color-accent-contrast); font-weight:600; }
.communication-layout { display:grid; grid-template-columns:minmax(310px,370px) minmax(0,1fr); flex:1; min-height:560px; overflow:hidden; border:1px solid var(--color-border); border-radius:var(--radius-l); background:var(--color-surface); }
.communication-list { display:flex; flex-direction:column; min-width:0; border-right:1px solid var(--color-border); background:var(--color-surface); }
.communication-list__head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:19px 20px; border-bottom:1px solid var(--color-border); }
.communication-list__head h2 { margin:0; font-family:var(--font-display, 'Lora', serif); font-size:17px; font-weight:600; }
.communication-list__head span { padding:4px 9px; border-radius:var(--radius-pill); background:var(--color-background-soft); color:var(--color-text-muted); font-size:11px; }
.communication-list__items { flex:1; overflow-y:auto; }
.communication-item { display:flex; width:100%; gap:13px; padding:17px 18px; border:0; border-bottom:1px solid var(--color-border); border-left:3px solid transparent; background:transparent; color:inherit; text-align:left; cursor:pointer; transition:background .15s,border-color .15s; }
.communication-item:hover { background:var(--color-background-soft); }
.communication-item[aria-current='true'] { border-left-color:var(--color-accent); background:var(--color-accent-wash); }
.communication-avatar { display:grid; place-items:center; flex:0 0 42px; width:42px; height:42px; border-radius:50%; background:var(--color-background-mute); color:var(--color-accent); font-size:12px; font-weight:700; }
.communication-item__body { flex:1; min-width:0; }
.communication-item__top { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
.communication-item__name { overflow:hidden; color:var(--color-text); font-size:14px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.communication-item__date { color:var(--color-text-muted); font-size:11px; white-space:nowrap; }
.communication-item__subject { display:block; overflow:hidden; margin-top:7px; color:var(--color-text); font-size:13px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.communication-item__preview { display:block; overflow:hidden; margin-top:5px; color:var(--color-text-muted); font-size:12px; line-height:1.5; text-overflow:ellipsis; white-space:nowrap; }
.communication-item__bottom { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:9px; }
.communication-source { display:inline-flex; align-items:center; gap:6px; color:var(--color-text-muted); font-size:11px; }
.communication-badges { display:flex; gap:5px; flex-wrap:wrap; }
.communication-badge { padding:4px 8px; border-radius:var(--radius-pill); background:var(--color-background-soft); color:var(--color-text-muted); font-size:10px; font-weight:600; white-space:nowrap; }
.communication-badge--new { background:var(--color-accent-wash); color:var(--color-accent); }
.communication-detail { display:flex; flex-direction:column; min-width:0; overflow-y:auto; background:var(--color-background-soft); }
.communication-detail__top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:24px 28px 20px; border-bottom:1px solid var(--color-border); background:var(--color-surface); }
.communication-detail__title { min-width:0; }
.communication-detail__title h2 { margin:0; font-family:var(--font-display, 'Lora', serif); font-size:21px; font-weight:600; line-height:1.3; }
.communication-detail__title p { margin:7px 0 0; color:var(--color-text-muted); font-size:13px; line-height:1.5; }
.communication-source-tag { display:inline-flex; align-items:center; gap:7px; flex:0 0 auto; padding:9px 12px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); color:var(--color-text); font-size:12px; font-weight:600; }
.communication-source-tag--site { color:var(--color-accent); }
.communication-source-tag--whatsapp { color:var(--color-success); }
.communication-detail__content { display:grid; gap:18px; padding:22px 28px 28px; }
.communication-contact-card { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; padding:18px 20px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.communication-contact-card__label { display:block; margin-bottom:6px; color:var(--color-text-muted); font-size:11px; }
.communication-contact-card__value { display:block; overflow-wrap:anywhere; color:var(--color-text); font-size:13px; font-weight:500; line-height:1.45; }
.communication-origin-card { display:flex; align-items:flex-start; gap:12px; padding:16px 19px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.communication-origin-card__icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; background:var(--color-background-soft); color:var(--color-text-muted); }
.communication-origin-card strong { display:block; margin-bottom:4px; font-size:13px; }
.communication-origin-card span { color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.communication-message-card { padding:20px 22px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.communication-message-card__heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:13px; }
.communication-message-card__heading strong { font-size:13px; font-weight:600; }
.communication-message-card__heading span { color:var(--color-text-muted); font-size:11px; }
.communication-message { margin:0; color:var(--color-text); font-size:15px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
.communication-reservation-card { display:flex; align-items:flex-start; gap:12px; padding:16px 19px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.communication-reservation-card__icon { color:var(--color-accent); }
.communication-reservation-card strong { display:block; margin-bottom:4px; font-size:13px; }
.communication-reservation-card span { color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.communication-placeholder { display:grid; flex:1; place-content:center; justify-items:center; gap:11px; padding:32px; color:var(--color-text-muted); text-align:center; }
.communication-placeholder strong { color:var(--color-text); font-family:var(--font-display, 'Lora', serif); font-size:18px; }
.communication-placeholder p { max-width:400px; margin:0; font-size:13px; line-height:1.6; }
@media (max-width:1000px) { .communication-layout { grid-template-columns:minmax(270px,330px) minmax(0,1fr); } .communication-detail__top { padding:21px; } .communication-detail__content { padding:18px 21px 22px; } }
@media (max-width:720px) { .communication-page { height:auto; } .communication-layout { grid-template-columns:1fr; min-height:0; } .communication-list { max-height:380px; border-right:0; border-bottom:1px solid var(--color-border); } .communication-detail { min-height:500px; } .communication-detail__top { flex-direction:column; } .communication-contact-card { grid-template-columns:1fr; gap:13px; } .communication-toolbar { align-items:stretch; flex-direction:column; } .communication-toolbar__search { width:100%; } }
`
injecterStyles('hypnos-communication-page', STYLES)

const dernierMessage = (fil) => fil.messages[fil.messages.length - 1]

export default function CommunicationPage() {
  const [messages, setMessages] = useState(EXEMPLES)
  const [selectionId, setSelectionId] = useState(EXEMPLES[0]?.id ?? null)
  const [filtre, setFiltre] = useState('tous')
  const [recherche, setRecherche] = useState('')

  const selection = messages.find((message) => message.id === selectionId) ?? null
  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return messages.filter((message) => {
      const dernier = dernierMessage(message)
      const correspondRecherche = !q || `${message.nom} ${message.sujet} ${message.email} ${message.telephone} ${dernier?.texte ?? ''} ${SOURCES[message.source]?.label ?? ''}`.toLocaleLowerCase('fr').includes(q)
      const correspondFiltre = filtre === 'tous' || (filtre === 'nouveau' ? message.nouveau : message.demandeReservation)
      return correspondRecherche && correspondFiltre
    })
  }, [messages, recherche, filtre])

  function ouvrirMessage(message) {
    setSelectionId(message.id)
    if (message.nouveau) setMessages((actuels) => actuels.map((element) => element.id === message.id ? { ...element, nouveau: false } : element))
  }

  const nouveaux = messages.filter((message) => message.nouveau).length
  const demandes = messages.filter((message) => message.demandeReservation).length
  const SourceIcon = selection ? SOURCES[selection.source]?.Icon ?? Mail : Inbox
  const sourceLabel = selection ? SOURCES[selection.source]?.label ?? 'Autre source' : ''

  return (
    <section className="communication-page">
      <Header titre="Communication" description="Messages entrants et coordonnées des contacts" />

      <div className="communication-intro">
        <span className="communication-intro__icon"><Inbox size={18} aria-hidden="true" /></span>
        <span><strong>Consultation des messages reçus.</strong> Les demandes du site et des plateformes apparaissent ici avec les coordonnées associées. Cet écran ne permet pas d’y répondre. Les exemples sont fictifs en attendant les connecteurs réels.</span>
      </div>

      <div className="communication-toolbar">
        <div className="communication-toolbar__summary"><strong>{messages.length}</strong> messages <span>·</span> {nouveaux} nouveaux <span>·</span> {demandes} demandes de réservation</div>
        <div className="communication-toolbar__search"><InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher un nom, une adresse ou un message…" /></div>
      </div>

      <div className="communication-filterbar" role="group" aria-label="Filtrer les messages">
        {FILTRES.map((option) => <button key={option.valeur} className="communication-filter" type="button" aria-pressed={filtre === option.valeur} onClick={() => setFiltre(option.valeur)}>{option.libelle}</button>)}
      </div>

      <div className="communication-layout">
        <aside className="communication-list" aria-label="Liste des messages entrants">
          <div className="communication-list__head"><h2>Messages entrants</h2><span>{visibles.length} affichés</span></div>
          <div className="communication-list__items">
            {visibles.map((message) => {
              const dernier = dernierMessage(message)
              const Icone = SOURCES[message.source]?.Icon ?? Mail
              return (
                <button key={message.id} type="button" className="communication-item" aria-current={message.id === selectionId} onClick={() => ouvrirMessage(message)}>
                  <span className="communication-avatar">{message.nom.split(/\s+/).slice(0, 2).map((partie) => partie[0]).join('').toUpperCase()}</span>
                  <span className="communication-item__body">
                    <span className="communication-item__top"><span className="communication-item__name">{message.nom}</span><span className="communication-item__date">{message.date}</span></span>
                    <span className="communication-item__subject">{message.sujet}</span>
                    <span className="communication-item__preview">{dernier?.texte}</span>
                    <span className="communication-item__bottom">
                      <span className="communication-source"><Icone size={13} /> {SOURCES[message.source]?.label}</span>
                      <span className="communication-badges">
                        {message.nouveau && <span className="communication-badge communication-badge--new">Nouveau</span>}
                        {message.demandeReservation && <span className="communication-badge">Réservation</span>}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
            {!visibles.length && <div className="communication-placeholder"><strong>Aucun message trouvé</strong><p>Change le filtre ou essaie une autre recherche.</p></div>}
          </div>
        </aside>

        {selection ? (
          <main className="communication-detail" aria-label="Détail du message sélectionné">
            <header className="communication-detail__top">
              <div className="communication-detail__title">
                <h2>{selection.sujet}</h2>
                <p>Message reçu de {selection.nom} · {selection.date}</p>
              </div>
              <span className={`communication-source-tag communication-source-tag--${SOURCES[selection.source]?.tone ?? 'ota'}`}><SourceIcon size={16} /> {sourceLabel}</span>
            </header>
            <div className="communication-detail__content">
              <section className="communication-contact-card" aria-label="Coordonnées du contact">
                <div><span className="communication-contact-card__label">Nom du contact</span><strong className="communication-contact-card__value">{selection.nom}</strong></div>
                <div><span className="communication-contact-card__label">Adresse e-mail</span><strong className="communication-contact-card__value">{selection.email || 'Non renseignée'}</strong></div>
                <div><span className="communication-contact-card__label">Téléphone</span><strong className="communication-contact-card__value">{selection.telephone || 'Non renseigné'}</strong></div>
              </section>

              <section className="communication-origin-card">
                <span className="communication-origin-card__icon"><SourceIcon size={17} /></span>
                <div><strong>Origine du message</strong><span>{selection.origine}</span></div>
              </section>

              <section className="communication-message-card">
                <div className="communication-message-card__heading"><strong>Contenu reçu</strong><span>{selection.messages.length} message{selection.messages.length === 1 ? '' : 's'}</span></div>
                {selection.messages.map((message) => (
                  <div key={message.id}>
                    <p className="communication-message">{message.texte}</p>
                    <span className="communication-message__meta">De {message.auteur} · {message.date}</span>
                  </div>
                ))}
              </section>

              <section className="communication-reservation-card">
                <span className="communication-reservation-card__icon"><CalendarDays size={18} /></span>
                <div><strong>{selection.demandeReservation ? 'À traiter comme une demande de réservation' : 'Réservation / séjour associé'}</strong><span>{selection.reservation}</span></div>
              </section>
            </div>
          </main>
        ) : (
          <div className="communication-placeholder"><span className="communication-avatar"><UserRound size={19} /></span><strong>Sélectionne un message</strong><p>Les coordonnées du contact, l’origine et le contenu du message apparaîtront ici.</p></div>
        )}
      </div>
    </section>
  )
}

// eslint-disable-next-line react/prop-types
export default function KpiCard({
  libelle,
  valeur,
  suffixe,
  teinte = 'principal',
  progression
}) {
  const couleurs = {
    principal: 'var(--color-accent)',
    succes: 'var(--color-success)',
    avertissement: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    lavande: 'var(--soft-periwinkle)',
    amethyste: 'var(--amethyst-smoke)',
    jaune: '#D6A500'
  }

  const accent = couleurs[teinte] ?? couleurs.principal
  const estAnneau = Number.isFinite(Number(progression))
  const pourcentage = estAnneau
    ? Math.min(100, Math.max(0, Number(progression)))
    : 0

  return (
    <article
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        minWidth: 0,
        padding: '18px 20px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-m)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)'
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            color: 'var(--color-text-muted)',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          {libelle}
        </p>

        <p
          style={{
            margin: '5px 0 0',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(24px, 3vw, 32px)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.04em'
          }}
        >
          {valeur}
          {suffixe && (
            <span
              style={{
                marginLeft: '6px',
                color: accent,
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: 0
              }}
            >
              {suffixe}
            </span>
          )}
        </p>

        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: '34px',
            height: '3px',
            marginTop: '12px',
            borderRadius: 'var(--radius-pill)',
            background: accent
          }}
        />
      </div>

      {estAnneau && (
        <div
          role="img"
          aria-label={`${libelle} : ${pourcentage}%`}
          style={{
            display: 'grid',
            flex: '0 0 54px',
            width: '54px',
            height: '54px',
            placeItems: 'center',
            borderRadius: '50%',
            background: `conic-gradient(${accent} ${pourcentage}%, var(--color-background-mute) 0)`
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              width: '42px',
              height: '42px',
              placeItems: 'center',
              borderRadius: '50%',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {pourcentage}%
          </span>
        </div>
      )}
    </article>
  )
}

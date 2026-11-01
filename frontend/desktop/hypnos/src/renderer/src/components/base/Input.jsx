/* eslint-disable react/prop-types */
import { forwardRef, useId, useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import injecterStyles from './injecterStyles'

const STYLES = `
.champ {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.champ__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}
.champ__requis {
  margin-left: 2px;
  color: var(--color-danger);
}
.champ__boite {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.champ__boite:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-wash);
}
.champ--erreur .champ__boite {
  border-color: var(--color-danger);
}
.champ--erreur .champ__boite:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger) 15%, transparent);
}
.champ--desactive .champ__boite {
  background: var(--color-background-soft);
  opacity: 0.7;
}
.champ__controle {
  flex: 1;
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font: inherit;
  font-size: 14px;
  color: var(--color-text);
}
.champ__controle::placeholder {
  color: var(--color-text-faint);
}
.champ__controle:disabled {
  cursor: not-allowed;
}
select.champ__controle {
  appearance: none;
  padding-right: 22px;
  cursor: pointer;
}
.champ__chevron {
  position: absolute;
  right: 14px;
  pointer-events: none;
}
.champ__oeil {
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}
.champ__oeil:hover {
  color: var(--color-accent);
}
.champ__aide,
.champ__erreur {
  font-size: 12px;
}
.champ__aide {
  color: var(--color-text-muted);
}
.champ__erreur {
  color: var(--color-danger);
}
`

injecterStyles('hypnos-input', STYLES)

/**
 * Props :
 *  label, id, name, type, value, onChange, placeholder
 *  erreur        message d'erreur (met le champ en rouge)
 *  aide          texte d'aide sous le champ
 *  icone         composant lucide affiché à gauche
 *  requis        ajoute l'astérisque et l'attribut required
 *  options       [{ valeur, libelle }] : affiche une liste déroulante
 *  Les autres props (min, max, autoComplete…) sont transmises au champ.
 */
const Input = forwardRef(function Input(
  {
    label,
    id,
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    erreur,
    aide,
    icone: Icone,
    requis = false,
    disabled = false,
    options,
    className = '',
    ...reste
  },
  ref
) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  const [visible, setVisible] = useState(false)

  const estMotDePasse = type === 'password'
  const idMessage = erreur ? `${idChamp}-erreur` : aide ? `${idChamp}-aide` : undefined

  const proprietes = {
    id: idChamp,
    ref,
    name,
    value,
    onChange,
    disabled,
    required: requis,
    className: 'champ__controle',
    'aria-invalid': erreur ? true : undefined,
    'aria-describedby': idMessage,
    ...reste
  }

  const classes = [
    'champ',
    erreur && 'champ--erreur',
    disabled && 'champ--desactive',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {label && (
        <label className="champ__label" htmlFor={idChamp}>
          {label}
          {requis && (
            <span className="champ__requis" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="champ__boite">
        {Icone && <Icone size={16} strokeWidth={1.8} aria-hidden="true" />}

        {options ? (
          <>
            <select {...proprietes}>
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {options.map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.libelle}
                </option>
              ))}
            </select>
            <ChevronDown className="champ__chevron" size={16} aria-hidden="true" />
          </>
        ) : (
          <input
            {...proprietes}
            type={estMotDePasse && visible ? 'text' : type}
            placeholder={placeholder}
          />
        )}

        {estMotDePasse && (
          <button
            type="button"
            className="champ__oeil"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {erreur ? (
        <p className="champ__erreur" id={idMessage} role="alert">
          {erreur}
        </p>
      ) : (
        aide && (
          <p className="champ__aide" id={idMessage}>
            {aide}
          </p>
        )
      )}
    </div>
  )
})

export default Input
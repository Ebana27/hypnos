/*Cette age contient tout les services suplémentaire qu'un hôtel peut avoir : Piscine, Golf... mais surtout Bar/Cav & Restaurent présent dans la pluspart des hotel et auberge au Congo Brazza
  * Ce module du logiciel permet de gérer ses services par extension de les affiliers au client concerner dans le logiciel
  * Ces services peuvent être payant et constituer et necessité des automatismes en plus, afin de les gérees. 
  * Par Exemple : Comment gérer un bar/ restaurent si le logiciel ne gère pas amème de gérer les bars ou restaurant ou encore le stocke tout simplement
  * Il fafudra donc concevoir ces modules en plus. Ou des sous modues permettant le bon fonctionnement de service
*/

import Header from "../components/base/Header"
import Input from "../components/base/Input"
import InputSearch from "../components/base/InputSearch"
import Modal from "../components/base/Modal"
import ProgressBar from "../components/base/ProgressBar"

export default function ServicePage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flexDirection: 'column', gap: '12px' }} >
        <Header titre='Service' description="Service en plus de l'hotel" />
        <Input placeholder='Hello Service' />
        <InputSearch />
        {/* <Modal ouvert='false' />*/}
        <ProgressBar />
      </div>
    </>
  )
}

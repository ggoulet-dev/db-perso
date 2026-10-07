import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { DatasetProvider, useDataset } from '../data';
import { ComparePage } from './pages/ComparePage';
import { ImportPage } from './pages/ImportPage';
import { ItemListPage } from './pages/ItemListPage';
import { ItemPage } from './pages/ItemPage';
import { SetPage } from './pages/SetPage';
import { SpellsPage } from './pages/SpellsPage';
import { StuffEditorPage } from './pages/StuffEditorPage';
import { StuffListPage } from './pages/StuffListPage';

function Accueil() {
  const { meta } = useDataset();
  return (
    <section>
      <h1>DofusBook perso</h1>
      <p>Encyclopédie et éditeur de stuffs Dofus 3, en local.</p>
      <p>
        <Link to="/objets">Parcourir les {meta.counts.playerItems} objets</Link> et {meta.counts.sets} panoplies.
      </p>
      <p>
        <Link to="/stuffs">Mes stuffs</Link> : créer et éditer des stuffs, avec les totaux calculés comme DofusBook.
      </p>
      <p>
        <Link to="/importer">Importer</Link> des stuffs DofusBook, ou en <Link to="/comparer">comparer</Link> deux.
      </p>
      <p>
        <Link to="/sorts">Sorts</Link> des 19 classes ; les dégâts d'arme et de sorts d'un stuff sont dans ses onglets Arme et Sorts.
      </p>
      <p className="muted">
        Données dofusdude, canal {meta.channel}, version {meta.gameVersion}, synchronisées le{' '}
        {new Date(meta.syncedAt).toLocaleString('fr-FR')}.
      </p>
    </section>
  );
}

function Introuvable() {
  return (
    <section>
      <h1>Page introuvable</h1>
      <Link to="/">Retour à l'accueil</Link>
    </section>
  );
}

export function App() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" end className="brand">
          DofusBook perso
        </NavLink>
        <nav>
          <NavLink to="/stuffs">Mes stuffs</NavLink>
          <NavLink to="/importer">Import</NavLink>
          <NavLink to="/comparer">Comparaison</NavLink>
          <NavLink to="/objets">Objets</NavLink>
          <NavLink to="/sorts">Sorts</NavLink>
        </nav>
      </header>
      <main className="page">
        <DatasetProvider>
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/objets" element={<ItemListPage />} />
            <Route path="/objets/:id" element={<ItemPage />} />
            <Route path="/panoplies/:id" element={<SetPage />} />
            <Route path="/stuffs" element={<StuffListPage />} />
            <Route path="/stuffs/:id" element={<StuffEditorPage />} />
            <Route path="/sorts" element={<SpellsPage />} />
            <Route path="/sorts/:breedId" element={<SpellsPage />} />
            <Route path="/importer" element={<ImportPage />} />
            <Route path="/comparer" element={<ComparePage />} />
            <Route path="*" element={<Introuvable />} />
          </Routes>
        </DatasetProvider>
      </main>
    </>
  );
}

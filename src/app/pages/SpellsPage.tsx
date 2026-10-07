import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBreeds, useSpellBook } from '../../data';
import { levelFor, type Spell, type SpellBook } from '../../domain/spells';
import { GameText } from '../components';
import { NumberField } from '../stuff/NumberField';
import { EffectList, GradePicker, SpellFacts, sortedLevels } from '../spells/SpellParts';

const DEFAULT_BREED = 9; // Crâ
const MAX_LEVEL = 200;

export function SpellsPage() {
  const { breedId: param } = useParams();
  const navigate = useNavigate();
  const breeds = useBreeds();
  const spellBook = useSpellBook();
  const [level, setLevel] = useState(MAX_LEVEL);
  // Grade choisi à la main, par sort ; vidé quand le niveau change.
  const [grades, setGrades] = useState<Record<number, number>>({});

  if (breeds.status === 'loading' || spellBook.status === 'loading') return <p className="status">Chargement des sorts…</p>;
  if (breeds.status === 'error') return <p className="status error">Impossible de charger les classes : {breeds.message}</p>;
  if (spellBook.status === 'error') return <p className="status error">Impossible de charger les sorts : {spellBook.message}</p>;

  const breedId = param === undefined ? DEFAULT_BREED : Number(param);
  const breed = breeds.breeds.find((b) => b.id === breedId);
  const book = spellBook.book;
  const pairs = book.pairsOf(breedId);

  return (
    <section>
      <h1>Sorts{breed && <> : {breed.name}</>}</h1>
      <div className="toolbar">
        <label>
          Classe
          <select value={breed ? breedId : ''} onChange={(e) => navigate(`/sorts/${e.target.value}`)}>
            {!breed && <option value="">—</option>}
            {breeds.breeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Niveau du personnage
          <NumberField
            className="narrow"
            value={level}
            min={1}
            max={MAX_LEVEL}
            onChange={(next) => {
              setLevel(next);
              setGrades({});
            }}
            aria-label="Niveau du personnage"
          />
        </label>
        <span className="muted small">Valeurs de la release {book.release}. Le grade affiché suit le niveau ; un clic sur un grade le force.</span>
      </div>

      {!breed ? (
        <p className="status error">Classe {param} inconnue.</p>
      ) : pairs.length === 0 ? (
        <p className="muted">Aucun sort pour cette classe.</p>
      ) : (
        <div className="spell-pairs">
          {pairs.map(({ base, variant }) => (
            <div key={base.id} className="spell-pair">
              {[base, variant].map(
                (spell, i) =>
                  spell && (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      book={book}
                      variant={i === 1}
                      characterLevel={level}
                      grade={grades[spell.id]}
                      onGrade={(grade) => setGrades((g) => ({ ...g, [spell.id]: grade }))}
                    />
                  ),
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface CardProps {
  spell: Spell;
  book: SpellBook;
  variant: boolean;
  characterLevel: number;
  grade: number | undefined;
  onGrade(grade: number): void;
}

function SpellCard({ spell, book, variant, characterLevel, grade, onGrade }: CardProps) {
  const levels = sortedLevels(spell);
  const available = levelFor(spell, characterLevel);
  const level = levels.find((l) => l.grade === grade) ?? available ?? levels[0];
  return (
    <article className="card spell-card">
      <div className="card-head">
        <h3>
          {spell.name}
          {variant && <span className="badge">variante</span>}
        </h3>
        <span className="muted small">ID {spell.id}</span>
      </div>
      {spell.description && (
        <p className="description small">
          <GameText text={spell.description} />
        </p>
      )}
      {!level ? (
        <p className="muted">Aucun grade dans les données.</p>
      ) : (
        <>
          <p className="spell-grade">
            <GradePicker spell={spell} selected={level.grade} available={available?.grade ?? null} onSelect={onGrade} />
            {!available && <span className="badge warn">obtenu au niveau {levels[0]?.minPlayerLevel}</span>}
          </p>
          <SpellFacts level={level} />
          <h4>Effets</h4>
          <EffectList effects={level.effects} book={book} />
          {level.criticalEffects.length > 0 && (
            <>
              <h4>Effets critiques</h4>
              <EffectList effects={level.criticalEffects} book={book} />
            </>
          )}
        </>
      )}
    </article>
  );
}

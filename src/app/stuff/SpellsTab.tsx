import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpellBook } from '../../data';
import type { Build } from '../../domain/build/types';
import { attackerFromBuild, critChance, spellDamage, type AttackerStats, type DamageOptions } from '../../domain/damage';
import type { BuildResult } from '../../domain/engine';
import type { Breed } from '../../domain/rules';
import { chargeBonus, classifyEffect, levelFor, type Spell, type SpellBook } from '../../domain/spells';
import { damageOptions, DamageSettingsPanel, ElementDot, formatDamage, Unverified, UnverifiedList, type DamageSettings } from '../damage/DamageSettings';
import { castModes, effectElement, effectText, sortedLevels } from '../spells/SpellParts';
import { NumberField } from './NumberField';

interface Props {
  build: Build;
  result: BuildResult;
  breeds: Breed[];
  settings: DamageSettings;
  onSettings(settings: DamageSettings): void;
}

/** Saisies propres à un sort : lancers par tour (non vérifié) et charges. */
interface SpellInput {
  casts: number;
  charges: number;
}

const NO_INPUT: SpellInput = { casts: 1, charges: 0 };

function hasComputedDamage(spell: Spell, book: SpellBook, characterLevel: number): boolean {
  const level = levelFor(spell, characterLevel);
  return !!level && level.effects.some((e) => classifyEffect(book.effects.get(e.effectId)).computable);
}

/** Onglet Sorts : sorts de la classe du stuff au niveau du stuff, dégâts calculés depuis les totaux. */
export function SpellsTab({ build, result, breeds, settings, onSettings }: Props) {
  const spellBook = useSpellBook();
  const [inputs, setInputs] = useState<Record<number, SpellInput>>({});
  const [onlyDamage, setOnlyDamage] = useState(false);
  const attacker = useMemo(() => attackerFromBuild(result), [result]);
  const options = useMemo(() => damageOptions(settings), [settings]);
  const { breedId, level: characterLevel } = build.character;
  const breed = breeds.find((b) => b.id === breedId);

  let body;
  if (breedId === null || !breed) {
    body = <p className="muted">Choisissez la classe du personnage dans l'onglet Équipement pour voir ses sorts.</p>;
  } else if (spellBook.status === 'loading') {
    body = <p className="status">Chargement des sorts…</p>;
  } else if (spellBook.status === 'error') {
    body = <p className="status error">Impossible de charger les sorts : {spellBook.message}</p>;
  } else {
    const book = spellBook.book;
    const pairs = book.pairsOf(breedId).filter(
      ({ base, variant }) => !onlyDamage || [base, variant].some((s) => s && hasComputedDamage(s, book, characterLevel)),
    );
    body = (
      <>
        <div className="toolbar">
          <label className="checkbox">
            <input type="checkbox" checked={onlyDamage} onChange={(e) => setOnlyDamage(e.target.checked)} />
            Seulement les paires avec des dégâts calculés
          </label>
          <span className="muted small">
            {breed.name} niveau {characterLevel}, valeurs de la release {book.release} · <Link to={`/sorts/${breedId}`}>tous les détails des sorts</Link>
          </span>
        </div>
        <div className="spell-pairs">
          {pairs.map(({ base, variant }) => (
            <div key={base.id} className="spell-pair">
              {[base, variant].map(
                (spell, i) =>
                  spell && (
                    <SpellDamageCard
                      key={spell.id}
                      spell={spell}
                      variant={i === 1}
                      book={book}
                      characterLevel={characterLevel}
                      attacker={attacker}
                      options={options}
                      input={inputs[spell.id] ?? NO_INPUT}
                      onInput={(input) => setInputs((all) => ({ ...all, [spell.id]: input }))}
                    />
                  ),
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Sorts{breed && <> : {breed.name}</>}</h2>
        {body}
      </section>
      <DamageSettingsPanel settings={settings} onChange={onSettings} weapon={false} />
    </>
  );
}

interface CardProps {
  spell: Spell;
  variant: boolean;
  book: SpellBook;
  characterLevel: number;
  attacker: AttackerStats;
  options: DamageOptions;
  input: SpellInput;
  onInput(input: SpellInput): void;
}

function SpellDamageCard({ spell, variant, book, characterLevel, attacker, options, input, onInput }: CardProps) {
  const level = levelFor(spell, characterLevel);
  const head = (
    <div className="card-head">
      <h3>
        {spell.name}
        {variant && <span className="badge">variante</span>}
      </h3>
      <span className="muted small">
        ID {spell.id}
        {level && <> · grade {level.grade} (niv. {level.minPlayerLevel})</>}
      </span>
    </div>
  );
  if (!level) {
    return (
      <article className="card spell-card">
        {head}
        <p className="muted">Obtenu au niveau {sortedLevels(spell)[0]?.minPlayerLevel ?? '?'}.</p>
      </article>
    );
  }

  const perCharge = chargeBonus(spell, level);
  const casts = Math.min(input.casts, level.maxCastPerTurn || Infinity);
  const damage = spellDamage(level, book.effects, attacker, { ...options, baseBonus: input.charges * perCharge, castsPerTurn: casts });
  const lineAt = new Map(damage.lines.map((l) => [l.index, l]));
  const canCrit = level.criticalEffects.length > 0;
  const rows = level.effects.map((effect, index) => ({ effect, index, text: effectText(effect, book) })).filter((r) => r.text || lineAt.has(r.index));

  return (
    <article className="card spell-card">
      {head}
      <p className="small spell-summary">
        {level.apCost} PA · portée {level.minRange === level.range ? level.range : `${level.minRange} – ${level.range}`}
        {level.rangeCanBeBoosted ? ' (modifiable)' : ' (non modifiable)'} ·{' '}
        {canCrit ? `${level.criticalHitProbability} % CC, ${critChance(level.criticalHitProbability, attacker.critical)} % au total` : 'pas de critique'} ·{' '}
        {level.maxCastPerTurn || 'illimité'} par tour · {level.maxCastPerTarget || 'illimité'} par cible · lancer {castModes(level)}
      </p>
      <table className="grid-table damage-table">
        <thead>
          <tr>
            <th>Effet</th>
            <th className="num">Normal</th>
            <th className="num">Critique</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ effect, index, text }) => {
            const line = lineAt.get(index);
            const element = line?.element ?? effectElement(effect, book);
            return (
              <tr key={index} className={line ? undefined : 'muted'}>
                <td>
                  {element && <ElementDot element={element} />}
                  {text || `Effet ${effect.effectId}`}
                </td>
                <td className="num">{line ? formatDamage(line.normal) : ''}</td>
                <td className="num">{line ? formatDamage(line.critical) : ''}</td>
              </tr>
            );
          })}
          {damage.total && damage.lines.length > 1 && (
            <tr className="total-row">
              <td>Total</td>
              <td className="num">{formatDamage(damage.total.normal)}</td>
              <td className="num">{formatDamage(damage.total.critical)}</td>
            </tr>
          )}
          {damage.total && damage.lines.some((l) => l.kind === 'steal') && (
            <tr>
              <td>Soins (vol)</td>
              <td className="num">{formatDamage(damage.total.heal)}</td>
              <td className="num">{formatDamage(damage.total.critHeal)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {damage.lines.length > 0 && (
        <>
          {damage.total ? (
            <p className="small spell-average">
              Moyenne : <strong>{damage.total.average.perCast}</strong> par lancer · {damage.total.average.perAp} par PA
              {damage.lines.some((l) => l.kind === 'steal') && <> · soins {damage.total.average.healPerCast}</>}
              {casts !== 1 && (
                <>
                  {' '}
                  · <strong>{damage.total.average.perTurn}</strong> par tour
                </>
              )}
            </p>
          ) : (
            <p className="small muted spell-average">{damage.noTotal}</p>
          )}
          <div className="field-row small">
            {perCharge > 0 && (
              <label title="Nombre maximal de charges absent des données">
                Charges (+{perCharge} de base chacune)
                <NumberField className="narrow" value={input.charges} min={0} max={99} onChange={(charges) => onInput({ ...input, charges })} aria-label={`Charges de ${spell.name}`} />
              </label>
            )}
            {damage.total && (
              <label>
                <span>
                  Lancers par tour <Unverified />
                </span>
                <NumberField
                  className="narrow"
                  value={casts}
                  min={1}
                  max={level.maxCastPerTurn || 99}
                  onChange={(n) => onInput({ ...input, casts: n })}
                  aria-label={`Lancers par tour de ${spell.name}`}
                />
              </label>
            )}
          </div>
          <UnverifiedList items={damage.unverified} />
        </>
      )}
    </article>
  );
}

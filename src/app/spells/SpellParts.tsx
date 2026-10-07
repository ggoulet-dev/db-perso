import { formatRange } from '../../domain/format';
import { classifyEffect, renderEffect, type Spell, type SpellBook, type SpellEffect, type SpellLevel } from '../../domain/spells';
import { ELEMENTS, type Element } from '../../domain/stats';
import { ElementDot } from '../damage/DamageSettings';

export function sortedLevels(spell: Spell): SpellLevel[] {
  return [...spell.levels].sort((a, b) => a.grade - b.grade);
}

function durationText(duration: number): string {
  if (duration === -1) return ' (durée infinie)';
  if (duration > 0) return ` (${duration} tour${duration > 1 ? 's' : ''})`;
  return '';
}

/** Texte d'un effet, durée comprise ; vide pour les effets sans gabarit lisible. */
export function effectText(effect: SpellEffect, book: SpellBook): string {
  const ref = book.effects.get(effect.effectId);
  // Gabarit « #1 » seul : effet interne (sort déclenché, état) dont le texte n'est qu'un identifiant.
  if (ref?.description.trim() === '#1') return '';
  const text = renderEffect(effect, ref, { spellName: (id) => book.spellById.get(id)?.name });
  return text ? text + durationText(effect.duration) : '';
}

/** Élément concret affiché par une pastille (meilleur / pire élément : pas de pastille). */
export function effectElement(effect: SpellEffect, book: SpellBook): Element | null {
  const element = classifyEffect(book.effects.get(effect.effectId)).element;
  return element && (ELEMENTS as readonly string[]).includes(element) ? (element as Element) : null;
}

export function EffectList({ effects, book }: { effects: SpellEffect[]; book: SpellBook }) {
  const shown = effects.map((effect) => ({ effect, text: effectText(effect, book) })).filter((e) => e.text);
  if (shown.length === 0) return <p className="muted small">Aucun effet affichable.</p>;
  return (
    <ul className="lines spell-effects">
      {shown.map(({ effect, text }, i) => {
        const element = effectElement(effect, book);
        return (
          <li key={i}>
            {element && <ElementDot element={element} />}
            {text}
          </li>
        );
      })}
    </ul>
  );
}

const casts = (n: number) => (n === 0 ? 'illimité' : String(n));

export function castModes(level: SpellLevel): string {
  const modes = [level.castInLine && 'en ligne', level.castInDiagonal && 'en diagonale'].filter(Boolean);
  const los = level.castTestLos ? 'ligne de vue requise' : 'sans ligne de vue';
  return `${modes.length ? modes.join(' et ') : 'libre'}, ${los}`;
}

/** PA, portée, critique, lancers, modes de lancer. `critTotal` : % CC avec le Critique du stuff. */
export function SpellFacts({ level, critTotal }: { level: SpellLevel; critTotal?: number }) {
  const canCrit = level.criticalEffects.length > 0;
  return (
    <dl className="facts">
      <dt>Coût</dt>
      <dd>{level.apCost} PA</dd>
      <dt>Portée</dt>
      <dd>
        {formatRange(level.minRange, level.range)} <span className="muted">({level.rangeCanBeBoosted ? 'modifiable' : 'non modifiable'})</span>
      </dd>
      <dt>Critique</dt>
      <dd>
        {canCrit ? `${level.criticalHitProbability} %` : 'Pas de coup critique'}
        {canCrit && critTotal !== undefined && <span className="muted"> · {critTotal} % avec le stuff</span>}
      </dd>
      <dt>Lancers</dt>
      <dd>
        {casts(level.maxCastPerTurn)} par tour · {casts(level.maxCastPerTarget)} par cible
      </dd>
      <dt>Lancer</dt>
      <dd>{castModes(level)}</dd>
    </dl>
  );
}

export function GradePicker({ spell, selected, available, onSelect }: { spell: Spell; selected: number; available: number | null; onSelect(grade: number): void }) {
  return (
    <span className="grade-picker" role="group" aria-label={`Grade de ${spell.name}`}>
      {sortedLevels(spell).map((level) => (
        <button
          key={level.grade}
          type="button"
          className={level.grade === selected ? 'current' : undefined}
          aria-pressed={level.grade === selected}
          title={level.grade === available ? 'Grade accessible au niveau choisi' : undefined}
          onClick={() => onSelect(level.grade)}
        >
          {level.grade} · niv. {level.minPlayerLevel}
        </button>
      ))}
    </span>
  );
}

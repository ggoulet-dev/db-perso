import { useState } from 'react';
import { useDataset } from '../../data';
import { SLOT_KEYS, SLOT_KIND, SLOT_LABELS, type Build, type SlotEntry, type SlotKey } from '../../domain/build/types';
import type { BuildResult, SlotResult } from '../../domain/engine';
import type { Breed } from '../../domain/rules';
import { ItemIcon } from '../components';
import { ItemPicker } from './ItemPicker';
import { SlotDetail } from './SlotDetail';
import { SlotGlyph } from './SlotGlyph';

interface Props {
  build: Build;
  result: BuildResult;
  breed: Breed | undefined;
  update(recipe: (build: Build) => Build): void;
}

// Silhouette dans l'ordre de DofusBook ; la monture, qu'il fusionne avec le familier, vient dessous.
const LEFT: readonly SlotKey[] = ['am', 'br', 'a1', 'ce', 'bo'];
const RIGHT: readonly SlotKey[] = ['ch', 'ar', 'a2', 'ca', 'fa', 'mo'];
const DOFUS: readonly SlotKey[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];

type MarkKind = 'bad' | 'warn' | 'note';
interface Mark {
  kind: MarkKind;
  text: string;
}

/** Un seul repère par case : ce qui change les totaux d'abord, le reste en infobulle. */
function slotMarks(entry: SlotEntry | null, res: SlotResult | undefined): Mark[] {
  if (!entry) return [];
  const marks: Mark[] = [];
  if (!res?.item) marks.push({ kind: 'bad', text: 'absent des données' });
  if (res?.condition?.status === 'non remplie') marks.push({ kind: 'bad', text: 'condition non remplie' });
  if (res?.condition?.status === 'non évaluée') marks.push({ kind: 'warn', text: 'condition non évaluée' });
  if (res?.lines.some((line) => line.over)) marks.push({ kind: 'warn', text: 'over' });
  if (entry.exos.length > 0) marks.push({ kind: 'note', text: `${entry.exos.length} exo${entry.exos.length > 1 ? 's' : ''}` });
  else if (res?.lines.some((line) => line.rolled)) marks.push({ kind: 'note', text: 'jets non parfaits' });
  return marks;
}

export function SlotsPanel({ build, result, breed, update }: Props) {
  const dataset = useDataset();
  const [selected, setSelected] = useState<SlotKey>('ch');
  const [picking, setPicking] = useState(false);
  const entry = build.slots[selected];
  const showPicker = picking || !entry;
  const equipped = SLOT_KEYS.filter((slot) => build.slots[slot]).length;

  const select = (slot: SlotKey) => {
    setSelected(slot);
    setPicking(false);
  };

  const socket = (slot: SlotKey) => {
    const current = build.slots[slot];
    const res = result.slots[slot];
    const item = res?.item;
    const marks = slotMarks(current, res);
    const name = current ? (item?.name ?? current.itemName) : 'vide';
    const title = [`${SLOT_LABELS[slot]} : ${name}`, ...marks.map((m) => m.text)].join(' · ');
    const className = ['socket', slot === selected && 'selected', !current && 'empty', marks[0] && `mark-${marks[0].kind}`].filter(Boolean).join(' ');
    return (
      <button type="button" key={slot} className={className} aria-pressed={slot === selected} aria-label={title} title={title} onClick={() => select(slot)}>
        {item ? <ItemIcon iconId={item.iconId} size={128} shown={52} /> : <SlotGlyph kind={SLOT_KIND[slot]} />}
        {marks[0] && <span className="socket-mark" />}
      </button>
    );
  };

  const focused = result.slots[selected];
  const focusedItem = focused?.item;
  const focusedSet = focusedItem?.setId == null ? undefined : dataset.setById.get(focusedItem.setId);

  return (
    <section className="card">
      <h2>Équipement</h2>
      <div className="slots-layout">
        <div className="doll" role="group" aria-label="Emplacements">
          <div className="doll-col">{LEFT.map(socket)}</div>
          <div className="nameplate">
            <div className="nameplate-class">
              {breed?.img && <img src={breed.img} alt="" width={40} height={40} />}
              <span className="nameplate-name">{breed?.name ?? 'Sans classe'}</span>
              <span className="muted small">niveau {build.character.level}</span>
            </div>
            <div className="nameplate-focus" aria-live="polite">
              <span className="muted small">{SLOT_LABELS[selected]}</span>
              {entry ? (
                <>
                  <strong>{focusedItem?.name ?? entry.itemName}</strong>
                  {focusedItem && (
                    <span className="muted small">
                      Niv. {focusedItem.level}
                      {focusedSet && ` · ${focusedSet.name}`}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong className="muted">Vide</strong>
                  <span className="muted small">Choisissez un objet ci-contre</span>
                </>
              )}
            </div>
            <span className="muted small">
              {equipped} objet{equipped > 1 ? 's' : ''} sur {SLOT_KEYS.length}
            </span>
          </div>
          <div className="doll-col">{RIGHT.map(socket)}</div>
          <div className="doll-row">{DOFUS.map(socket)}</div>
        </div>

        <div className="slot-workspace">
          {showPicker ? (
            <ItemPicker
              key={selected}
              slot={selected}
              level={build.character.level}
              currentItemId={entry?.itemId ?? null}
              onCancel={entry ? () => setPicking(false) : undefined}
              onPick={(item) => {
                update((b) => ({ ...b, slots: { ...b.slots, [selected]: { itemId: item.id, itemName: item.name, rolls: [], exos: [] } } }));
                setPicking(false);
              }}
            />
          ) : (
            <SlotDetail key={selected} slot={selected} entry={entry} result={result.slots[selected]} update={update} onChangeItem={() => setPicking(true)} />
          )}
        </div>
      </div>
    </section>
  );
}

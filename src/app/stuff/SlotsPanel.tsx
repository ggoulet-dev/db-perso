import { useState } from 'react';
import { SLOT_KEYS, SLOT_LABELS, type Build, type SlotKey } from '../../domain/build/types';
import type { BuildResult } from '../../domain/engine';
import { ItemIcon } from '../components';
import { ItemPicker } from './ItemPicker';
import { ConditionBadge, SlotDetail } from './SlotDetail';

interface Props {
  build: Build;
  result: BuildResult;
  update(recipe: (build: Build) => Build): void;
}

export function SlotsPanel({ build, result, update }: Props) {
  const [selected, setSelected] = useState<SlotKey>('ch');
  const [picking, setPicking] = useState(false);
  const entry = build.slots[selected];
  const showPicker = picking || !entry;

  const select = (slot: SlotKey) => {
    setSelected(slot);
    setPicking(false);
  };

  return (
    <section className="card">
      <h2>Équipement</h2>
      <div className="slot-grid">
        {SLOT_KEYS.map((slot) => {
          const current = build.slots[slot];
          const res = result.slots[slot];
          const item = res?.item;
          const over = res?.lines.some((line) => line.over);
          const rolled = res?.lines.some((line) => line.rolled);
          return (
            <button
              type="button"
              key={slot}
              className={`slot-tile${slot === selected ? ' selected' : ''}${current ? '' : ' empty'}`}
              onClick={() => select(slot)}
              title={current ? `${SLOT_LABELS[slot]} : ${current.itemName}` : `${SLOT_LABELS[slot]} : vide`}
            >
              {item ? <ItemIcon iconId={item.iconId} shown={40} /> : <span className="slot-placeholder">{current ? '?' : '+'}</span>}
              <span className="slot-text">
                <span className="muted small">{SLOT_LABELS[slot]}</span>
                <span className="slot-name">{current ? (item?.name ?? current.itemName) : '—'}</span>
                <span className="slot-flags">
                  {current && !item && <span className="badge cond-bad">absent</span>}
                  {res?.condition && res.condition.status !== 'remplie' && <ConditionBadge status={res.condition.status} />}
                  {over && <span className="badge warn">over</span>}
                  {!over && rolled && <span className="badge">jets</span>}
                  {current && current.exos.length > 0 && <span className="badge">exo</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="slot-panel">
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
    </section>
  );
}

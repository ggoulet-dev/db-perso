import type { Build } from '../../domain/build/types';
import type { BuildResult } from '../../domain/engine';
import { MAIN_STATS, SCROLL_MAX, type MainStat } from '../../domain/rules';
import { statLabel } from './labels';
import { NumberField } from './NumberField';

interface Props {
  build: Build;
  result: BuildResult;
  update(recipe: (build: Build) => Build): void;
}

export function CaracsPanel({ build, result, update }: Props) {
  const { spent, available, byStat } = result.points;
  const setCarac = (part: 'base' | 'scrolls', stat: MainStat, value: number) =>
    update((b) => ({ ...b, caracs: { ...b.caracs, [part]: { ...b.caracs[part], [stat]: value } } }));
  const setAllScrolls = (value: number) =>
    update((b) => ({ ...b, caracs: { ...b.caracs, scrolls: Object.fromEntries(MAIN_STATS.map((s) => [s, value])) as Record<MainStat, number> } }));
  const remaining = available - spent;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Caractéristiques</h2>
        <span className="card-tools">
          <button type="button" onClick={() => setAllScrolls(SCROLL_MAX)}>
            Tout parcheminer
          </button>
          <button type="button" onClick={() => setAllScrolls(0)}>
            Parchemins à 0
          </button>
        </span>
      </div>
      <table className="grid-table">
        <thead>
          <tr>
            <th>Carac</th>
            <th className="num">Base visée</th>
            <th className="num">Points</th>
            <th className="num">Parchemins</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {MAIN_STATS.map((stat) => (
            <tr key={stat}>
              <td>{statLabel(stat)}</td>
              <td className="num">
                <NumberField value={build.caracs.base[stat]} min={0} onChange={(n) => setCarac('base', stat, n)} aria-label={`${statLabel(stat)} de base`} />
              </td>
              <td className="num">{byStat[stat]}</td>
              <td className="num">
                <NumberField value={build.caracs.scrolls[stat]} min={0} max={SCROLL_MAX} onChange={(n) => setCarac('scrolls', stat, n)} aria-label={`Parchemins ${statLabel(stat)}`} />
              </td>
              <td className="num strong">{result.totals[stat]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={remaining < 0 ? 'points over' : 'points'}>
        {spent} / {available} points dépensés —{' '}
        {remaining >= 0 ? `${remaining} restant${remaining > 1 ? 's' : ''}` : `${-remaining} de trop`}
      </p>
    </section>
  );
}

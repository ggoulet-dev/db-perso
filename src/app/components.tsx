import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataset } from '../data';
import { itemIconUrl } from '../domain/dataset';
import type { Condition, Line, TextLine, Weapon } from '../domain/dataset';
import { flattenCondition, formatConditionTest, formatLine, formatRange, parseGameText } from '../domain/format';

const ICON_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#8b8f96" stroke-width="3" stroke-dasharray="6 4"/><text x="32" y="41" font-size="24" font-family="sans-serif" text-anchor="middle" fill="#8b8f96">?</text></svg>',
)}`;

export function ItemIcon({ iconId, size = 64, shown = size }: { iconId: number; size?: 64 | 128; shown?: number }) {
  const src = itemIconUrl(iconId, size);
  // Mémorise l'URL en échec plutôt qu'un booléen : le composant peut être réutilisé pour un autre objet.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <img
      className="icon"
      src={failedSrc === src ? ICON_PLACEHOLDER : src}
      width={shown}
      height={shown}
      alt=""
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}

export function GameText({ text }: { text: string }) {
  const { itemById } = useDataset();
  return (
    <span className="game-text">
      {parseGameText(text).map((part, i) => (
        <Fragment key={i}>
          {part.kind === 'text' ? (
            part.text
          ) : part.kind === 'item' && itemById.has(part.id) ? (
            <Link to={`/objets/${part.id}`}>{part.name}</Link>
          ) : (
            <strong title={part.kind === 'spell' ? `Sort n° ${part.id}` : `Objet n° ${part.id}`}>{part.name}</strong>
          )}
        </Fragment>
      ))}
    </span>
  );
}

export function LineList({ lines, texts = [] }: { lines: Line[]; texts?: TextLine[] }) {
  if (lines.length === 0 && texts.length === 0) return <p className="muted">Aucun effet.</p>;
  return (
    <ul className="lines">
      {lines.map((line, i) => (
        <li key={`l${i}`} className={line.max < 0 ? 'negative' : undefined}>
          {formatLine(line)}
        </li>
      ))}
      {texts.map((text, i) => (
        <li key={`t${i}`} className={`text-line text-${text.tag}`}>
          <GameText text={text.text} />
        </li>
      ))}
    </ul>
  );
}

function ConditionGroup({ node }: { node: Condition }) {
  if (node.kind === 'test') return <>{formatConditionTest(node)}</>;
  const join = node.kind === 'and' ? 'et' : 'ou';
  return (
    <ul className={`cond-group cond-${node.kind}`}>
      {node.children.map((child, i) => (
        <li key={i}>
          {i > 0 && <span className="cond-join">{join} </span>}
          <ConditionGroup node={child} />
        </li>
      ))}
    </ul>
  );
}

export function ConditionTree({ condition }: { condition: Condition }) {
  const root = flattenCondition(condition);
  return (
    <div className="cond-tree">
      {root.kind === 'test' ? <p>{formatConditionTest(root)}</p> : <ConditionGroup node={root} />}
    </div>
  );
}

export function WeaponStats({ weapon }: { weapon: Weapon }) {
  return (
    <dl className="facts">
      <dt>Coût</dt>
      <dd>{weapon.apCost} PA</dd>
      <dt>Portée</dt>
      <dd>{formatRange(weapon.minRange, weapon.maxRange)}</dd>
      <dt>Critique</dt>
      <dd>
        {weapon.critProbability} %
      </dd>
      <dt>Bonus critique</dt>
      <dd>+{weapon.critBonus}</dd>
      <dt>Lancers par tour</dt>
      <dd>{weapon.maxCastPerTurn}</dd>
    </dl>
  );
}

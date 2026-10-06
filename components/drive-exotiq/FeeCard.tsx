'use client';

import { useId, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Money } from './BookingChrome';
import type { FeeGroups, FeeLine } from './feeGroups';

/**
 * The one money card every booking surface uses (MP-26): the operator's charge,
 * then Drive Exotiq's separate charge, each a labelled group with its own
 * subtotal. Hierarchy comes from type weight and spacing, never gold or a box
 * (MP-16). Trip fees fold the platform fee and the state rental fee behind a
 * real disclosure button; Protect stays its own line and card processing a
 * subline under Trip fees. Takes plain data, so the server confirmation page can
 * render it too.
 *
 * `between` sits between the two groups inside the card: the Review step puts
 * the Protect switch there, next to the charge it changes.
 */
export function TwoPartyBreakdown({
  groups,
  onRentalClick,
  defaultOpen = false,
  operatorNote,
  between,
}: {
  groups: FeeGroups;
  /** Review only: the Rental row returns to the dates step. */
  onRentalClick?: () => void;
  defaultOpen?: boolean;
  /** Under the operator subtotal, e.g. how the charge appears on a statement. */
  operatorNote?: string;
  between?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const operatorId = `${id}operator`;
  const exotiqId = `${id}exotiq`;
  const detailId = `${id}trip-fees`;

  const row = (line: FeeLine, index: number) => {
    const spacing = index === 0 ? '' : line.key === 'processing' ? 'mt-1' : 'mt-3';
    if (line.key === 'trip-fees') {
      return (
        <div key={line.key} data-money-line="trip-fees" className={spacing}>
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              data-money="trip-fees-toggle"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((value) => !value)}
              className="-my-2.5 inline-flex min-h-11 min-w-11 items-center gap-1.5 text-left text-ink"
            >
              {line.label}
              <Info size={14} aria-hidden className="shrink-0 text-muted" />
            </button>
            <Money cents={line.cents} />
          </div>
          {/* No display utility on the region itself: one would beat `hidden`. */}
          <div id={detailId} data-money="trip-fees-detail" hidden={!open}>
            <div className="mt-2 space-y-1.5 border-l border-line pl-3 text-body-sm text-muted">
              {groups.exotiq.tripFees.components.map((part) => (
                <div key={part.key} data-money-line={part.key} className="flex items-start justify-between gap-3">
                  <span>
                    {part.label}
                    {part.detail && <span className="block text-label text-faint">{part.detail}</span>}
                  </span>
                  <Money cents={part.cents} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (line.key === 'processing') {
      return (
        <div key={line.key} data-money-line="processing" className={`${spacing} flex justify-between gap-3 text-label text-faint`}>
          <span>{line.label}</span>
          <Money cents={line.cents} />
        </div>
      );
    }
    const label = (
      <span>
        <span className="block text-ink">{line.label}</span>
        {line.detail && <span className="block text-label text-muted">{line.detail}</span>}
      </span>
    );
    if (line.key === 'rental' && onRentalClick) {
      return (
        <button key={line.key} type="button" data-money-line="rental" onClick={onRentalClick} className={`${spacing} flex w-full items-start justify-between gap-3 text-left`}>
          {label}
          <Money cents={line.cents} />
        </button>
      );
    }
    return (
      <div key={line.key} data-money-line={line.key} className={`${spacing} flex items-start justify-between gap-3`}>
        {label}
        <Money cents={line.cents} />
      </div>
    );
  };

  return (
    <div data-money="card" className="mt-4 border-t border-line pt-4 text-body">
      <div role="group" aria-labelledby={operatorId} data-money="group-operator">
        <div id={operatorId} className="mb-3">
          <span className="font-semibold text-ink">{groups.operator.name}</span>
          <span className="text-muted"> · charged by the operator</span>
        </div>
        {groups.operator.lines.map(row)}
        <div data-money-line="subtotal" className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-medium text-ink">
          <span>Subtotal</span>
          <Money cents={groups.operator.subtotalCents} />
        </div>
        {operatorNote && <p className="mt-2 text-label text-faint">{operatorNote}</p>}
      </div>
      {between}
      <div role="group" aria-labelledby={exotiqId} data-money="group-exotiq" className="mt-4 border-t border-line pt-4">
        <div id={exotiqId} className="mb-3">
          <span className="font-semibold text-ink">Drive Exotiq</span>
          <span className="text-muted"> · charged separately — appears as EXOTIQ RENT</span>
        </div>
        {groups.exotiq.lines.map(row)}
        <div data-money-line="subtotal" className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-medium text-ink">
          <span>Subtotal</span>
          <Money cents={groups.exotiq.subtotalCents} />
        </div>
      </div>
    </div>
  );
}

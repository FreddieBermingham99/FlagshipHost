'use client'

import { useMemo, useState } from 'react'
import { Check, Clock, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type TableOrderItem = {
  id: number
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string | string[]>
}

export type TableOrder = {
  id: number
  stashpoint_id: string | null
  business_name: string
  city: string | null
  status: string
  created_at: string
  items: TableOrderItem[]
}

type CellEntry = {
  orderId: number
  status: string
}

type TableGroup = {
  key: string
  stashpointId: string | null
  businessName: string
  city: string | null
  signMap: Record<string, CellEntry>
  orderIds: number[]
  latestCreatedAt: string
  allFulfilled: boolean
}

type SortDir = 'asc' | 'desc'

function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="ml-1 inline h-3 w-3 opacity-20" />
  return dir === 'asc' ? (
    <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />
  )
}

interface Props {
  orders: TableOrder[]
  selectedIds: Set<number>
  loading: boolean
  onToggleOrder: (id: number, checked: boolean) => void
  onToggleGroup: (orderIds: number[], checked: boolean) => void
  onViewOrder: (id: number) => void
  showFulfilled: boolean
  onToggleShowFulfilled: () => void
}

export function SignageOrdersTableView({
  orders,
  selectedIds,
  loading,
  onToggleOrder,
  onToggleGroup,
  onViewOrder,
  showFulfilled,
  onToggleShowFulfilled,
}: Props) {
  const [sortKey, setSortKey] = useState<string>('latestCreatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const tableGroups = useMemo((): TableGroup[] => {
    const map = new Map<string, TableGroup>()
    for (const order of orders) {
      const spKey = order.stashpoint_id?.trim()
        ? `sp:${order.stashpoint_id.trim()}`
        : `bn:${(order.business_name || 'Unknown').trim().toLowerCase()}`

      if (!map.has(spKey)) {
        map.set(spKey, {
          key: spKey,
          stashpointId: order.stashpoint_id ?? null,
          businessName: order.business_name || 'Unknown business',
          city: order.city ?? null,
          signMap: {},
          orderIds: [],
          latestCreatedAt: order.created_at,
          allFulfilled: true,
        })
      }

      const group = map.get(spKey)!
      group.orderIds.push(order.id)
      if (order.status !== 'fulfilled') group.allFulfilled = false
      if (order.created_at > group.latestCreatedAt) group.latestCreatedAt = order.created_at

      for (const item of order.items) {
        // Last order wins if sign type appears in multiple orders
        group.signMap[item.item_name_snapshot] = { orderId: order.id, status: order.status }
      }
    }
    return [...map.values()]
  }, [orders])

  const signTypeColumns = useMemo((): string[] => {
    const types = new Set<string>()
    for (const order of orders) {
      for (const item of order.items) types.add(item.item_name_snapshot)
    }
    return [...types].sort()
  }, [orders])

  const sortedGroups = useMemo((): TableGroup[] => {
    return [...tableGroups].sort((a, b) => {
      let diff = 0
      if (sortKey === 'businessName') {
        diff = a.businessName.toLowerCase() < b.businessName.toLowerCase() ? -1 : 1
      } else if (sortKey === 'stashpointId') {
        diff = (a.stashpointId ?? '') < (b.stashpointId ?? '') ? -1 : 1
      } else if (sortKey === 'latestCreatedAt') {
        diff = a.latestCreatedAt < b.latestCreatedAt ? -1 : 1
      } else {
        // Sign type column: unfulfilled first, not-ordered last
        const eA = a.signMap[sortKey]
        const eB = b.signMap[sortKey]
        if (!eA && !eB) return 0
        if (!eA) return 1
        if (!eB) return -1
        const rankA = eA.status === 'fulfilled' ? 1 : 0
        const rankB = eB.status === 'fulfilled' ? 1 : 0
        diff = rankA - rankB
      }
      return sortDir === 'asc' ? diff : -diff
    })
  }, [tableGroups, sortKey, sortDir])

  const visibleGroups = useMemo(
    () => (showFulfilled ? sortedGroups : sortedGroups.filter((g) => !g.allFulfilled)),
    [sortedGroups, showFulfilled]
  )

  const hiddenFulfilledCount = useMemo(
    () => (showFulfilled ? 0 : tableGroups.filter((g) => g.allFulfilled).length),
    [tableGroups, showFulfilled]
  )

  const allVisibleSelected =
    visibleGroups.length > 0 &&
    visibleGroups.flatMap((g) => g.orderIds).every((id) => selectedIds.has(id))

  const someVisibleSelected = visibleGroups
    .flatMap((g) => g.orderIds)
    .some((id) => selectedIds.has(id))

  const toggleAllVisible = (checked: boolean) => {
    const allIds = visibleGroups.flatMap((g) => g.orderIds)
    onToggleGroup(allIds, checked)
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Loading orders…</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {visibleGroups.length} stashpoint{visibleGroups.length !== 1 ? 's' : ''} shown
          {hiddenFulfilledCount > 0 && (
            <> · <span className="text-green-700">{hiddenFulfilledCount} fully fulfilled hidden</span></>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={onToggleShowFulfilled} className="h-7 text-xs">
          {showFulfilled ? (
            <>
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              Hide fulfilled
            </>
          ) : (
            <>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Show fulfilled
              {hiddenFulfilledCount > 0 && ` (${hiddenFulfilledCount})`}
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-pink-100 shadow-sm">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blush/60 via-white to-white">
              <th className="w-10 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-primary/30 text-primary"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected
                  }}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                  disabled={visibleGroups.length === 0}
                  aria-label="Select all visible"
                />
              </th>
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-primary"
                onClick={() => handleSort('businessName')}
              >
                Business
                <SortIcon active={sortKey === 'businessName'} dir={sortDir} />
              </th>
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-primary"
                onClick={() => handleSort('stashpointId')}
              >
                SP ID
                <SortIcon active={sortKey === 'stashpointId'} dir={sortDir} />
              </th>
              {signTypeColumns.map((col) => (
                <th
                  key={col}
                  className="cursor-pointer px-2 py-2.5 text-center text-xs font-semibold text-primary"
                  onClick={() => handleSort(col)}
                  title={col}
                >
                  <span className="block">{abbreviate(col)}</span>
                  <SortIcon active={sortKey === col} dir={sortDir} />
                </th>
              ))}
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-primary">View</th>
            </tr>
            {signTypeColumns.length > 0 && (
              <tr className="border-b border-pink-100 bg-white">
                <td colSpan={3} />
                {signTypeColumns.map((col) => (
                  <td key={col} className="px-2 py-1 text-center">
                    <span className="block max-w-[60px] truncate text-[10px] text-slate-400" title={col}>
                      {col}
                    </span>
                  </td>
                ))}
                <td />
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-pink-50">
            {visibleGroups.map((group) => {
              const allGroupSelected = group.orderIds.every((id) => selectedIds.has(id))
              const someGroupSelected = group.orderIds.some((id) => selectedIds.has(id))
              // Find the most relevant single order to view (pick first unfulfilled, else first)
              const viewOrderId =
                group.orderIds.find((id) => {
                  const o = orders.find((x) => x.id === id)
                  return o && o.status !== 'fulfilled'
                }) ?? group.orderIds[0]

              return (
                <tr key={group.key} className="transition hover:bg-blush/20">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-primary/30 text-primary"
                      checked={allGroupSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allGroupSelected && someGroupSelected
                      }}
                      onChange={(e) => onToggleGroup(group.orderIds, e.target.checked)}
                      aria-label={`Select all orders for ${group.businessName}`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{group.businessName}</p>
                    <p className="text-[11px] text-slate-500">{group.city || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                    {group.stashpointId ? (
                      <span title={group.stashpointId}>{group.stashpointId.slice(0, 8)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {signTypeColumns.map((col) => {
                    const entry = group.signMap[col]
                    if (!entry) {
                      return (
                        <td key={col} className="px-2 py-2.5 text-center text-slate-200">
                          —
                        </td>
                      )
                    }
                    const isFulfilled = entry.status === 'fulfilled'
                    const isSelected = selectedIds.has(entry.orderId)
                    return (
                      <td key={col} className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleOrder(entry.orderId, !isSelected)}
                          title={`${col} · Order #${entry.orderId} · ${entry.status}${isSelected ? ' (selected)' : ''}`}
                          className={[
                            'mx-auto flex h-7 w-7 items-center justify-center rounded-full transition',
                            isFulfilled
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-orange-400 text-white hover:bg-orange-500',
                            isSelected ? 'ring-2 ring-offset-1 ring-primary' : '',
                          ].join(' ')}
                        >
                          {isFulfilled ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-center">
                    {viewOrderId != null && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onViewOrder(viewOrderId)}
                      >
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visibleGroups.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {!showFulfilled && hiddenFulfilledCount > 0
              ? 'All stashpoints are fully fulfilled.'
              : 'No stashpoints found.'}
            {!showFulfilled && hiddenFulfilledCount > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={onToggleShowFulfilled}
                >
                  Show fulfilled ({hiddenFulfilledCount})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {signTypeColumns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="font-medium">Legend:</span>
          <span className="flex items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-3 w-3" />
            </span>
            Fulfilled
          </span>
          <span className="flex items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-white">
              <Clock className="h-3 w-3" />
            </span>
            Ordered, not yet fulfilled
          </span>
          <span className="text-slate-400">— Not ordered</span>
          <span className="flex items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-white ring-2 ring-offset-1 ring-primary">
              <Clock className="h-3 w-3" />
            </span>
            Selected
          </span>
          <span className="ml-auto text-[10px] text-slate-400">
            Column headers: {signTypeColumns.map((c) => `${abbreviate(c)} = ${c}`).join(' · ')}
          </span>
        </div>
      )}
    </div>
  )
}

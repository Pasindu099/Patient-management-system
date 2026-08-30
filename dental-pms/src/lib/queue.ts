// Reception queue status chain (v2):
// CHECKED_IN -> ASSIGNED -> IN_CHAIR -> COMPLETED -> PAID (or LEFT at any point)
export const QUEUE_STATUSES = ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR', 'COMPLETED', 'PAID', 'LEFT'] as const
export type QueueStatus = typeof QUEUE_STATUSES[number]

export const QUEUE_OPEN_STATUSES: QueueStatus[] = ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR', 'COMPLETED']

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  CHECKED_IN: 'Waiting',
  ASSIGNED:   'Assigned',
  IN_CHAIR:   'In chair',
  COMPLETED:  'Ready to pay',
  PAID:       'Paid',
  LEFT:       'Left',
}

export const QUEUE_STATUS_COLORS: Record<QueueStatus, string> = {
  CHECKED_IN: 'bg-orange-100 text-orange-700',
  ASSIGNED:   'bg-blue-100 text-blue-700',
  IN_CHAIR:   'bg-amber-100 text-amber-700',
  COMPLETED:  'bg-green-100 text-green-700',
  PAID:       'bg-gray-100 text-gray-500',
  LEFT:       'bg-gray-100 text-gray-400',
}

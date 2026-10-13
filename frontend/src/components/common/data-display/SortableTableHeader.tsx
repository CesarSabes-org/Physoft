import { IoChevronUp, IoChevronDown } from 'react-icons/io5'
import './SortableTableHeader.css'

export type SortDirection = 'asc' | 'desc' | null

interface SortableTableHeaderProps<T extends string> {
  label: string
  field: T
  currentSortField: T | null
  currentSortDirection: SortDirection
  onSort: (field: T) => void
  align?: 'left' | 'center' | 'right'
}

/**
 * Componente de encabezado de tabla ordenable
 */
function SortableTableHeader<T extends string>({
  label,
  field,
  currentSortField,
  currentSortDirection,
  onSort,
  align = 'left'
}: SortableTableHeaderProps<T>) {
  const isActive = currentSortField === field
  const direction = isActive ? currentSortDirection : null

  return (
    <th 
      className={`sortable-header sortable-header-${align}`}
      onClick={() => onSort(field)}
    >
      <div className="sortable-header-content">
        <span>{label}</span>
        <div className="sort-icons">
          {isActive && direction === 'asc' && <IoChevronUp className="sort-icon active" />}
          {isActive && direction === 'desc' && <IoChevronDown className="sort-icon active" />}
          {!isActive && (
            <>
              <IoChevronUp className="sort-icon inactive" />
              <IoChevronDown className="sort-icon inactive" />
            </>
          )}
        </div>
      </div>
    </th>
  )
}

export default SortableTableHeader

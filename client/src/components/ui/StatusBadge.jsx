import { getStatusBadge } from '../../utils/formatters';

export default function StatusBadge({ status }) {
  const { label, className } = getStatusBadge(status);
  return <span className={className}>{label}</span>;
}

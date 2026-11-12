export const StatusBadge = ({ map, status, testId }) => {
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
};

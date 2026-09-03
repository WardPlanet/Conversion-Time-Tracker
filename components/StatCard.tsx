export function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 shadow-sm ${
        highlight
          ? "border-brand-orange/30 bg-brand-orange/10"
          : "border-brand-darkBlue/10 bg-white"
      }`}
    >
      <p className="text-sm text-brand-darkBlue/70">{label}</p>
      <p className="text-2xl font-semibold text-brand-darkBlue">{value}</p>
    </div>
  );
}

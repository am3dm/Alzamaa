export const SectionCard = ({ title, icon: Icon, action, children, testId }) => (
  <section className="rounded-2xl bg-white border border-slate-200 shadow-sm" data-testid={testId}>
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />} {title}
      </h2>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export const Empty = ({ text, testId }) => (
  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-muted-foreground grain" data-testid={testId}>{text}</div>
);

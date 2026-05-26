interface WindowToggleProps {
  value: "7d" | "30d";
  onChange: (value: "7d" | "30d") => void;
  options: { value: "7d" | "30d"; label: string }[];
}

export default function WindowToggle({
  value,
  onChange,
  options,
}: WindowToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-green/20 p-0.5 bg-bg-surface">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-5 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase transition-colors duration-150 ${
            value === opt.value
              ? "bg-yellow text-bg-deep"
              : "text-muted hover:text-cream"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
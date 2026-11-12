import { ArrowUp, Lock } from "lucide-react";
import { GENDERS, PREMIUM_SEAT } from "@/lib/constants";

const BASE = "relative h-[72px] w-[72px] sm:h-20 sm:w-20 rounded-2xl border-2 grid place-items-center text-center transition-colors active:scale-95";

const SteeringWheel = () => (
  <div className={`${BASE} border-transparent bg-slate-100 text-slate-400`} data-testid="seat-driver">
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="13" r="2" /><path d="M3.5 10.5h5.5l1.5 2M20.5 10.5H15l-1.5 2M12 15v6" />
    </svg>
  </div>
);

const seatState = (s, { gender, rowGender, selected }) => {
  if (s.mine || selected === s.number) return "selected";
  if (s.occupant || s.taken) return "taken";
  if (gender && rowGender && rowGender !== gender) return "locked";
  return s.number === PREMIUM_SEAT ? "premium" : "free";
};

const STYLE = {
  selected: "bg-primary border-primary text-white shadow-md",
  taken: "bg-slate-200 border-slate-200 text-slate-500",
  locked: "bg-red-50 border-red-200 text-red-300 cursor-not-allowed",
  premium: "bg-white border-amber-500 text-slate-800 hover:bg-amber-50",
  free: "bg-white border-slate-200 text-slate-800 hover:border-primary/60",
};

const Seat = ({ s, state, interactive, onClick }) => (
  <button type="button" disabled={!interactive || state === "locked"} onClick={() => onClick?.(s)}
    data-testid={`seat-${s.number}`} data-state={state}
    className={`${BASE} ${STYLE[state]} ${interactive && state !== "locked" ? "cursor-pointer" : "cursor-default"}`}>
    <div className="leading-tight">
      <div className="text-lg font-bold">{s.number}</div>
      {state === "locked" && <Lock className="h-3.5 w-3.5 mx-auto" />}
      {s.occupant && (
        <div className={`text-[10px] font-bold max-w-[64px] truncate ${s.occupant.gender === "female" ? "text-pink-600" : "text-blue-600"}`}>
          {s.occupant.student_name}
        </div>
      )}
      {s.mine && <div className="text-[10px] font-bold">مقعدك</div>}
    </div>
  </button>
);

const RowTag = ({ gender }) => (
  <div className="w-12 text-[10px] font-bold text-center">
    {gender && gender !== "mixed" && (
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${gender === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
        <Lock className="h-2.5 w-2.5" />{GENDERS[gender]}
      </span>
    )}
  </div>
);

export const SeatMap = ({ rows, gender, selected, onSeat, onOccupant, interactive = true, showRowTags = true }) => {
  const click = (s) => (s.occupant ? onOccupant?.(s) : onSeat?.(s));
  const opts = (row) => ({ gender, rowGender: row.gender, selected });
  const cells = (row) => row.seats.map((s) => <Seat key={s.number} s={s} state={seatState(s, opts(row))} interactive={interactive} onClick={click} />);
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm px-4 py-5" data-testid="seat-map">
      <div className="flex items-center justify-center gap-1 text-sm text-slate-500 mb-4"><ArrowUp className="h-4 w-4" /> اتجاه السير</div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.row} className="flex items-center justify-center gap-2" data-testid={`seat-row-${row.row}`}>
            {showRowTags && <RowTag gender={row.gender} />}
            <div dir="ltr" className="grid grid-cols-3 gap-3">
              {row.row === 1 ? <><SteeringWheel /><div />{cells(row)}</> : cells(row)}
            </div>
            {showRowTags && <div className="w-12" />}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SeatLegend = ({ admin }) => (
  <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600" data-testid="seat-legend">
    <span className="flex items-center gap-2"><i className="inline-block h-5 w-5 rounded-md border-2 border-slate-200 bg-white" /> متاح</span>
    <span className="flex items-center gap-2"><i className="inline-block h-5 w-5 rounded-md bg-primary" /> {admin ? "المختار" : "مقعدك"}</span>
    <span className="flex items-center gap-2"><i className="inline-block h-5 w-5 rounded-md border-2 border-amber-500 bg-white" /> مميّز</span>
    <span className="flex items-center gap-2"><i className="inline-block h-5 w-5 rounded-md bg-slate-200 border-2 border-slate-300" /> محجوز</span>
    {admin && <span className="flex items-center gap-2"><i className="inline-block h-5 w-5 rounded-md border-2 border-red-200 bg-red-50" /> مقفل للجنس الآخر</span>}
  </div>
);

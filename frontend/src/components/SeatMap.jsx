import { Lock, User, CircleDot } from "lucide-react";
import { ROW_NAMES, GENDERS } from "@/lib/constants";

const seatStyle = (seat, rowGender, gender) => {
  if (seat.occupant) {
    return seat.occupant.gender === "female"
      ? "bg-pink-50 border-pink-400 text-pink-700"
      : "bg-blue-50 border-blue-500 text-blue-700";
  }
  if (gender && rowGender && rowGender !== gender) return "bg-red-50 border-red-300 text-red-400 cursor-not-allowed";
  if (gender) return "bg-white border-slate-300 text-slate-500 hover:border-primary hover:bg-blue-50 cursor-pointer";
  return "bg-slate-100 border-slate-300 text-slate-400";
};

const Seat = ({ seat, rowGender, gender, onSeat, onOccupant }) => {
  const locked = !seat.occupant && gender && rowGender && rowGender !== gender;
  const click = () => {
    if (seat.occupant) return onOccupant?.(seat);
    if (!locked && gender) onSeat?.(seat);
  };
  return (
    <button type="button" onClick={click} disabled={locked}
      data-testid={`seat-${seat.row}-${seat.seat}`}
      className={`relative h-20 rounded-xl border-2 p-1.5 text-center transition-colors active:scale-95 transition-transform ${seatStyle(seat, rowGender, gender)}`}>
      <div className="text-[10px] font-bold opacity-70">مقعد {seat.seat}</div>
      {seat.occupant ? (
        <div className="text-xs font-bold leading-snug line-clamp-2">{seat.occupant.student_name}</div>
      ) : locked ? (
        <Lock className="h-4 w-4 mx-auto mt-1" />
      ) : (
        <div className="text-xs mt-1">{gender ? "متاح" : "فارغ"}</div>
      )}
    </button>
  );
};

const RowLock = ({ gender }) => {
  if (!gender) return <span className="text-xs text-slate-400">مفتوح</span>;
  const cls = gender === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>
      <Lock className="h-3 w-3" /> {GENDERS[gender] || "مختلط"}
    </span>
  );
};

export const SeatMap = ({ rows, gender, onSeat, onOccupant }) => (
  <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-4 space-y-4" data-testid="seat-map">
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span className="font-bold">مقدمة السيارة</span>
      <span className="flex items-center gap-1"><CircleDot className="h-4 w-4" /> السائق</span>
    </div>
    {rows.map((row) => (
      <div key={row.row} className="space-y-1.5" data-testid={`seat-row-${row.row}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">{ROW_NAMES[row.row]}</span>
          <RowLock gender={row.gender} />
        </div>
        <div className={`grid gap-2 ${row.row === 1 ? "grid-cols-3" : "grid-cols-3"}`}>
          {row.seats.map((s) => (
            <Seat key={s.seat} seat={s} rowGender={row.gender} gender={gender} onSeat={onSeat} onOccupant={onOccupant} />
          ))}
          {row.row === 1 && (
            <div className="h-20 rounded-xl border-2 border-dashed border-slate-300 grid place-items-center text-slate-400">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

import { Activity, X } from "lucide-react";
import { fmtTime } from "../lib/formatters";
import { useUI } from "../context/UIContext";

export default function ActivityLogPanel() {
  const { activityLog, setShowLog } = useUI();
  const rc = { CUSTOMER: "text-emerald-600", DISPENSARY: "text-purple-600", DRIVER: "text-blue-600", ADMIN: "text-red-600" };
  return (
    <div className="fixed bottom-0 right-0 w-full sm:w-96 max-h-[45vh] z-[80] bg-white border-t border-l border-gray-200 shadow-2xl rounded-tl-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 rounded-tl-2xl">
        <h3 className="font-bold text-xs flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-amber-600" /> Activity Log</h3>
        <button onClick={() => setShowLog(false)} className="p-1 rounded-lg hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {activityLog.length === 0 && <p className="text-center text-gray-400 text-xs py-6">Place an order to see the flow!</p>}
        {activityLog.map(a => (
          <div key={a.id} className="flex gap-2 items-start text-[11px]">
            <span className="text-gray-400 font-mono whitespace-nowrap mt-0.5">{fmtTime(a.time)}</span>
            <div className="flex-1 min-w-0"><span className={`font-bold ${rc[a.role] || "text-gray-700"}`}>[{a.role}]</span> <span className="text-gray-700">{a.action}</span>{a.details && <p className="text-gray-400 truncate">{a.details}</p>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

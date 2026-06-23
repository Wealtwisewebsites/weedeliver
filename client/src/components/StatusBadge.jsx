import { STATUS_COLORS, ORDER_FLOW_LABELS } from "../lib/constants";

export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
    {(ORDER_FLOW_LABELS[status] || status).replace(/_/g, " ")}
  </span>
);

export default StatusBadge;

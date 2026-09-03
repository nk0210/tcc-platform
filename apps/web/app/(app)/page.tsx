import RightPanel from "@/components/RightPanel";
import CenterChart from "@/components/CenterChart";
import BottomPanel from "@/components/BottomPanel";

export default function Dashboard() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <CenterChart />
        <RightPanel />
      </div>
      <BottomPanel />
    </div>
  );
}

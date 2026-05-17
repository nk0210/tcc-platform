import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import RightPanel from "@/components/RightPanel";
import CenterChart from "@/components/CenterChart";
import BottomPanel from "@/components/BottomPanel";

export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <CenterChart />
        <RightPanel />
      </div>
      <BottomPanel />
    </div>
  );
}
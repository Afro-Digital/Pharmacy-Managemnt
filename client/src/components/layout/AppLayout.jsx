import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#F4F5FA] p-2 sm:p-3 lg:p-4 flex flex-col justify-center items-center overflow-hidden">
      {/* Outer rounded container card mimicking the SellMate design, centered and fitting screen */}
      <div className="w-full max-w-[1600px] h-full flex bg-white rounded-[20px] sm:rounded-[28px] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Right Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-white">
          <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-5 bg-[#FAFAFC] flex flex-col">
            <Outlet />
          </main>
          <MobileNav />
        </div>
      </div>
    </div>
  );
};

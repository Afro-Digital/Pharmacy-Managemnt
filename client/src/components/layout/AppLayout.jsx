import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F5FA] p-2 sm:p-4 lg:p-5 flex flex-col justify-center">
      {/* Outer rounded container card mimicking the SellMate design */}
      <div className="flex-1 flex bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden min-h-[calc(100vh-2rem)]">
        {/* Left Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Right Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">
          <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAFAFC] pb-24 lg:pb-8">
            <Outlet />
          </main>
          <MobileNav />
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileBottomNavigation from '../components/MobileBottomNavigation';
import MobileDrawer from '../components/MobileDrawer';
import '../styles/mobile.css';

const MobileAppShell = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  return (
    <div className="mobile-app-root">
      <MobileHeader onMenuClick={toggleDrawer} />
      
      <main className="mobile-content-area">
        <Outlet />
      </main>

      <MobileBottomNavigation onMenuClick={toggleDrawer} />
      
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
};

export default MobileAppShell;
